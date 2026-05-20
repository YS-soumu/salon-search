import type { GeocodeResult } from "@/types/salon";

// Google Maps Geocoding API
async function geocodeWithGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "jp");
  url.searchParams.set("language", "ja");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocode HTTP error: ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocode failed: ${data.status}`);
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted_address: result.formatted_address,
  };
}

// 国土地理院 ジオコーディングAPI（無料・登録不要・日本専用）
async function geocodeWithGSI(address: string): Promise<GeocodeResult> {
  const url = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
  url.searchParams.set("q", address);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`GSI Geocode HTTP error: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error(`GSI: 住所が見つかりませんでした: ${address}`);
  }

  // GeoJSON 形式: coordinates は [longitude, latitude]
  const [lng, lat] = data[0].geometry.coordinates;
  return {
    lat,
    lng,
    formatted_address: data[0].properties?.title ?? address,
  };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return geocodeWithGoogle(address);
  }
  // Google API キー未設定時は国土地理院 API を使用
  return geocodeWithGSI(address);
}
