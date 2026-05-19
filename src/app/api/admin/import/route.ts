import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";

export const maxDuration = 60;

function checkAdminAuth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

// Shift-JIS / UTF-8 自動判定デコード
function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    const sjisText = new TextDecoder("shift-jis").decode(buffer);
    // Shift-JIS デコード結果に日本語が含まれるか確認
    if (/[ぁ-ん]|[ァ-ヴ]|[一-龯]/.test(sjisText)) return sjisText;
  } catch {
    // fall through
  }
  return new TextDecoder("utf-8").decode(buffer);
}

// CSV パース（ヘッダー行あり・ダブルクォートで囲まれた改行にも対応）
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let inQuote = false;
  const chars = text.split("");

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '"') {
      if (inQuote && chars[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      if (!rows.length) rows.push([]);
      rows[rows.length - 1].push(current.trim());
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && chars[i + 1] === "\n") i++;
      if (!rows.length) rows.push([]);
      rows[rows.length - 1].push(current.trim());
      current = "";
      rows.push([]);
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    if (!rows.length) rows.push([]);
    rows[rows.length - 1].push(current.trim());
  }

  const filtered = rows.filter((r) => r.some((v) => v !== ""));
  if (filtered.length < 2) return [];

  const headers = filtered[0];
  return filtered.slice(1).map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))
  );
}

// Bカート CSV の列名 → DB フィールド名マッピング
const HEADER_MAP: Record<string, string> = {
  // Bカート標準列名
  "Bカート会員ID": "bcart_customer_id",
  貴社独自会員ID: "bcart_customer_id",
  会社名: "name",
  郵便番号: "postal_code",
  都道府県: "prefecture",
  市区町村: "city",           // address と結合する
  "町域・番地": "street",     // address と結合する
  "ビル建物名など": "building",
  電話番号: "phone",
  携帯番号: "phone_mobile",
  価格グループID: "customer_group_id",
  // 汎用列名
  顧客ID: "bcart_customer_id",
  サロン名: "name",
  顧客名: "name",
  住所: "address",
  グループID: "customer_group_id",
};

// 対象グループIDでフィルタ（環境変数 BCART_TARGET_GROUP_ID が設定されている場合）
const TARGET_GROUP_ID = process.env.BCART_TARGET_GROUP_ID ?? "";

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let csvText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    const buffer = await file.arrayBuffer();
    csvText = decodeCsvBuffer(buffer);
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (!rows.length) {
    return NextResponse.json({ error: "CSV にデータがありません" }, { status: 400 });
  }

  const db = createServiceClient();
  const results = { created: 0, updated: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    // 削除フラグが立っている行をスキップ
    if (row["削除フラグ"] === "1") {
      results.skipped++;
      continue;
    }

    // ヘッダーを正規化
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = HEADER_MAP[key];
      if (mapped) normalized[mapped] = value;
    }

    // 対象グループIDでフィルタ（設定されている場合のみ）
    if (TARGET_GROUP_ID && normalized.customer_group_id !== TARGET_GROUP_ID) {
      results.skipped++;
      continue;
    }

    // 会社名が空の場合は代表者名を使用
    const name =
      normalized.name ||
      `${row["代表者(姓)"] ?? ""}${row["代表者(名)"] ?? ""}`.trim();

    if (!name) {
      results.errors.push(`行スキップ: サロン名が空`);
      results.failed++;
      continue;
    }

    // 住所を結合（市区町村 + 町域・番地 + ビル建物名）
    const address =
      normalized.address ||
      [normalized.city, normalized.street, normalized.building]
        .filter(Boolean)
        .join("");

    const phone = normalized.phone || normalized.phone_mobile || null;

    // ジオコーディングはインポート後に別途「住所変換」ボタンで実行
    const latitude: number | null = null;
    const longitude: number | null = null;

    const record = {
      bcart_customer_id: normalized.bcart_customer_id || null,
      name,
      postal_code: normalized.postal_code || null,
      prefecture: normalized.prefecture || null,
      address: address || null,
      phone,
      latitude,
      longitude,
      customer_group_id: normalized.customer_group_id || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("salons")
      .upsert(record, { onConflict: "bcart_customer_id" });

    if (error) {
      results.errors.push(`${name}: DB エラー - ${error.message}`);
      results.failed++;
    } else {
      results.created++;
    }
  }

  return NextResponse.json({ ...results, total: rows.length });
}
