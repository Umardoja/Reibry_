import type { ReactNode } from "react";
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"px pt-page " + className}>{children}</div>;
}
export function StatePanel({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return <div className={"state-panel" + (tone === "error" ? " state-error" : "")} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
