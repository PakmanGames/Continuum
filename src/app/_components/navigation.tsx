"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/cn";
import { Pulse } from "./ui/pulse";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/topology", label: "Topology" },
  { href: "/servers", label: "Servers" },
  { href: "/timeline", label: "Timeline" },
  { href: "/user", label: "Users" },
];

export function Navigation() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  // The marketing pages ship their own header; hide the app nav on them.
  if (pathname === "/" || pathname === "/waitlist") return null;

  return (
    <nav className="border-border bg-bg/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-display text-fg flex items-center gap-2 text-lg font-semibold"
          >
            <Pulse tone="accent" />
            Continiuum
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <SignedIn key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-surface-2 text-fg"
                      : "text-muted hover:bg-surface hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              </SignedIn>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted hidden items-center gap-2 text-xs sm:flex">
            <Pulse tone="success" />
            All systems operational
          </span>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 rounded-full border border-border",
                },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
