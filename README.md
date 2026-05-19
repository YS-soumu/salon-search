# 取扱サロン検索システム

Next.js 14 + TypeScript + Supabase で実装した、近隣サロン検索 Web アプリです。

---

## システム構成

```
┌─────────────────────────────────────────────────────┐
│  ブラウザ (Next.js クライアントコンポーネント)         │
│  ・都道府県 / 住所 / 現在地で検索                     │
│  ・距離順サロン一覧表示                               │
└─────────────┬───────────────────────────────────────┘
              │ HTTP
┌─────────────▼───────────────────────────────────────┐
│  Next.js API Routes (サーバーサイド)                  │
│  ・/api/salons/search  — 検索 API                    │
│  ・/api/geocode        — ジオコーディング             │
│  ・/api/admin/sync     — Bカート同期                  │
│  ・/api/admin/import   — CSV インポート               │
└──────┬──────────────────────────┬────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│  Supabase   │          │  Geocoding API  │
│  PostgreSQL │          │  Google Maps    │
│  (salons表) │          │  or Nominatim   │
└─────────────┘          └─────────────────┘
```

---

## DB 設計

### `salons` テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | SERIAL PK | 内部ID |
| bcart_customer_id | VARCHAR UNIQUE | BカートのユニークID |
| name | VARCHAR | サロン名 |
| postal_code | VARCHAR | 郵便番号 |
| prefecture | VARCHAR | 都道府県 |
| address | TEXT | 都道府県以降の住所 |
| phone | VARCHAR | 電話番号 |
| latitude | DECIMAL(10,8) | 緯度 |
| longitude | DECIMAL(11,8) | 経度 |
| customer_group_id | VARCHAR | Bカート顧客グループID |
| is_active | BOOLEAN | 表示フラグ |
| created_at / updated_at | TIMESTAMPTZ | タイムスタンプ |

---

## API 設計

### `GET /api/salons/search`

クエリパラメータ:

| パラメータ | 必須 | 説明 |
|---|---|---|
| prefecture | 任意 | 都道府県（例: 東京都） |
| address | 任意 | 住所文字列（ジオコーディングされる） |
| lat / lng | 任意 | 緯度経度（現在地使用時） |
| radius_km | 任意 | 検索半径 km（デフォルト: 50） |
| limit | 任意 | 最大件数（デフォルト: 20） |

レスポンス: `{ salons: SalonWithDistance[], total, query_lat, query_lng }`

### `GET /api/geocode?address=東京都渋谷区`

住所文字列 → 緯度経度変換。

### `POST /api/admin/sync`

- ヘッダー: `x-admin-secret: <ADMIN_SECRET>`
- Bカート API から対象グループの顧客を取得し、ジオコーディングして DB に保存。

### `POST /api/admin/import`

- ヘッダー: `x-admin-secret: <ADMIN_SECRET>`
- body: `multipart/form-data` で `file` フィールドに CSV ファイル。

---

## セットアップ手順

### 1. リポジトリのクローン / 依存インストール

```bash
git clone <repo-url>
cd salon-search
npm install
```

### 2. Supabase プロジェクトの準備

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. `supabase/migrations/001_init.sql` の内容を Supabase の **SQL エディタ** で実行
3. プロジェクト設定 → API からキーを確認

### 3. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各値を設定します。

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Maps Geocoding API（未設定の場合は Nominatim を使用）
GOOGLE_MAPS_API_KEY=AIza...

# Bカート API（使用する場合）
BCART_API_BASE_URL=https://your-store.bcart.jp/api
BCART_API_KEY=...
BCART_TARGET_GROUP_ID=...

# 管理画面シークレット
ADMIN_SECRET=強力なランダム文字列
```

### 4. 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` で検索ページ、`http://localhost:3000/admin` で管理画面が使えます。

### 5. サロンデータの登録

**Bカート API が使える場合:**

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

**CSV で登録する場合:**

管理画面 (`/admin`) の「CSV ファイルからインポート」セクションからアップロード。

---

## CSV フォーマット（Bカート API 不使用時）

```csv
顧客ID,サロン名,郵便番号,都道府県,住所,電話番号,グループID
C001,サロンABC,150-0001,東京都,渋谷区神南1-1-1,03-1234-5678,G001
C002,サロンXYZ,530-0001,大阪府,大阪市北区梅田1-1-1,06-1234-5678,G001
```

BカートからCSV出力した場合は列名が異なる場合があります。
`src/app/api/admin/import/route.ts` の `HEADER_MAP` を実際の列名に合わせて調整してください。

---

## Bカート API が使えない場合の運用フロー

```
1. Bカート管理画面 → 顧客管理 → 対象グループでフィルタ → CSV エクスポート
2. 必要に応じて列名を調整（または HEADER_MAP を更新）
3. 管理画面 /admin の CSV インポートからアップロード
4. 月1回など定期的に最新データで上書きインポート
```

---

## 本番デプロイ（Vercel）

```bash
# Vercel CLI でデプロイ
npm i -g vercel
vercel

# 環境変数は Vercel ダッシュボード → Settings → Environment Variables で設定
```

---

## 定期データ更新

Bカート API が使える場合、以下の方法で自動同期できます:

- **Vercel Cron Jobs**: `vercel.json` に設定
- **GitHub Actions**: スケジュール実行で `curl` して同期 API を呼び出す

```json
// vercel.json の例
{
  "crons": [{
    "path": "/api/admin/sync",
    "schedule": "0 3 * * 1"
  }]
}
```

※ Cron Job から呼び出す場合は `CRON_SECRET` 環境変数を別途設定してセキュリティを強化してください。

---

## セキュリティ設計

| 懸念点 | 対策 |
|---|---|
| API キーの漏洩 | 全キーをサーバー側環境変数で管理、フロントには非公開 |
| 個人情報の過剰公開 | 電話番号・住所は表示するが、メールアドレス等は含まない |
| 管理 API への不正アクセス | `x-admin-secret` ヘッダー認証 |
| DB への直接書き込み | RLS で anon は SELECT のみ、書き込みは service_role のみ |
