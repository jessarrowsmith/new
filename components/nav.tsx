"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  CalendarDays,
  ClipboardList,
  LayoutTemplate,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export const NAV_ITEMS = [
  { href: "/log", label: "Log", icon: ClipboardList },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/day-templates", label: "Days", icon: LayoutTemplate },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/foods", label: "Foods", icon: Apple },
  { href: "/shopping-list", label: "Shopping", icon: ShoppingCart },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const isActive = useIsActive();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Meal Planner
        </Link>
        <ThemeToggle />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
              isActive(href) && "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {label === "Days" ? "Day Templates" : label === "Shopping" ? "Shopping List" : label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="font-semibold tracking-tight">
        Meal Planner
      </Link>
      <ThemeToggle />
    </header>
  );
}

export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
                isActive(href) && "text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
