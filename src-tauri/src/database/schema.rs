pub const SCHEMA: &str = r#"
-- 按键记录表 (主表)
CREATE TABLE IF NOT EXISTS keystrokes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,           -- Unix 毫秒时间戳
    key_code INTEGER NOT NULL,
    key_name TEXT NOT NULL,
    key_type TEXT NOT NULL,               -- char/function/modifier/navigation/editing/system
    app_name TEXT,
    app_category TEXT,                    -- ide/browser/terminal/chat/office/other
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 按键时间索引 (查询速度优化)
CREATE INDEX IF NOT EXISTS idx_keystrokes_timestamp ON keystrokes(timestamp);
CREATE INDEX IF NOT EXISTS idx_keystrokes_app_category ON keystrokes(app_category);

-- 每日统计汇总表 (减少查询压力)
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,                -- YYYY-MM-DD
    total_keystrokes INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0,
    code_keystrokes INTEGER DEFAULT 0,    -- IDE中的按键数
    browser_keystrokes INTEGER DEFAULT 0,
    terminal_keystrokes INTEGER DEFAULT 0,
    chat_keystrokes INTEGER DEFAULT 0,
    other_keystrokes INTEGER DEFAULT 0,
    work_duration INTEGER DEFAULT 0,      -- 工作时长(秒)
    goal_achieved BOOLEAN DEFAULT FALSE
);

-- 小时统计表 (生成图表用)
CREATE TABLE IF NOT EXISTS hourly_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                   -- YYYY-MM-DD
    hour INTEGER NOT NULL,                -- 0-23
    keystroke_count INTEGER DEFAULT 0,
    UNIQUE(date, hour)
);

-- 工资配置表
CREATE TABLE IF NOT EXISTS salary_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- 只允许一条记录
    monthly_salary REAL NOT NULL DEFAULT 0,
    work_days_per_month INTEGER DEFAULT 22,
    work_hours_per_day REAL DEFAULT 8,
    work_start_time TEXT DEFAULT '09:00',  -- HH:MM
    work_end_time TEXT DEFAULT '18:00',
    lunch_break_minutes INTEGER DEFAULT 60, -- 午休时间(分钟)
    currency TEXT DEFAULT 'CNY'
);

-- 应用分类自定义表
CREATE TABLE IF NOT EXISTS app_categories (
    app_name TEXT PRIMARY KEY,
    category TEXT NOT NULL
);

-- 隐私设置表
CREATE TABLE IF NOT EXISTS privacy_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pause_during_sensitive BOOLEAN DEFAULT TRUE,
    exclude_apps TEXT DEFAULT '[]',
    sensitive_window_keywords TEXT DEFAULT '["password", "密码", "银行", "bank", "login", "登录", "支付", "payment"]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认配置
INSERT OR IGNORE INTO salary_config (id) VALUES (1);
INSERT OR IGNORE INTO privacy_settings (id) VALUES (1);
"#;
