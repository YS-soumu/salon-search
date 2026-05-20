"use client";

import { useState, useRef } from "react";

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(
        `同期完了: 合計 ${data.total} 件 / 成功 ${data.created} 件 / 失敗 ${data.failed} 件` +
          (data.errors?.length ? `\n\nエラー詳細:\n${data.errors.join("\n")}` : "")
      );
    } catch (err) {
      setSyncResult(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setImportResult("CSVファイルを選択してください");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResult(
        `インポート完了: 合計 ${data.total} 件 / 登録 ${data.created} 件 / スキップ ${data.skipped} 件 / 失敗 ${data.failed} 件\n` +
        `※ 次に「住所→緯度経度変換」を実行してください` +
          (data.errors?.length ? `\n\nエラー詳細:\n${data.errors.join("\n")}` : "")
      );
    } catch (err) {
      setImportResult(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  // 20件ずつ繰り返しジオコーディング
  async function handleGeocodeAll() {
    setGeocoding(true);
    setGeocodeResult("変換中... しばらくお待ちください");
    let total = 0;
    let failed = 0;
    const allErrors: string[] = [];

    try {
      while (true) {
        const res = await fetch("/api/admin/geocode-all", {
          method: "POST",
          headers: { "x-admin-secret": adminSecret },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        total += data.success ?? 0;
        failed += data.failed ?? 0;
        if (data.errors?.length) allErrors.push(...data.errors);
        const remaining = data.remaining ?? 0;

        setGeocodeResult(
          `変換済み: ${total} 件 / 失敗: ${failed} 件 / 残り: ${remaining} 件` +
          (allErrors.length ? `\n\n失敗したサロン:\n${allErrors.join("\n")}` : "")
        );

        if (remaining === 0) break;
        // 次のバッチまで少し待つ
        await new Promise((r) => setTimeout(r, 500));
      }
      setGeocodeResult(`✅ 完了: 変換済み ${total} 件 / 失敗 ${failed} 件`);
    } catch (err) {
      setGeocodeResult(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">管理画面 — サロンデータ管理</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 管理者認証 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">管理者シークレット</h2>
          <input
            type="password"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            placeholder="ADMIN_SECRET に設定した値を入力"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
        </section>

        {/* Bカート同期 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Bカート API から同期</h2>
          <p className="text-sm text-gray-500 mb-4">
            Bカートから対象顧客グループのサロン情報を取得してDBへ保存します。
          </p>
          <button
            onClick={handleSync}
            disabled={syncing || !adminSecret}
            className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {syncing ? "同期中..." : "今すぐ同期する"}
          </button>
          {syncResult && (
            <pre className="mt-4 text-xs bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
              {syncResult}
            </pre>
          )}
        </section>

        {/* CSV インポート */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">① CSV ファイルからインポート</h2>
          <p className="text-sm text-gray-500 mb-4">
            Bカートからエクスポートした CSV をそのままアップロードできます。
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="flex-1 text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm hover:file:bg-gray-200"
            />
            <button
              onClick={handleImport}
              disabled={importing || !adminSecret}
              className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {importing ? "インポート中..." : "インポート実行"}
            </button>
          </div>
          {importResult && (
            <pre className="mt-4 text-xs bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
              {importResult}
            </pre>
          )}
        </section>

        {/* 住所→緯度経度変換 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">② 住所→緯度経度変換</h2>
          <p className="text-sm text-gray-500 mb-4">
            インポート後にこのボタンを押してください。住所から地図上の位置を計算します。<br />
            件数が多い場合は数分かかります。完了まで画面を閉じないでください。
          </p>
          <button
            onClick={handleGeocodeAll}
            disabled={geocoding || !adminSecret}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {geocoding ? "変換中..." : "住所→緯度経度変換を実行"}
          </button>
          {geocodeResult && (
            <pre className="mt-4 text-xs bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
              {geocodeResult}
            </pre>
          )}
        </section>

        {/* 検索ページへのリンク */}
        <div className="text-center">
          <a href="/" className="text-sm text-rose-600 hover:underline">
            ← 検索ページへ戻る
          </a>
        </div>
      </main>
    </div>
  );
}
