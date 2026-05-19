import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { fetchBcartSalons } from "@/lib/bcart";
import { geocodeAddress } from "@/lib/geocoding";

function checkAdminAuth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

  let customers;
  try {
    customers = await fetchBcartSalons();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Bカート取得失敗: ${msg}` }, { status: 500 });
  }

  for (const customer of customers) {
    const fullAddress = `${customer.prefecture}${customer.address}`;

    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const geo = await geocodeAddress(fullAddress);
      latitude = geo.lat;
      longitude = geo.lng;
      // Geocoding API の過負荷防止
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${customer.name}: ${msg}`);
      results.failed++;
    }

    const record = {
      bcart_customer_id: customer.id,
      name: customer.name,
      postal_code: customer.postal_code,
      prefecture: customer.prefecture,
      address: customer.address,
      phone: customer.phone,
      latitude,
      longitude,
      customer_group_id: customer.group_id,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("salons")
      .upsert(record, { onConflict: "bcart_customer_id" });

    if (error) {
      results.errors.push(`${customer.name}: DB error - ${error.message}`);
      results.failed++;
    } else if (latitude !== null) {
      results.created++;
    }
  }

  return NextResponse.json({ ...results, total: customers.length });
}
