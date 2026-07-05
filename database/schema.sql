-- Legacy P&P BD Workspace — Database Schema
-- Run via: node init_db.js
-- MySQL 5.7+ / MariaDB 10.4+

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS naics_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(10)  NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  is_primary  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS keywords (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  keyword     VARCHAR(100) NOT NULL UNIQUE,
  priority    ENUM('High','Medium','Low') NOT NULL DEFAULT 'Medium',
  category    VARCHAR(50)  DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,
  value        TEXT         DEFAULT NULL,
  setting_type VARCHAR(20)  NOT NULL DEFAULT 'Text',
  description  VARCHAR(255) DEFAULT NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS data_sources (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  source_type    VARCHAR(50)  NOT NULL,
  url            VARCHAR(500) DEFAULT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  check_interval INT          NOT NULL DEFAULT 24,
  last_checked   DATETIME     DEFAULT NULL,
  notes          TEXT         DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funders (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  name                     VARCHAR(200) NOT NULL,
  funder_type              ENUM('Federal','State','Foundation','Corporate','Other') NOT NULL DEFAULT 'Foundation',
  website                  VARCHAR(500) DEFAULT NULL,
  eligible_institution_types TEXT       DEFAULT NULL,
  notes                    TEXT         DEFAULT NULL,
  is_active                TINYINT(1)   NOT NULL DEFAULT 1,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institutions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  institution_type VARCHAR(100) DEFAULT NULL,
  city             VARCHAR(100) DEFAULT NULL,
  state            VARCHAR(50)  DEFAULT NULL,
  region           VARCHAR(100) DEFAULT NULL,
  website          VARCHAR(500) DEFAULT NULL,
  notes            TEXT         DEFAULT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  institution_id INT          DEFAULT NULL,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  title          VARCHAR(150) DEFAULT NULL,
  email          VARCHAR(200) DEFAULT NULL,
  phone          VARCHAR(30)  DEFAULT NULL,
  linkedin       VARCHAR(300) DEFAULT NULL,
  notes          TEXT         DEFAULT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunities (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(300) NOT NULL,
  opportunity_type  ENUM('Government Contract','Grant','Job','Subcontract','Other') NOT NULL DEFAULT 'Other',
  source            VARCHAR(100) DEFAULT NULL,
  source_url        VARCHAR(500) DEFAULT NULL,
  posted_date       DATE         DEFAULT NULL,
  due_date          DATE         DEFAULT NULL,
  amount_min        DECIMAL(15,2) DEFAULT NULL,
  amount_max        DECIMAL(15,2) DEFAULT NULL,
  description       TEXT         DEFAULT NULL,
  region            VARCHAR(100) DEFAULT NULL,
  alignment_score   DECIMAL(4,1) DEFAULT NULL,
  alignment_notes   TEXT         DEFAULT NULL,
  status            ENUM('New','Reviewing','Pursuing','Submitted','Awarded','Not Pursuing','Closed') NOT NULL DEFAULT 'New',
  is_starred        TINYINT(1)   NOT NULL DEFAULT 0,
  institution_id    INT          DEFAULT NULL,
  contact_id        INT          DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id)     REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS government_contracts (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id       INT          NOT NULL UNIQUE,
  solicitation_number  VARCHAR(100) DEFAULT NULL,
  agency               VARCHAR(200) DEFAULT NULL,
  sub_agency           VARCHAR(200) DEFAULT NULL,
  naics_code           VARCHAR(10)  DEFAULT NULL,
  set_aside            VARCHAR(100) DEFAULT NULL,
  contract_type        VARCHAR(100) DEFAULT NULL,
  place_of_performance VARCHAR(200) DEFAULT NULL,
  sam_notice_id        VARCHAR(100) DEFAULT NULL,
  active_award_id      VARCHAR(100) DEFAULT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grant_opportunities (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id       INT          NOT NULL UNIQUE,
  funder_id            INT          DEFAULT NULL,
  grant_number         VARCHAR(100) DEFAULT NULL,
  program_name         VARCHAR(200) DEFAULT NULL,
  eligible_applicants  TEXT         DEFAULT NULL,
  match_required       TINYINT(1)   NOT NULL DEFAULT 0,
  match_percentage     DECIMAL(5,2) DEFAULT NULL,
  application_portal   VARCHAR(500) DEFAULT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (funder_id)      REFERENCES funders(id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pipeline (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id  INT          NOT NULL UNIQUE,
  stage           ENUM('Identified','Qualified','Pursuing','Proposal In Progress','Submitted','Negotiating','Awarded','Lost','Withdrawn') NOT NULL DEFAULT 'Identified',
  probability     TINYINT      DEFAULT NULL COMMENT '0-100%',
  expected_value  DECIMAL(15,2) DEFAULT NULL,
  go_no_go_notes  TEXT         DEFAULT NULL,
  next_action     VARCHAR(300) DEFAULT NULL,
  next_action_date DATE        DEFAULT NULL,
  assigned_to     VARCHAR(100) DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id      INT          DEFAULT NULL,
  institution_id      INT          DEFAULT NULL,
  title               VARCHAR(300) NOT NULL,
  project_type        ENUM('Government Contract','Grant','Subcontract','Other') NOT NULL DEFAULT 'Other',
  status              ENUM('Active','On Hold','Complete','Cancelled') NOT NULL DEFAULT 'Active',
  start_date          DATE         DEFAULT NULL,
  end_date            DATE         DEFAULT NULL,
  contract_value      DECIMAL(15,2) DEFAULT NULL,
  contract_number     VARCHAR(100) DEFAULT NULL,
  co_pi               VARCHAR(200) DEFAULT NULL,
  deliverables_notes  TEXT         DEFAULT NULL,
  notes               TEXT         DEFAULT NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)  ON DELETE SET NULL,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS award_history (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(300) NOT NULL,
  award_type     ENUM('Government Contract','Grant','Subcontract','Other') NOT NULL DEFAULT 'Other',
  agency_funder  VARCHAR(200) DEFAULT NULL,
  institution_id INT          DEFAULT NULL,
  award_number   VARCHAR(100) DEFAULT NULL,
  naics_code     VARCHAR(10)  DEFAULT NULL,
  amount         DECIMAL(15,2) DEFAULT NULL,
  period_start   DATE         DEFAULT NULL,
  period_end     DATE         DEFAULT NULL,
  set_aside      VARCHAR(100) DEFAULT NULL,
  notes          TEXT         DEFAULT NULL,
  source_url     VARCHAR(500) DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bid_writing_guides (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(300) NOT NULL,
  opportunity_type ENUM('Government Contract','Grant','RFP','NOFO','Other') NOT NULL DEFAULT 'Other',
  content         LONGTEXT     NOT NULL,
  is_template     TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order      INT          NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capability_statements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  version_name    VARCHAR(100) NOT NULL,
  audience        VARCHAR(200) DEFAULT NULL,
  content         LONGTEXT     NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_digests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  sent_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recipient       VARCHAR(200) DEFAULT NULL,
  subject         VARCHAR(300) DEFAULT NULL,
  opportunities_count INT      NOT NULL DEFAULT 0,
  body_html       LONGTEXT     DEFAULT NULL,
  status          ENUM('Sent','Failed','Skipped') NOT NULL DEFAULT 'Sent',
  error_message   TEXT         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  record_type     VARCHAR(50)  NOT NULL,
  record_id       INT          NOT NULL,
  filename        VARCHAR(300) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  file_size       INT          DEFAULT NULL,
  mime_type       VARCHAR(100) DEFAULT NULL,
  notes           TEXT         DEFAULT NULL,
  uploaded_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  record_type     VARCHAR(50)  NOT NULL,
  record_id       INT          DEFAULT NULL,
  action          VARCHAR(100) NOT NULL,
  description     TEXT         DEFAULT NULL,
  performed_by    VARCHAR(100) DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
