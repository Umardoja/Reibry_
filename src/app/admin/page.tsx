"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<{ accounts: number; memories: number; lifeContexts: number; trackedPwaInstalls: number | null } | null>(null);
  useEffect(() => { fetch("/api/admin/overview").then(async (response) => { if (!response.ok) { router.replace("/today"); return; } const body = await response.json(); setData(body.data); }).catch(() => router.replace("/today")); }, [router]);
  return <AppShell><main className="mx-auto w-full max-w-5xl px-4 py-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Admin</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Overview</h1><p className="mt-2 text-slate-600">Aggregate product health. Private Memory content is not shown here.</p><div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Accounts", data?.accounts], ["Memories", data?.memories], ["Life contexts", data?.lifeContexts]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{value ?? "—"}</p></div>)}</div><p className="mt-8 text-sm text-slate-500">Tracked PWA installs are prospective only; historical download totals are unavailable.</p></main></AppShell>;
}
