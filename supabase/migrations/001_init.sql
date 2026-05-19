-- ============================================================
-- サロン検索システム — DB スキーマ
-- Supabase (PostgreSQL) で実行してください
-- ============================================================

-- サロンテーブル
CREATE TABLE IF NOT EXISTS salons (
  id                  SERIAL PRIMARY KEY,
  bcart_customer_id   VARCHAR(100) UNIQUE,          -- BカートのユニークID
  name                VARCHAR(255) NOT NULL,         -- サロン名
  postal_code         VARCHAR(10),                   -- 郵便番号（ハイフンあり可）
  prefecture          VARCHAR(50),                   -- 都道府県
  address             TEXT,                          -- 都道府県以降の住所
  phone               VARCHAR(20),                   -- 電話番号
  latitude            DECIMAL(10, 8),                -- 緯度
  longitude           DECIMAL(11, 8),                -- 経度
  customer_group_id   VARCHAR(100),                  -- Bカート顧客グループID
  is_active           BOOLEAN NOT NULL DEFAULT TRUE, -- 表示フラグ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス（都道府県フィルタ + 緯度経度範囲クエリ）
CREATE INDEX IF NOT EXISTS idx_salons_prefecture ON salons (prefecture);
CREATE INDEX IF NOT EXISTS idx_salons_lat_lng    ON salons (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_salons_active     ON salons (is_active);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salons_updated_at ON salons;
CREATE TRIGGER salons_updated_at
  BEFORE UPDATE ON salons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security（RLS）
-- 公開検索は anon キーで読み取り可、書き込みは service_role のみ
-- ============================================================
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;

-- 一般ユーザー（anon）: アクティブなサロンのみ読み取り可
CREATE POLICY "salons_select_active"
  ON salons FOR SELECT
  USING (is_active = TRUE);

-- サービスロール（管理 API）: 全操作許可
-- service_role は RLS をバイパスするため追加ポリシー不要

-- ============================================================
-- サンプルデータ（動作確認用）
-- ============================================================
INSERT INTO salons (bcart_customer_id, name, postal_code, prefecture, address, phone, latitude, longitude, customer_group_id)
VALUES
  ('DEMO-001', 'サロン東京 渋谷店',  '150-0001', '東京都',   '渋谷区神南1-1-1',       '03-1111-0001', 35.6627, 139.7034, 'DEMO_GROUP'),
  ('DEMO-002', 'サロン東京 新宿店',  '160-0022', '東京都',   '新宿区新宿3-1-1',       '03-1111-0002', 35.6896, 139.7006, 'DEMO_GROUP'),
  ('DEMO-003', 'サロン大阪 梅田店',  '530-0001', '大阪府',   '大阪市北区梅田1-1-1',   '06-1111-0003', 34.7024, 135.4959, 'DEMO_GROUP'),
  ('DEMO-004', 'サロン名古屋 栄店',  '460-0008', '愛知県',   '名古屋市中区栄3-1-1',   '052-111-0004', 35.1688, 136.9084, 'DEMO_GROUP'),
  ('DEMO-005', 'サロン福岡 天神店',  '810-0001', '福岡県',   '福岡市中央区天神2-1-1', '092-111-0005', 33.5902, 130.3976, 'DEMO_GROUP')
ON CONFLICT (bcart_customer_id) DO NOTHING;
