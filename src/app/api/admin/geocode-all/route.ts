import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";

export const maxDuration = 60;

function checkAdminAuth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

// 緯度経度が未設定のサロンを1回の呼び出しで最大20件ずつジオコーディング
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // 緯度経度が未設定のサロンを取得
  const { data: salons, error } = await db
    .from("salons")
    .select("id, name, prefecture, address")
    .is("latitude", null)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!salons?.length) {
    return NextResponse.json({ message: "すべての住所変換が完了しています", remaining: 0 });
  }

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const salon of salons) {
    const fullAddress = `${salon.prefecture ?? ""}${salon.address ?? ""}`;
    if (!fullAddress.trim()) {
      results.failed++;
      continue;
    }

    try {
      const geo = await geocodeAddress(fullAddress);
      await db
        .from("salons")
        .update({ latitude: geo.lat, longitude: geo.lng })
        .eq("id", salon.id);
      results.success++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${salon.name}: ${msg}`);
      results.failed++;
    }
  }

  // 残り件数を確認
  const { count } = await db
    .from("salons")
    .select("id", { count: "exact", head: true })
    .is("latitude", null);

  return NextResponse.json({ ...results, remaining: count ?? 0 });
}
