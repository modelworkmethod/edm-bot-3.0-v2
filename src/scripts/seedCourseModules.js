

require('dotenv').config();
const { query, initializePool, closePool } = require('../database/postgres');
const settings = require('../config/settings');
const { createLogger } = require('../utils/logger');

const logger = createLogger('seedCourse');

// Set Data 

const modules = [
    {
        module_number: 1,
        title: 'Introduction to EDM',
        description: 'Welcome to the Embodied Dating Course.',
        total_videos: 2,
        estimated_time_minutes: 25,
        unlock_requirements: { level:1, xp: 0, previous_module: null },
        is_active: true,
        videos: [
            {
                video_number: 1,
                title: 'What to Expect',
                description: 'Overview of the course structure and goals.',
                video_url: 'https://youtube.com/',
                duration_minutes: 10,
                transcript: null,
                key_concpets: ['oriantation', 'outcomes']
            },
            {
                video_number: 2,
                title: 'Settings Foundations',
                description: 'Mindset and goals setup',
                video_url: 'https://youtube.com/',
                duration_minutes: 15,
                transcript: null,
                key_concpets: ['mindset', 'goals']
            }
        ]
    },
    {
        module_number: 2,
        title: 'Mindset Fundamentals',
        description: 'Core beliefs and habits',
        total_videos: 2,
        estimated_duration_minutes: 30,
        unlock_requirements: { level:2, xp: 300, previous_module: 1 },
        is_active: true,
        videos: [
            {
                video_number: 1,
                title: 'Belief Systems',
                description: 'How beliefs shape your interactions',
                video_url: 'https://youtube.com/',
                duration_minutes: 12,
                transcript: null,
                key_concpets: ['beliefs', 'self-talk']
            },
            {
                video_number: 2,
                title: 'Habit Loops',
                description: 'Daily practice for social momentum',
                video_url: 'https://youtube.com/',
                duration_minutes: 18,
                transcript: null,
                key_concpets: ['habits', 'momentum'] 
            }
        ]
    }
];

// Helpers

async function upsertModule(m) {
    const insertModuleSQL = `
    INSERT INTO course_modules (
      module_number, title, description, total_videos, estimated_duration_minutes, unlock_requirements, is_active, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
    ON CONFLICT (module_number)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      total_videos = EXCLUDED.total_videos,
      estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
      unlock_requirements = EXCLUDED.unlock_requirements,
      is_active = EXCLUDED.is_active
    RETURNING id;
  `;

  const values = [
    m.module_number,
    m.title,
    m.description || null,
    m.total_videos || 0,
    m.estimated_duration_minutes || null,
    m.unlock_requirements ? JSON.stringify(m.unlock_requirements) : null,
    m.is_active || false
  ];

  const { rows } = await query(insertModuleSQL, values);
  return rows[0].id;
}


async function upsertVideo(moduleId, v) {
  const insertVideoSQL = `
    INSERT INTO course_videos (
      module_id, video_number, title, description, video_url, duration_minutes, transcript, key_concepts, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
    ON CONFLICT (module_id, video_number)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      video_url = EXCLUDED.video_url,
      duration_minutes = EXCLUDED.duration_minutes,
      transcript = EXCLUDED.transcript,
      key_concepts = EXCLUDED.key_concepts
    RETURNING id;
  `;

  const values = [
    moduleId,
    v.video_number,
    v.title,
    v.description || null,
    v.video_url,
    v.duration_minutes || null,
    v.transcript | null,
    Array.isArray(v.key_concepts) ?  v.key_concepts : null
  ];

  await query(insertVideoSQL, values);
}

(async () => {
  logger.info('Starting course modules seeding process...');
  try {
    await initializePool(settings.database.pg || settings.database);

    for (const m of modules) {
      const moduleId = await upsertModule(m);
      logger.info(`Module upserted`, { module_number: m.module_number, moduleId });

      if (Array.isArray(m.videos)) {
        for (const v of m.videos) {
          await upsertVideo(moduleId, v);
          logger.info(`  Video upserted`, { module_number: m.module_number, video_number: v.video_number });
        }
      }
    }

    logger.info('Course modules seeded successfully');
  } catch (err) {
    logger.error('Error during course modules seeding:', { error: err.message });
  } finally {
    await closePool();
    logger.info('Database connection closed.');
  }
})();