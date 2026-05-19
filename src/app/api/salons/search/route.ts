import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocoding";
import { haversineKm, boundingBox } from "@/lib/distance";
import type { SearchRequest, SalonWithDistance } from "@/types/salon";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: SearchRequest = {
    prefecture: sp.get("prefecture") ?? undefined,
    address: sp.get("address") ?? undefined,
    lat: sp.get("lat") ? Number(sp.get("lat")) : undefined,
    lng: sp.get("lng") ? Number(sp.get("lng")) : undefined,
    radius_km: sp.get("radius_km") ? Number(sp.get("radius_km")) : 50,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 20,
  };

  let queryLat: number | null = params.lat ?? null;
  let queryLng: number | null = params.lng ?? null;

  // 住所文字列が渡された場合はジオコーディング
  if (!queryLat && params.address) {
    const fullAddress = `${params.prefecture ?? ""}${params.address}`;
    try {
      const geo = await geocodeAddress(fullAddress);
      queryLat = geo.lat;
      queryLng = geo.lng;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Geocoding failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // 都道府県のみで住所なしの場合
  if (!queryLat && params.prefecture) {
    try {
      const geo = await geocodeAddress(params.prefecture);
      queryLat = geo.lat;
      queryLng = geo.lng;
    } catch {
      // 都道府県中心座標が取れなくても都道府県フィルタで返す
    }
  }

  // クエリ構築
  let query = supabase
    .from("salons")
    .select("*")
    .eq("is_active", true);

  if (params.prefecture) {
    query = query.eq("prefecture", params.prefecture);
  }

  // 緯度経度がある場合はバウンディングボックスで絞り込み（効率化）
  if (queryLat !== null && queryLng !== null) {
    const bb = boundingBox(queryLat, queryLng, params.radius_km ?? 50);
    query = query
      .gte("latitude", bb.minLat)
      .lte("latitude", bb.maxLat)
      .gte("longitude", bb.minLng)
      .lte("longitude", bb.maxLng);
  }

  const { data, error } = await query.not("latitude", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const radiusKm = params.radius_km ?? 50;

  // Haversine で正確な距離を計算し、半径内に絞り込み
  let salons: SalonWithDistance[] = (data ?? [])
    .map((s) => ({
      ...s,
      distance_km:
        queryLat !== null && queryLng !== null
          ? haversineKm(queryLat!, queryLng!, s.latitude, s.longitude)
          : 0,
    }))
    .filter((s) =>
      queryLat !== null ? s.distance_km <= radiusKm : true
    )
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, params.limit ?? 20);

  return NextResponse.json({
    salons,
    total: salons.length,
    query_lat: queryLat,
    query_lng: queryLng,
  });
}
