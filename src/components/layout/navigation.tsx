"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IC } from "@/components/design/icons";
const destinations = [
  { href: "/", label: "Home", icon: IC.today },
  { href: "/memories", label: "Memories", icon: IC.memories },
  { href: "/capture", label: "Capture", icon: IC.plus },
  { href: "/plans", label: "Plans", icon: IC.life },
  { href: "/settings", label: "Account", icon: IC.account },
];
export function Navigation() {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label="Main navigation">
    {destinations.map(({ href, label, icon }) => {
      const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} prefetch aria-current={active ? "page" : undefined}
        className={href === "/capture" ? "nav-capture" : "nav-btn" + (active ? " active" : "")}>
        {href === "/capture" ? <div className="nav-capture-disc" aria-hidden="true">{icon}</div> : <div className="nav-icon" aria-hidden="true">{icon}</div>}
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
