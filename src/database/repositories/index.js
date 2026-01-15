/**
 * Repository index
 * Central export for all repositories
 */

const { getPool } = require('../postgres');

const UserRepository = require('./UserRepository.js');
const StatsRepository = require('./StatsRepository.js');
const TenseyRepository = require('./TenseyRepository.js');

// Singleton instances
let userRepo = null;
let statsRepo = null;
let tenseyRepo = null;

function buildRepositories(pool) {
  if (!pool) throw new Error('Repository init: pool not available');

  if (!userRepo) userRepo = new UserRepository(pool);

  // StatsRepository uses query/queryRow helpers from ../postgres (global)
  if (!statsRepo) statsRepo = new StatsRepository();

  if (!tenseyRepo) tenseyRepo = new TenseyRepository(pool);

  return {
    user: userRepo,
    users: userRepo, // alias
    stats: statsRepo,
    tensey: tenseyRepo
  };
}

function initializeRepositories() {
  const pool = getPool();
  return buildRepositories(pool);
}

function getRepositories() {
  const pool = getPool();
  return buildRepositories(pool);
}

module.exports = {
  initializeRepositories,
  getRepositories,
  UserRepository,
  StatsRepository,
  TenseyRepository
};
