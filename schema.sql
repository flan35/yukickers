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

-- メンバー応援機能（いいね）
CREATE TABLE IF NOT EXISTS member_cheers (
  member_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
);

-- 応援履歴（1日1回制限用）
CREATE TABLE IF NOT EXISTS cheer_history (
  ip TEXT,
  date TEXT,
  PRIMARY KEY (ip, date)
);