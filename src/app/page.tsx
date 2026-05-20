"use client";

import { useState, useCallback } from "react";
import type { SalonWithDistance, SearchResponse } from "@/types/salon";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const RADIUS_OPTIONS = [
  { label: "10km 以内", value: 10 },
  { label: "30km 以内", value: 30 },
  { label: "50km 以内", value: 50 },
  { label: "100km 以内", value: 100 },
];

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function googleMapsUrl(salon: SalonWithDistance): string {
  const query = encodeURIComponent(`${salon.prefecture ?? ""}${salon.address ?? ""}${salon.name}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function SearchPage() {
  const [prefecture, setPrefecture] = useState("");
  const [address, setAddress] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

  const search = useCallback(
    async (overrideLat?: number, overrideLng?: number) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (prefecture) params.set("prefecture", prefecture);
      if (address && !overrideLat) params.set("address", address);
      if (overrideLat !== undefined) params.set("lat", String(overrideLat));
      if (overrideLng !== undefined) params.set("lng", String(overrideLng));
      params.set("radius_km", String(radiusKm));
      params.set("limit", "20");

      try {
        const res = await fetch(`/api/salons/search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "検索に失敗しました");
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    },
    [prefecture, address, radiusKm]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsingCurrentLocation(false);
    search();
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("このブラウザは位置情報に対応していません");
      return;
    }
    setLoading(true);
    setUsingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        search(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setError("位置情報の取得に失敗しました");
        setLoading(false);
      }
    );
  };

  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">取扱サロン検索</h1>
          <p className="mt-1 text-sm text-gray-500">
            お近くの取扱サロンを都道府県・住所から検索できます
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 検索フォーム */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 都道府県 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                都道府県
              </label>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <option value="">すべて</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* 検索半径 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                検索範囲
              </label>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                {RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 住所 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              住所・地名（任意）
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="例: 渋谷区神南1-1-1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading && !usingCurrentLocation ? "検索中..." : "この住所で検索"}
            </button>
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={loading}
              className="flex-1 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {loading && usingCurrentLocation ? "位置取得中..." : "現在地で検索"}
            </button>
          </div>
        </form>

        {/* エラー */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="mt-6">
            {result.salons.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-gray-500 text-sm">
                  近隣の取扱サロンが見つかりませんでした
                </p>
                <p className="mt-1 text-gray-400 text-xs">
                  検索範囲を広げてお試しください
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  {result.salons.length}件のサロンが見つかりました（距離が近い順）
                </p>
                <ul className="space-y-3">
                  {result.salons.map((salon) => (
                    <SalonCard key={salon.id} salon={salon} />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SalonCard({ salon }: { salon: SalonWithDistance }) {
  const address = `${salon.prefecture ?? ""}${salon.address ?? ""}`;
  const displayName = salon.name || salon.contact_name || "（名称未登録）";

  return (
    <li className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
          {salon.name && salon.contact_name && (
            <p className="text-xs text-gray-500 mt-0.5">担当: {salon.contact_name}</p>
          )}

          {address && (
            <p className="mt-1 text-sm text-gray-600 flex items-start gap-1">
              <svg className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {salon.postal_code ? `〒${salon.postal_code} ` : ""}
              {address}
            </p>
          )}

          {salon.phone && (
            <p className="mt-1 text-sm text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${salon.phone}`} className="hover:underline">{salon.phone}</a>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {salon.distance_km > 0 && (
            <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full whitespace-nowrap">
              {formatDistance(salon.distance_km)}
            </span>
          )}
          <a
            href={googleMapsUrl(salon)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            地図で開く
          </a>
        </div>
      </div>
    </li>
  );
}
