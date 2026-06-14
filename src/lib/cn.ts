export type ClassValue = string | number | false | null | undefined;

/**
 * Minimal className joiner. Filters out falsy values so conditional classes read
 * cleanly at call sites: cn("base", isActive && "active", className).
 *
 * Intentionally dependency-free — we don't need tailwind-merge's conflict
 * resolution here because consumers append overrides last, which already win.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
