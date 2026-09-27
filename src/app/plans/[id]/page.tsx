"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageContainer, StatePanel } from "@/components/ui/primitives";
import { MemoryCard } from "@/components/design/memory";
import { expectedPackSections, readyPackStepOrder } from "@/lib/plans/finalization";
import type { Memory, ReadyPack, ReadyPackItem } from "@/types/reibry";

type PackDetail = ReadyPack & { items: ReadyPackItem[]; memories?: Memory[]; missing?: string[]; context?: { startDate: string | null } };

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const [pack, setPack] = useState<PackDetail | null>(null);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/ready-packs/${id}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Ready Pack not found.");
      setPack(body.data);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Ready Pack not found."));
  }, [id]);

  const memoryById = useMemo(() => new Map((pack?.memories || []).map((memory) => [memory.id, memory])), [pack?.memories]);
  const sectionNames = useMemo(() => {
    if (!pack) return [];
    const populated = [...new Set(pack.items.map((item) => item.section))];
    return readyPackStepOrder(pack.packType, [...new Set([...expectedPackSections(pack.packType), ...populated])]);
  }, [pack]);

  return <RequireAuth><PageContainer className="ready-pack-page">
    {error && <StatePanel tone="error">{error}</StatePanel>}
    {pack && <>
      <p className="section-label">Ready Pack · {pack.status === "active" ? "Active" : pack.status}</p>
      <h1 className="page-h1">{pack.title}</h1>
      <p className="page-sub">{pack.context?.startDate ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(pack.context.startDate)) : "No date set"}</p>
      <section className="ready-pack-overview" aria-label="Ready Pack overview">
        <span className="section-label">Your guide</span>
        <p>{pack.items.length ? `${pack.items.length} saved ${pack.items.length === 1 ? "Memory" : "Memories"} to help with ${pack.title}.` : `A simple guide for ${pack.title}, built around what you save.`}</p>
        <span className="ready-pack-source-label">FROM YOUR MEMORIES</span>
      </section>
      {!pack.items.length && <StatePanel>I don&apos;t have anything saved that clearly matches this yet. You can add relevant Memories as you find them.</StatePanel>}
      {pack.items.length > 0 && <ol className="ready-pack-steps" aria-label="Ready Pack steps">
        {sectionNames.map((section, index) => {
          const items = pack.items.filter((item) => item.section === section);
          const missing = pack.missing?.some((value) => value.toLowerCase().includes(section.toLowerCase()) || section.toLowerCase().includes(value.toLowerCase()));
          return <li className="ready-pack-step" key={section}>
            <div className="ready-pack-step-heading"><span className="ready-pack-step-number">{index + 1}</span><div><h2>{section}</h2><p>{items.length ? `${items.length} saved ${items.length === 1 ? "Memory" : "Memories"}` : missing ? "No saved Memories yet" : "A step in your plan"}</p></div></div>
            {items.length > 0 && <div className="ready-pack-step-memories">{items.map((item) => <div className="ready-pack-memory" key={item.id}>{memoryById.get(item.memoryId) ? <MemoryCard memory={memoryById.get(item.memoryId)!} showOpenAction /> : <StatePanel>{item.relevanceReason}</StatePanel>}</div>)}</div>}
            <label className="ready-pack-check"><input type="checkbox" checked={checked.includes(section)} onChange={() => setChecked((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section])} /><span>{checked.includes(section) ? "Done" : `I’ve reviewed ${section.toLowerCase()}`}</span></label>
          </li>;
        })}
      </ol>}
      {!!pack.missing?.length && <section className="ready-pack-gaps"><h2 className="section-heading">Still to explore</h2><p>{pack.missing.map((item) => item.replace(/^No\s+/i, "")).join(" · ")}</p></section>}
    </>}
  </PageContainer></RequireAuth>;
}
