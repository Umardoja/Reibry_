"use client";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Navigation } from "@/components/layout/navigation";
import { IC } from "@/components/design/icons";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { if (!pathname.startsWith("/admin")) void fetch("/api/admin/overview").then((response) => setIsAdmin(response.ok)).catch(() => setIsAdmin(false)); }, [pathname]);
  const bare = pathname === "/auth" || pathname === "/onboarding" || pathname === "/share-target";
  const label = pathname.startsWith("/memories/") ? "Memory" : ({
    "/today": "Today", "/memories": "Memories", "/capture": "Capture",
    "/settings": "Account", "/ask": "Ask REIBRY", "/life": "Life", "/plans": "Plans", "/auth": "Account",
  } as Record<string, string>)[pathname] || "REIBRY";
  return <div className={"app" + (bare ? " app-bare" : "")}>
    {pathname !== "/onboarding" && <header className="app-header">
      <div className="header-logo-wrap" aria-hidden="true">{IC.brain}</div>
      <div className="header-title-stack"><div className="header-brand">REIBRY</div><div className="header-page">{label}</div></div>
      {!bare && <div className="header-actions"><details className="account-menu" key={pathname}><summary className="header-bell" aria-label="Account menu"><UserRound aria-hidden="true" /></summary><div className="card account-menu-panel">{isAdmin && <Link className="btn-ghost" href="/admin">Admin dashboard</Link>}<Link className="btn-ghost" href="/settings">Settings</Link><SignOutButton /></div></details></div>}
    </header>}

    <main id="main" className={bare ? "bare-content" : "page-scroll"}>{children}</main>
    {!bare && <Navigation />}
  </div>;
}
