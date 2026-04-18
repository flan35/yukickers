-- チャット参加者テーブル
CREATE TABLE IF NOT EXISTS yukichat_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  avatar TEXT,
  x REAL,
  y REAL,
  msg TEXT,
  ts INTEGER,
  is_admin INTEGER DEFAULT 0,
  ip TEXT,
  is_waiting INTEGER DEFAULT 1
);

-- チャットログテーブル
CREATE TABLE IF NOT EXISTS yukichat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  msg TEXT,
  ts INTEGER,
  is_admin INTEGER DEFAULT 0
);

-- 一時キック用（5分間有効）
CREATE TABLE IF NOT EXISTS yukichat_kicked (
  id TEXT PRIMARY KEY,
  ip TEXT,
  ts INTEGER
);

-- 永久追放用
CREATE TABLE IF NOT EXISTS yukichat_blacklist (
  id TEXT PRIMARY KEY,
  ip TEXT,
  ts INTEGER
);

-- 爆弾仕分けゲームのスコアランキング
CREATE TABLE IF NOT EXISTS bomb_factory_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT,
  score INTEGER,
  ts INTEGER
);