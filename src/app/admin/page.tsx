"use client";

import { useState, useRef } from "react";

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
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
        `インポート完了: 合計 ${data.total} 件 / 成功 ${data.created} 件 / 失敗 ${data.failed} 件` +
          (data.errors?.length ? `\n\nエラー詳細:\n${data.errors.join("\n")}` : "")
      );
    } catch (err) {
      setImportResult(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
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
          <p className="mt-2 text-xs text-gray-400">
            この値は .env.local の ADMIN_SECRET と一致している必要があります
          </p>
        </section>

        {/* Bカート同期 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Bカート API から同期</h2>
          <p className="text-sm text-gray-500 mb-4">
            Bカートから対象顧客グループのサロン情報を取得し、住所を緯度経度に変換してDBへ保存します。
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
          <h2 className="font-semibold text-gray-800 mb-1">CSV ファイルからインポート</h2>
          <p className="text-sm text-gray-500 mb-2">
            Bカート API が使用できない場合は、CSV ファイルでサロン情報を登録できます。
          </p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-gray-600 mb-1">CSVフォーマット（1行目はヘッダー）</p>
            <code className="text-xs text-gray-700 block">
              顧客ID,サロン名,郵便番号,都道府県,住所,電話番号,グループID
            </code>
            <code className="text-xs text-gray-500 block mt-1">
              C001,サロンABC,150-0001,東京都,渋谷区神南1-1-1,03-1234-5678,G001
            </code>
          </div>
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
