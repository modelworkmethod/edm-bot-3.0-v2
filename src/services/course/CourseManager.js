/**
 * Course Manager
 * Manages course content, progress tracking, and unlocks
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('CourseManager');

class CourseManager {
  constructor(userService, secondaryXPProcessor) {
    this.userService = userService;
    this.secondaryXPProcessor = secondaryXPProcessor;
  }

  /**
   * Helper: safely fetch user (tries getUser and then getOrCreateUser if available)
   */
  async getUserSafe(userId) {
    try {
      if (this.userService?.getUser) {
        const u = await this.userService.getUser(userId);
        if (u) return u;
      }

      if (this.userService?.getOrCreateUser) {
        const u = await this.userService.getOrCreateUser(userId);
        if (u) return u;
      }
    } catch (err) {
      logger.error('Failed to fetch user in CourseManager.getUserSafe', {
        userId,
        error: err.message,
      });
    }

    return null;
  }

  /**
   * Get all modules for user (with unlock status)
   */
  async getModulesForUser(userId) {
    const user = await this.getUserSafe(userId);
    const modules = await queryRows(
      'SELECT * FROM course_modules WHERE is_active = true ORDER BY module_number'
    );

    const modulesWithProgress = [];

    for (const module of modules) {
      const progress = await this.getModuleProgress(userId, module.id);
      const isUnlocked = await this.checkModuleUnlock(user, module, userId);

      modulesWithProgress.push({
        ...module,
        isUnlocked,
        progress: progress || {
          status: 'locked',
          videos_watched: 0,
          completion_percentage: 0,
        },
      });
    }

    return modulesWithProgress;
  }

  /**
   * Check if module is unlocked for user
   * @param {object|null} user - user row or null
   * @param {object} module - module row from DB
   * @param {string} [userId] - Discord user id (for logging)
   */
  async checkModuleUnlock(user, module, userId = null) {
    // Sin requisitos => siempre desbloqueado
    if (!module.unlock_requirements) {
      return true;
    }

    const requirements = module.unlock_requirements;

    // Si no hay user, tratamos como bloqueado pero sin romper
    if (!user) {
      logger.warn('checkModuleUnlock: user is null, treating as locked', {
        userId,
        moduleId: module.id,
        moduleNumber: module.module_number,
        requirements,
      });
      return false;
    }

    const level = user.level ?? user.current_level ?? 0;
    const xp = user.xp ?? user.total_xp ?? 0;

    // Check level requirement
    if (requirements.level && level < requirements.level) {
      return false;
    }

    // Check XP requirement
    if (requirements.xp && xp < requirements.xp) {
      return false;
    }

    // Check previous module completion
    if (requirements.previous_module) {
      const prevProgress = await queryRow(
        `SELECT * FROM user_module_progress 
         WHERE user_id = $1 
           AND module_id = (
             SELECT id FROM course_modules 
             WHERE module_number = $2
           )
           AND status = 'completed'`,
        [user.user_id, requirements.previous_module]
      );

      if (!prevProgress) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get module details with videos
   */
  async getModule(moduleId, userId) {
    const module = await queryRow(
      'SELECT * FROM course_modules WHERE id = $1',
      [moduleId]
    );

    if (!module) {
      return null;
    }

    const videos = await queryRows(
      'SELECT * FROM course_videos WHERE module_id = $1 ORDER BY video_number',
      [moduleId]
    );

    const progress = await this.getModuleProgress(userId, moduleId);

    // Get video progress
    for (const video of videos) {
      const videoProgress = await queryRow(
        'SELECT * FROM user_video_progress WHERE user_id = $1 AND video_id = $2',
        [userId, video.id]
      );

      video.progress =
        videoProgress || { watched: false, watch_time_seconds: 0 };
    }

    return {
      ...module,
      videos,
      progress:
        progress || {
          status: 'locked',
          videos_watched: 0,
          completion_percentage: 0,
        },
    };
  }

  /**
   * Start module
   */
  async startModule(userId, moduleId) {
    const user = await this.getUserSafe(userId);
    const module = await queryRow(
      'SELECT * FROM course_modules WHERE id = $1',
      [moduleId]
    );

    if (!module) {
      return { success: false, error: 'Module not found' };
    }

    // Check if unlocked
    const isUnlocked = await this.checkModuleUnlock(user, module, userId);
    if (!isUnlocked) {
      return {
        success: false,
        error: 'Module is locked. Complete requirements to unlock.',
      };
    }

    // Create or update progress
    await query(
      `INSERT INTO user_module_progress (user_id, module_id, status, started_at)
       VALUES ($1, $2, 'in_progress', NOW())
       ON CONFLICT (user_id, module_id)
       DO UPDATE SET status = 'in_progress', started_at = NOW()`,
      [userId, moduleId]
    );

    logger.info('Module started', { userId, moduleId });

    return { success: true };
  }

  /**
   * Mark video as watched
   */
  async markVideoWatched(userId, videoId, watchTimeSeconds = 0) {
    const video = await queryRow(
      'SELECT * FROM course_videos WHERE id = $1',
      [videoId]
    );

    if (!video) {
      return { success: false, error: 'Video not found' };
    }

    // Update video progress
    await query(
      `INSERT INTO user_video_progress (user_id, video_id, watched, watch_time_seconds, completed_at)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (user_id, video_id)
       DO UPDATE SET watched = true, watch_time_seconds = $3, completed_at = NOW()`,
      [userId, videoId, watchTimeSeconds]
    );

    // Update module progress
    await this.updateModuleProgress(userId, video.module_id);

    logger.info('Video marked as watched', { userId, videoId });

    return { success: true };
  }

  /**
   * Update module completion percentage
   */
  async updateModuleProgress(userId, moduleId) {
    const module = await queryRow(
      'SELECT * FROM course_modules WHERE id = $1',
      [moduleId]
    );
    const totalVideos = module.total_videos;

    if (totalVideos === 0) return;

    // Count watched videos
    const watchedCount = await queryRow(
      `SELECT COUNT(*) as count FROM user_video_progress uvp
       JOIN course_videos cv ON uvp.video_id = cv.id
       WHERE uvp.user_id = $1 AND cv.module_id = $2 AND uvp.watched = true`,
      [userId, moduleId]
    );

    const watched = parseInt(watchedCount.count);
    const percentage = Math.floor((watched / totalVideos) * 100);
    const isCompleted = percentage === 100;

    await query(
      `UPDATE user_module_progress 
       SET videos_watched = $1, 
           completion_percentage = $2,
           status = $3,
           completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
       WHERE user_id = $4 AND module_id = $5`,
      [watched, percentage, isCompleted ? 'completed' : 'in_progress', userId, moduleId]
    );

    // Award XP for module completion
    if (isCompleted && this.secondaryXPProcessor) {
      const progress = await this.getModuleProgress(userId, moduleId);

      // Check if already awarded XP
      if (
        !progress.completed_at ||
        new Date(progress.completed_at) < new Date(Date.now() - 5000)
      ) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          userId,
          'course',
          'completeModule',
          { moduleId, moduleNumber: module.module_number }
        );
      }
    }
  }

  /**
   * Get module progress
   */
  async getModuleProgress(userId, moduleId) {
    return await queryRow(
      'SELECT * FROM user_module_progress WHERE user_id = $1 AND module_id = $2',
      [userId, moduleId]
    );
  }

  /**
   * Get user's overall course progress
   */
  async getUserCourseProgress(userId) {
    const totalModules = await queryRow(
      'SELECT COUNT(*) as count FROM course_modules WHERE is_active = true'
    );
    const completedModules = await queryRow(
      `SELECT COUNT(*) as count FROM user_module_progress 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    const total = parseInt(totalModules.count);
    const completed = parseInt(completedModules.count);

    return {
      totalModules: total,
      completedModules: completed,
      overallPercentage:
        total > 0 ? Math.floor((completed / total) * 100) : 0,
    };
  }

  /**
   * Submit question
   */
  async submitQuestion(userId, moduleId, videoId, question) {
    const result = await queryRow(
      `INSERT INTO course_questions (user_id, module_id, video_id, question)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, moduleId, videoId, question]
    );

    logger.info('Course question submitted', {
      userId,
      questionId: result.id,
    });

    return result;
  }

  /**
   * Get unanswered questions (for admin)
   */
  async getUnansweredQuestions(limit = 20) {
    return await queryRows(
      `SELECT q.*, u.username, m.title as module_title, v.title as video_title
       FROM course_questions q
       LEFT JOIN users u ON q.user_id = u.user_id
       LEFT JOIN course_modules m ON q.module_id = m.id
       LEFT JOIN course_videos v ON q.video_id = v.id
       WHERE q.answered = false
       ORDER BY q.asked_at ASC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Answer question (admin)
   */
  async answerQuestion(questionId, answer) {
    await query(
      `UPDATE course_questions 
       SET answer = $1, answered = true, answered_at = NOW()
       WHERE id = $2`,
      [answer, questionId]
    );

    const question = await queryRow(
      'SELECT * FROM course_questions WHERE id = $1',
      [questionId]
    );

    logger.info('Course question answered', { questionId });

    return question;
  }
}

module.exports = CourseManager;
