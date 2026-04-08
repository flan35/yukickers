-- マッチング待機列
CREATE TABLE IF NOT EXISTS zookeeper_queue (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  avatar TEXT,
  joined_at INTEGER
);

-- 対戦ルーム
CREATE TABLE IF NOT EXISTS zookeeper_matches (
  match_id TEXT PRIMARY KEY,
  p1_id TEXT,
  p1_name TEXT,
  p1_avatar TEXT,
  p2_id TEXT,
  p2_name TEXT,
  p2_avatar TEXT,
  p1_hp INTEGER DEFAULT 100,
  p2_hp INTEGER DEFAULT 100,
  p1_atk INTEGER DEFAULT 0,
  p1_def INTEGER DEFAULT 0,
  p1_special INTEGER DEFAULT 0,
  p2_atk INTEGER DEFAULT 0,
  p2_def INTEGER DEFAULT 0,
  p2_special INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  phase TEXT DEFAULT 'waiting', -- 'waiting', 'puzzle', 'battle', 'result', 'finished'
  start_ts INTEGER,
  last_update_ts INTEGER,
  winner_id TEXT
);

-- ログ（オプション）
CREATE TABLE IF NOT EXISTS zookeeper_logs (
  match_id TEXT,
  round INTEGER,
  player_id TEXT,
  action TEXT,
  value INTEGER,
  ts INTEGER
);
