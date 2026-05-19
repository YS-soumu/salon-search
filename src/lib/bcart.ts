import type { BcartCustomer } from "@/types/salon";

// ---------------------------------------------------------------
// Bカート API クライアント
// 実際のエンドポイント・レスポンス形式はBカートのAPIドキュメントに合わせて調整してください
// ---------------------------------------------------------------

const BASE_URL = process.env.BCART_API_BASE_URL ?? "";
const API_KEY = process.env.BCART_API_KEY ?? "";
const TARGET_GROUP_ID = process.env.BCART_TARGET_GROUP_ID ?? "";

async function bcartFetch(path: string, params?: Record<string, string>) {
  if (!BASE_URL || !API_KEY) {
    throw new Error("Bカート API の環境変数が設定されていません");
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    // サーバーサイドのみで実行するためキャッシュ無効化
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bカート API エラー ${res.status}: ${text}`);
  }
  return res.json();
}

// 指定グループの顧客一覧を全件取得（ページネーション対応）
export async function fetchBcartSalons(): Promise<BcartCustomer[]> {
  const customers: BcartCustomer[] = [];
  let page = 1;

  while (true) {
    // ※ エンドポイント・パラメータ名は実際のBカートAPIドキュメントに合わせてください
    const data = await bcartFetch("/customers", {
      group_id: TARGET_GROUP_ID,
      page: String(page),
      per_page: "100",
    });

    // レスポンス形式に応じてマッピングを調整してください
    const items: BcartCustomer[] = (data.customers ?? data.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({
        id: String(c.id ?? c.customer_id),
        name: c.name ?? c.company_name ?? "",
        postal_code: c.postal_code ?? c.zip ?? "",
        prefecture: c.prefecture ?? c.pref ?? "",
        address: c.address ?? c.address1 ?? "",
        phone: c.phone ?? c.tel ?? "",
        group_id: String(c.group_id ?? TARGET_GROUP_ID),
      })
    );

    customers.push(...items);

    // 最終ページ判定（Bカートの仕様に合わせて調整）
    const totalPages: number = data.total_pages ?? data.last_page ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
  }

  return customers;
}
