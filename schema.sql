-- チャット参加者テーブル
CREATE TABLE IF NOT EXISTS yukichat_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  avatar TEXT,
  x REAL,
  y REAL,
  msg TEXT,
  ts INTEGER
);

-- チャットログテーブル
CREATE TABLE IF NOT EXISTS yukichat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  msg TEXT,
  ts INTEGER
);