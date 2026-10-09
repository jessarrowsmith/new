"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export const NAV_ITEMS = [
  { href: "/log", label: "Log", full: "Daily Log", emoji: "📓" },
  { href: "/planner", label: "Planner", full: "Planner", emoji: "🗓️" },
  { href: "/day-templates", label: "Days", full: "Day Templates", emoji: "🌿" },
  { href: "/meals", label: "Meals", full: "Meals", emoji: "🍽️" },
  { href: "/foods", label: "Foods", full: "Foods", emoji: "🥑" },
  { href: "/shopping-list", label: "Shop", full: "Shopping List", emoji: "🛒" },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const isActive = useIsActive();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card md:flex">
      <div className="flex h-20 items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          🥗 Meal Planner
        </Link>
        <ThemeToggle />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, full, emoji }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-medium transition-colors hover:bg-secondary",
              isActive(href) && "bg-secondary font-bold",
            )}
          >
            <span className="text-lg" aria-hidden>
              {emoji}
            </span>
            {full}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="text-lg font-bold tracking-tight">
        🥗 Meal Planner
      </Link>
      <ThemeToggle />
    </header>
  );
}

export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-6 px-1 pt-1">
        {NAV_ITEMS.map(({ href, label, emoji }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "mx-0.5 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground",
                isActive(href) && "bg-secondary font-bold text-foreground",
              )}
            >
              <span className="text-xl leading-none" aria-hidden>
                {emoji}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
