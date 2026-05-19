import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";

function checkAdminAuth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

// CSV パース（ヘッダー行あり）
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// CSVのヘッダー名 → DBフィールド名のマッピング
// CSVのカラム名が異なる場合はここを調整してください
const HEADER_MAP: Record<string, string> = {
  顧客ID: "bcart_customer_id",
  customer_id: "bcart_customer_id",
  サロン名: "name",
  顧客名: "name",
  name: "name",
  郵便番号: "postal_code",
  postal_code: "postal_code",
  都道府県: "prefecture",
  prefecture: "prefecture",
  住所: "address",
  address: "address",
  電話番号: "phone",
  tel: "phone",
  phone: "phone",
  グループID: "customer_group_id",
  group_id: "customer_group_id",
};

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let csvText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (!rows.length) {
    return NextResponse.json({ error: "CSV にデータがありません" }, { status: 400 });
  }

  const db = createServiceClient();
  const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

  for (const row of rows) {
    // ヘッダーを正規化
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = HEADER_MAP[key];
      if (mapped) normalized[mapped] = value;
    }

    const name = normalized.name;
    if (!name) {
      results.errors.push(`行スキップ: サロン名が空`);
      results.failed++;
      continue;
    }

    const fullAddress = `${normalized.prefecture ?? ""}${normalized.address ?? ""}`;
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (fullAddress.trim()) {
      try {
        const geo = await geocodeAddress(fullAddress);
        latitude = geo.lat;
        longitude = geo.lng;
        await new Promise((r) => setTimeout(r, 150));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${name}: ジオコーディング失敗 - ${msg}`);
      }
    }

    const record = {
      bcart_customer_id: normalized.bcart_customer_id || null,
      name,
      postal_code: normalized.postal_code || null,
      prefecture: normalized.prefecture || null,
      address: normalized.address || null,
      phone: normalized.phone || null,
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
