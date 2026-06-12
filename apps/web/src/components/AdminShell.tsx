"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { sr } from "@znservis/i18n";
import { signOutAction } from "@/app/actions";

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/", label: sr.nav.dashboard },
  { href: "/work-orders", label: sr.nav.workOrders },
  { href: "/reports", label: sr.nav.reports },
  { href: "/workers", label: sr.nav.workers },
  { href: "/locations", label: sr.nav.locations },
  { href: "/materials", label: sr.nav.materials }
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className={`shell ${navOpen ? "shell-nav-open" : ""}`}>
      <header className="mobile-topbar">
        <button
          aria-expanded={navOpen}
          aria-label={navOpen ? "Zatvori meni" : "Otvori meni"}
          className="mobile-menu-button"
          onClick={() => setNavOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-topbar-title">
          <strong>{sr.app.name}</strong>
        </div>
      </header>

      <button
        aria-label="Zatvori meni"
        className="sidebar-backdrop"
        onClick={closeNav}
        type="button"
      />

      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <h1>{sr.app.name}</h1>
        <p>{sr.app.tagline}</p>
        <nav className="nav">
          {navItems.map((item) => (
            <Link
              className={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "nav-active" : undefined}
              href={item.href}
              key={item.href}
              onClick={closeNav}
            >
              {item.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button type="submit">{sr.auth.logout}</button>
          </form>
        </nav>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
