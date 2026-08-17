// Run once to create all tables: node server/setup-db.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });
const mysql = require('mysql2/promise');

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.MYSQL_HOST     || 'localhost',
    port:     Number(process.env.MYSQL_PORT || 3306),
    user:     process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  console.log('Connected. Creating tables...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(255),
      plan          VARCHAR(50)  DEFAULT 'basic',
      created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS people (
      id                   INT AUTO_INCREMENT PRIMARY KEY,
      user_id              INT NOT NULL,
      full_name            VARCHAR(255),
      birth_name           VARCHAR(255),
      also_known_as        VARCHAR(255),
      sex                  VARCHAR(50),
      race_ethnicity       VARCHAR(255),
      birth_date           VARCHAR(100),
      birth_place          VARCHAR(255),
      death_date           VARCHAR(100),
      death_place          VARCHAR(255),
      burial_place         VARCHAR(255),
      generation_number    VARCHAR(50),
      relation_to_self     VARCHAR(255),
      line                 VARCHAR(50),
      ancestry_profile_url VARCHAR(500),
      family_search_id     VARCHAR(100),
      geni_profile_url     VARCHAR(500),
      photo_url            VARCHAR(500),
      notes                TEXT,
      how_known            ENUM('documented','inferred','oral','carried','contested','absent','synthetic') DEFAULT 'inferred',
      custodian            VARCHAR(255),
      created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS family_connections (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      user_id   INT NOT NULL,
      child_id  INT NOT NULL,
      father_id INT,
      mother_id INT,
      UNIQUE KEY uq_child (user_id, child_id),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS research_questions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      question      TEXT,
      research_type VARCHAR(100),
      status        VARCHAR(100),
      priority      VARCHAR(50),
      date_opened   VARCHAR(100),
      date_resolved VARCHAR(100),
      conclusion    TEXT,
      next_action   TEXT,
      notes         TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS sources (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      user_id         INT NOT NULL,
      name            VARCHAR(500),
      source_type     VARCHAR(100),
      repository      VARCHAR(255),
      url             VARCHAR(500),
      full_citation   TEXT,
      short_citation  TEXT,
      date_of_source  VARCHAR(100),
      date_accessed   VARCHAR(100),
      notes           TEXT,
      source_file_url VARCHAR(500),
      how_known       ENUM('documented','inferred','oral','carried','contested','absent','synthetic') DEFAULT 'documented',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS research_log (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      title      VARCHAR(500),
      date       VARCHAR(100),
      summary    TEXT,
      notes      TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS dna_testing (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      name       VARCHAR(255),
      company    VARCHAR(100),
      test_date  VARCHAR(100),
      kit_number VARCHAR(100),
      notes      TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS dna_matches (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      user_id      INT NOT NULL,
      match_name   VARCHAR(255),
      shared_cm    DECIMAL(10,2),
      relationship VARCHAR(100),
      company      VARCHAR(100),
      notes        TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS archives (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      name        VARCHAR(500),
      description TEXT,
      image_url   VARCHAR(500),
      metadata    JSON,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS collections (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      name        VARCHAR(500),
      description TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  // Add how_known/custodian to existing tables (safe on re-run)
  const migrations = [
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS how_known ENUM('documented','inferred','oral','carried','contested','absent','synthetic') DEFAULT 'inferred'`,
    `ALTER TABLE people ADD COLUMN IF NOT EXISTS custodian VARCHAR(255)`,
    `ALTER TABLE sources ADD COLUMN IF NOT EXISTS how_known ENUM('documented','inferred','oral','carried','contested','absent','synthetic') DEFAULT 'documented'`,
    `ALTER TABLE research_log ADD COLUMN IF NOT EXISTS how_known ENUM('documented','inferred','oral','carried','contested','absent','synthetic') DEFAULT 'inferred'`,
  ];
  for (const sql of migrations) {
    try { await conn.query(sql); } catch (err) { /* column may already exist */ }
  }

  for (const sql of tables) {
    const tableName = (sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/) || [])[1];
    try {
      await conn.query(sql);
      console.log(`  + ${tableName}`);
    } catch (err) {
      console.error(`  ! ${tableName}: ${err.message}`);
      throw err;
    }
  }

  console.log('All tables created successfully.');
  await conn.end();
}

setup().catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
