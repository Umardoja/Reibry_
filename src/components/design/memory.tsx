import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Memory, LifeContext } from "@/types/reibry";
import { IC } from "./icons";
import { conciseSourceTitle } from "@/lib/capture/title";
export function thumbnailFor(memory: Memory) {
  const value = memory.evidenceSources.find((source) => source.thumbnail)?.thumbnail;
  return value && /^https:\/\//i.test(value) ? value : null;
}
export function SourceBadge({ memory }: { memory: Memory }) {
  const youtube = memory.sourcePlatform?.toLowerCase().includes("youtube");
  return <span className="mem-source"><span className="mem-source-icon" aria-hidden="true">{youtube ? IC.yt : memory.sourceUrl ? IC.link : IC.file}</span><span className="mem-source-text">{youtube ? "YouTube" : memory.sourcePlatform?.toLowerCase() === "tiktok" ? "TikTok" : memory.sourcePlatform || (memory.sourceUrl ? "Saved link" : "Saved note")}</span></span>;
}
export function savedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function MemoryCard({ memory, showOpenAction = false }: { memory: Memory; showOpenAction?: boolean }) {
  const thumbnail = thumbnailFor(memory);
  const displayTitle = memory.title.length > 120 ? conciseSourceTitle(memory.title) : memory.title;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  return <Link href={"/memories/" + memory.id} className="mem-card">
    <div className="mem-card-header"><SourceBadge memory={memory} /><span className="mem-card-meta">{savedDate(memory.createdAt)}{showOpenAction && <span className="mem-open-action">Open</span>}</span></div>
    <div className="mem-card-body"><div className="mem-content"><h2 className="mem-title">{displayTitle}</h2>{memory.summary && <p className="mem-desc line-clamp-3">{memory.summary}</p>}</div>{thumbnail && !thumbnailFailed && <Image unoptimized src={thumbnail} alt="" width={76} height={76} className="mem-thumb" onError={() => setThumbnailFailed(true)} />}{thumbnail && thumbnailFailed && <div className="mem-thumb mem-thumb-fallback" aria-hidden="true">{IC.file}</div>}</div>
    {memory.analysisStatus === "failed" && <p className="mem-limited">Source saved. Understanding was incomplete.</p>}
    {memory.analysisStatus === "processing" && <p className="mem-limited">Understanding…</p>}
    <div className="mem-tags">{memory.category && <span className="mem-cat-tag">{memory.category}</span>}{memory.tags.slice(0, 3).map((tag) => <span key={tag} className="mem-hash-tag">#{tag}</span>)}</div>
  </Link>;
}
export function LifeCard({ context }: { context: LifeContext }) {
  const date = context.startDate ? new Date(context.startDate) : null;
  const when = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "No date set";
  return <article className="life-event-card"><div className="life-event-icon" aria-hidden="true">{IC.cal}</div><div className="life-event-body"><div className="life-type-row"><span className={"life-type-badge " + context.type}>{context.type}</span></div><h3 className="life-event-title">{context.title}</h3><p className="life-event-when">{when}</p>{context.description && <p className="life-event-desc">{context.description}</p>}</div></article>;
}
