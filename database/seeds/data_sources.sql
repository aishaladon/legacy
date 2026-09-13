INSERT IGNORE INTO data_sources (name, source_type, url, is_active, check_interval, notes) VALUES
('SAM.gov',         'API',       'https://api.sam.gov/opportunities/v2/search',        1, 24, 'Federal solicitations API — SAM_GOV_API_KEY required in .env'),
('USASpending.gov', 'API',       'https://api.usaspending.gov',                         1, 24, 'Award history and expiring contracts — no key required'),
('ArchiveGig',      'Web Scrape','https://archivegig.com',                              1, 24, 'Archival gig and consulting postings'),
('SAA Job Board',   'Web Scrape','https://careers.archivists.org',                      1, 24, 'Society of American Archivists'),
('ALA Job Board',   'Web Scrape','https://joblist.ala.org',                             1, 24, 'American Library Association'),
('AAM Job Board',   'Web Scrape','https://www.aam-us.org/professional-resources/jobs',  1, 24, 'American Alliance of Museums'),
('IMLS Grants',     'Web Scrape','https://www.imls.gov/grants/awarded-grants',          1, 24, 'Institute of Museum and Library Services — award announcements'),
('NEH Grants',      'Web Scrape','https://www.neh.gov/grants/recent-awards',            1, 24, 'National Endowment for the Humanities'),
('Email Inbox',     'Email',     NULL,                                                   1,  1, 'Parses info@legacypnp.ltd via IMAP — IMAP_* vars in .env');
