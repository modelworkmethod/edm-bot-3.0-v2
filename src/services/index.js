// src/services/index.js
/**
 * Services Index
 * Centralized service initialization + service locator (with aliases)
 */

const { createLogger } = require('../utils/logger');
const { initializeRepositories, getRepositories } = require('../database/repositories');
const { withServiceAliases } = require('../events/interactionCreate/withServiceAliases');

const WinsMonitor = require('./wins/WinsMonitor');

const logger = createLogger('ServiceInitializer');

let _rawServices = null;
let _aliasedServices = null;

function setCurrentServices(services) {
  _rawServices = services || {};
  _aliasedServices = withServiceAliases(_rawServices);
  logger.info('Service locator hydrated', {
    hasAdmin: !!_aliasedServices?.admin,
    hasChannel: !!_aliasedServices?.channel,
  });
}

function getRawServices() {
  return _rawServices;
}

function getServices() {
  if (!_aliasedServices) {
    _aliasedServices = withServiceAliases({});
  }
  return _aliasedServices;
}

async function initializeServices(client, config, repositories) {
  logger.info('Initializing all services...');

  // Ensure repositories
  if (!repositories || !repositories.user) {
    initializeRepositories();
    repositories = getRepositories();
  }
  if (!repositories || !repositories.user) {
    throw new Error('Repositories not initialized properly');
  }

  // Core XP / Levels
  const { XPCalculator } = require('./xp/XPCalculator');
  const settings = require('../config/settings');
  const LCmod = require('./xp/LevelCalculator');
  const LevelCalculator = LCmod?.default || LCmod.LevelCalculator || LCmod;
  const MultiplierService = require('./xp/MultiplierService');

  // User / Archetype
  const UserService = require('./user/UserService');
  const ArchetypeService = require('./user/ArchetypeService');

  // Stats
  const StatsProcessor = require('./stats/StatsProcessor');
  const StatsEditService = require('./stats/StatsEditService');

  // Discord services
  const ChannelService = require('./discord/ChannelService');
  const MessageService = require('./discord/MessageService');
  const RoleService = require('./discord/RoleService');
  const NicknameService = require('./discord/NicknameService');

  // Notifications
  const AnnouncementQueue = require('./notifications/AnnouncementQueue');
  const ReminderService = require('./notifications/ReminderService');

  // Tensey
  const TenseyManager = require('./tensey/TenseyManager');

  // Factions
  const FactionService = require('./factions/FactionService');

  // Raids / Barbie / Onboarding / Texting
  const RaidManager = require('./raids/RaidManager');
  const BarbieListManager = require('./barbie/BarbieListManager');
  const OnboardingChatbot = require('./onboarding/OnboardingChatbot');
  const TextingSimulator = require('./texting/TextingSimulator');
  const TextingService = require('./texting/TextingService');

  // XP / Duels / Events
  const SecondaryXPProcessor = require('./xp/SecondaryXPProcessor');
  const DuelManager = require('./duels/DuelManager');
  const DoubleXPManager = require('./events/DoubleXPManager');

  // CTJ / Engagement
  const CTJMonitor = require('./ctj/CTJMonitor');
  const CTJAnalyzer = require('./ctj/CTJAnalyzer');
  const CTJService = require('./ctj/CTJService');
  const ChatEngagementMonitor = require('./engagement/ChatEngagementMonitor');

  // Courses
  const CourseManager = require('./course/CourseManager');

  // Leaderboard
  const LeaderboardService = require('./leaderboard/LeaderboardService');

  // Wingman
  const WingmanMatcher = require('./wingman/WingmanMatcher');

  // Faction balance / Role sync
  const FactionBalancer = require('./factions/FactionBalancer');
  const RoleSync = require('./discord/RoleSync');

  // Middleware
  const RateLimiter = require('../middleware/RateLimiter');
  const PermissionGuard = require('../middleware/PermissionGuard');

  // Security & Ops
  const WarningSystem = require('./security/WarningSystem');
  const ContentModerator = require('./security/ContentModerator');
  const BackupManager = require('./backup/BackupManager');
  const HealthCheck = require('./monitoring/HealthCheck');

  // Analytics
  const RiskScorer = require('./analytics/RiskScorer');
  const PatternDetector = require('./analytics/PatternDetector');
  const InterventionGenerator = require('./analytics/InterventionGenerator');

  // --- Discord service instances ---
  const channelService = new ChannelService(client);
  const messageService = new MessageService(client);
  const roleService = new RoleService(client);

  // Leaderboard
  const leaderboardService = new LeaderboardService();

  // Notifications
  const announcementQueue = new AnnouncementQueue(channelService);
  const reminderService = new ReminderService(client, repositories);

  // User / Archetype / XP
  const archetypeService = new ArchetypeService();
  const levelCalculatorInstance = new LevelCalculator(settings.xp || { baseAmount: 300, perLevel: 50 });

  const userService = new UserService(
    repositories,
    archetypeService,
    levelCalculatorInstance
  );

  const nicknameService = new NicknameService(client, userService, leaderboardService);
  userService.setNicknameService(nicknameService);

  const multiplierService = new MultiplierService(repositories);

  // Duel manager MUST be created with userService + channelService + repositories + announcementQueue
  const duelManager = new DuelManager(userService, channelService, repositories, announcementQueue);

  // Secondary XP & stats
  const secondaryXPProcessor = new SecondaryXPProcessor(repositories, userService);
  const statsProcessor = new StatsProcessor(repositories, userService, duelManager, channelService);
  const statsEditService = new StatsEditService(repositories);

  // Raids
  const raidManager = new RaidManager(channelService, repositories, announcementQueue);

  // Tensey
  const tenseyManager = new TenseyManager(repositories.tensey, userService, archetypeService);

  // Barbie / Onboarding / Texting
  const barbieListManager = new BarbieListManager(secondaryXPProcessor);
  const onboardingChatbot = new OnboardingChatbot();
  const textingSimulator = new TextingSimulator(repositories, secondaryXPProcessor);
  const textingService = new TextingService(textingSimulator);

  // Factions
  const factionService = new FactionService(repositories, channelService);
  const factionBalancer = new FactionBalancer(repositories.user);
  const roleSync = new RoleSync();

  // Wingman
  const wingmanMatcher = new WingmanMatcher(userService);

  // Double XP Events
  const doubleXPManager = new DoubleXPManager(channelService);

  // CTJ / Engagement
  const ctjAnalyzer = new CTJAnalyzer(channelService, secondaryXPProcessor);
  const ctjMonitor = new CTJMonitor(secondaryXPProcessor, ctjAnalyzer);
  const ctjService = new CTJService(ctjAnalyzer, secondaryXPProcessor);

  const chatEngagementMonitor = new ChatEngagementMonitor(secondaryXPProcessor, channelService);

  // ✅ NEW Wins Monitor (Share-your-wins)
  const winsMonitor = new WinsMonitor({
    channelService,
    winsChannelId: process.env.WINS_CHANNEL_ID || '1426640532318454043',
    secondaryXPProcessor,
  });

  // CTJ Image Awarder setup
  const CTJImageAwarder = require('./ctj/CTJImageAwarder');
  const ctjImageAwarder = new CTJImageAwarder({ statsProcessor });

  // ✅ Journal Entries Image Awarder (+100 XP)
  const JournalImageAwarder = require('./journal/JournalImageAwarder');

  const journalEntriesId = process.env.JOURNAL_ENTRIES_CHANNEL_ID;
  const ctjId = process.env.CONFIDENCE_TENSION_JOURNAL_CHANNEL_ID;

  const journalImageAwarder = new JournalImageAwarder({
    userService,
    processedMsgsRepo: repositories.processedMsgs || repositories.processedMsgsRepo || null, // ✅ usa el nombre real
    channelIds: [journalEntriesId, ctjId].filter(Boolean),
    xpAmount: Number(process.env.JOURNAL_PHOTO_XP || 100),
    cooldownMs: Number(process.env.JOURNAL_PHOTO_XP_COOLDOWN_HOURS || 0) * 60 * 60 * 1000,
    sendConfirmationMessage: true,
    debug: false,
  });


  // Courses
  const courseManager = new CourseManager(userService, secondaryXPProcessor);

  // Middleware
  const rateLimiter = new RateLimiter();
  const permissionGuard = new PermissionGuard(config);

  // Security & Ops
  const warningSystem = new WarningSystem(channelService);
  const contentModerator = new ContentModerator();
  const backupManager = new BackupManager(config);
  const healthCheck = new HealthCheck(client);

  // Analytics
  const riskScorer = new RiskScorer(userService);
  const patternDetector = new PatternDetector(userService);
  const interventionGenerator = new InterventionGenerator(userService);

  // Optional schedulers
  if (process.env.SECOPS_ENABLE_HEALTHCHECKS === 'true') {
    const interval = parseInt(process.env.SECOPS_HEALTHCHECK_INTERVAL_MIN || '5', 10);
    healthCheck.scheduleChecks(interval);
    logger.info(`✓ Health checks scheduled (every ${interval} minutes)`);
  }

  if (process.env.SECOPS_ENABLE_AUTOBACKUP === 'true') {
    backupManager.scheduleAutoBackup();
    logger.info('✓ Auto-backup scheduled (daily at 3 AM)');
  }

  logger.info('✓ All services initialized');

  // ✅ Build services object LAST (after all instances exist)
  const services = {
    repositories: {
      ...repositories,
      users: repositories.user, // ✅ legacy alias (StatsProcessor expects this)
      user: repositories.user,
      stats: repositories.stats,
      tensey: repositories.tensey,
    },

    // Core
    xpCalculator: XPCalculator,
    levelCalculator: levelCalculatorInstance,
    multiplierService,
    userService,
    archetypeService,
    statsProcessor,
    statsEditService,
    leaderboardService,

    // Discord
    channelService,
    messageService,
    roleService,
    nicknameService,

    // Notifications
    announcementQueue,
    reminderService,

    // Features
    tenseyManager,
    raidManager,
    barbieListManager,
    onboardingChatbot,
    textingSimulator,
    textingService,
    factionService,
    factionBalancer,
    roleSync,
    wingmanMatcher,

    // Duels & XP
    secondaryXPProcessor,
    duelManager,
    doubleXPManager,

    // CTJ & Engagement
    ctjMonitor,
    ctjAnalyzer,
    ctjService,
    ctjImageAwarder,
    chatEngagementMonitor,
    winsMonitor,

    // ✅ Journal Entries (+100 XP)
    journalImageAwarder,


    // Courses
    courseManager,

    // Middleware
    rateLimiter,
    permissionGuard,

    // Security & Ops
    warningSystem,
    contentModerator,
    backupManager,
    healthCheck,

    // Analytics
    riskScorer,
    patternDetector,
    interventionGenerator,
  };

  setCurrentServices(services);
  return services;
}

const exported = new Proxy(
  {},
  {
    get(_t, prop) {
      const svc = getServices();
      return svc[prop];
    },
    has(_t, prop) {
      const svc = getServices();
      return prop in svc;
    },
    getOwnPropertyDescriptor() {
      return { configurable: true, enumerable: true };
    },
  }
);

module.exports = {
  initializeServices,
  setCurrentServices,
  getServices,
  getRawServices,
  // Export proxy if you use it elsewhere
  ...exported,
};
