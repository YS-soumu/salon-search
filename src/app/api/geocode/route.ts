import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocoding";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  try {
    const result = await geocodeAddress(address);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geocoding failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
