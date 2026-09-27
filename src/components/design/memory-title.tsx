"use client";
import { useState } from "react";
export function MemoryTitle({ title }: { title: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = title.length > 120;
  return <><h1 className={`detail-title${long && !expanded ? " detail-title-clamped" : ""}`}>{title}</h1>
    {long && <button type="button" className="btn-ghost memory-title-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "Show more"}</button>}</>;
}
