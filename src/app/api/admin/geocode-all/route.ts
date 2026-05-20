import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";

export const maxDuration = 60;

function checkAdminAuth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

// 浜松市の旧区名→新区名変換（2024年1月合区対応）
function normalizeAddress(address: string): string {
  return address
    .replace(/浜松市中区/, "浜松市中央区")
    .replace(/浜松市東区/, "浜松市中央区")
    .replace(/浜松市南区/, "浜松市中央区")
    .replace(/浜松市北区/, "浜松市浜名区")
    .replace(/浜松市浜北区/, "浜松市浜名区");
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // 緯度経度未設定 かつ 失敗フラグなし のサロンのみ取得
  const { data: salons, error } = await db
    .from("salons")
    .select("id, name, prefecture, address")
    .is("latitude", null)
    .eq("geocode_failed", false)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!salons?.length) {
    return NextResponse.json({ message: "すべての住所変換が完了しています", remaining: 0 });
  }

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const salon of salons) {
    const rawAddress = `${salon.prefecture ?? ""}${salon.address ?? ""}`;
    const fullAddress = normalizeAddress(rawAddress);

    if (!fullAddress.trim()) {
      await db.from("salons").update({ geocode_failed: true }).eq("id", salon.id);
      results.failed++;
      continue;
    }

    try {
      const geo = await geocodeAddress(fullAddress);
      await db
        .from("salons")
        .update({ latitude: geo.lat, longitude: geo.lng, geocode_failed: false })
        .eq("id", salon.id);
      results.success++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      // 失敗フラグを立てて次回からスキップ
      await db.from("salons").update({ geocode_failed: true }).eq("id", salon.id);
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${salon.name}: ${msg}`);
      results.failed++;
    }
  }

  // 残り件数（未変換かつ失敗フラグなし）
  const { count } = await db
    .from("salons")
    .select("id", { count: "exact", head: true })
    .is("latitude", null)
    .eq("geocode_failed", false);

  return NextResponse.json({ ...results, remaining: count ?? 0 });
}
