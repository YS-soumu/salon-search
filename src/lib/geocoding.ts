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

// Nominatim (OpenStreetMap) — Google API キー未設定時のフォールバック
async function geocodeWithNominatim(address: string): Promise<GeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "jp");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SalonSearch/1.0" },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP error: ${res.status}`);

  const data = await res.json();
  if (!data.length) throw new Error("Nominatim: no results found");

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    formatted_address: data[0].display_name,
  };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return geocodeWithGoogle(address);
  }
  // Google API キーが無ければ Nominatim を使用
  return geocodeWithNominatim(address);
}
