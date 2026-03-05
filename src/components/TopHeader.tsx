"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "./top-header.module.css";

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Markets" },
  { href: "/about", label: "About" },
];

const MOBILE_NAV_ID = "primary-mobile-nav";
const THEME_STORAGE_KEY = "theme";

function getInitialDarkPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark") {
      return true;
    }

    if (stored === "light") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function TopHeader() {
  const pathname = usePathname();
  const [dark, setDark] = useState(getInitialDarkPreference);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileOpen = mobileMenuPath === pathname;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileMenuPath((prev) => (prev === pathname ? null : pathname));
  }, [pathname]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Kalshi Election Tracker
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.rightActions}>
          <button
            className={styles.themeToggle}
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? "☀️" : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>

          <a
            href="https://x.com/a12321xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.profileLink}
            aria-label="a12321xyz on X"
            title="Follow a12321xyz on X"
          >
            <Image src="/images/profile.png" alt="a12321xyz profile" width={34} height={34} className={styles.profileImage} />
          </a>

          <button
            className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ""}`}
            type="button"
            onClick={toggleMobile}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_NAV_ID}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id={MOBILE_NAV_ID} className={styles.mobileMenu} aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ""}`}
                onClick={() => setMobileMenuPath(null)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
