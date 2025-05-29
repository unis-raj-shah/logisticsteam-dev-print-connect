const initSQLList = [
    `CREATE TABLE auto_sorting_label (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT,
        curId NUMERIC,
        platform TEXT,
        createdWhen TEXT,
        updatedWhen TEXT,
        createdAt BIGINT DEFAULT (strftime('%s', 'now')),
        updatedAt BIGINT
    )`,
    `CREATE TABLE print_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        username TEXT NOT NULL,
        printerName TEXT NOT NULL,
        content TEXT NOT NULL,
        dnNumber TEXT UNIQUE,
        jobId TEXT,
        status TEXT NOT NULL,
        error TEXT,
        copies INTEGER DEFAULT 1,
        createdAt BIGINT DEFAULT (strftime('%s', 'now')),
        updatedAt BIGINT
    )`,
    `CREATE INDEX idx_print_logs_timestamp ON print_logs(timestamp)`,
    `CREATE INDEX idx_print_logs_username ON print_logs(username)`,
    `CREATE INDEX idx_print_logs_dnNumber ON print_logs(dnNumber)`,
    `CREATE INDEX idx_print_logs_jobId ON print_logs(jobId)`
]; 