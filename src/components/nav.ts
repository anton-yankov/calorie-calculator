import { ChartColumn, House, NotebookText, Package } from "lucide-react";

/** The four pages in the tabs (phones) and the sidebar (desktop), in this order. */
export const PAGES = [
  { href: "/", label: "Home", Icon: House },
  { href: "/log", label: "Log", Icon: NotebookText },
  { href: "/stats", label: "Stats", Icon: ChartColumn },
  { href: "/products", label: "Products", Icon: Package },
] as const;

/** Settings and the admin pages sit behind the profile button, not a tab. */
export const inAccountArea = (pathname: string) =>
  pathname.startsWith("/settings") || pathname.startsWith("/admin");

/**
 * The title row at the top of each page: a small line above, the page name
 * below. `today` is the viewer's date (only known in the browser); until it's
 * known, the homepage's small line stays empty instead of guessing.
 */
export function pageTitle(pathname: string, today: string): { sub: string; title: string } {
  if (pathname === "/") return { sub: today, title: "Today" };
  if (pathname === "/log") return { sub: "All your meals, by day", title: "Log" };
  if (pathname === "/stats") return { sub: "Your trends", title: "Stats" };
  if (pathname === "/products") return { sub: "Saved from barcodes", title: "Products" };
  if (pathname === "/settings") return { sub: "Your account", title: "Settings" };
  if (pathname === "/settings/details") return { sub: "Settings", title: "Body details" };
  if (pathname === "/settings/plan") return { sub: "Settings", title: "Change plan" };
  if (pathname === "/admin") return { sub: "Admin", title: "Users" };
  if (pathname.startsWith("/admin/users/")) return { sub: "Admin · Users", title: "Account" };
  return { sub: "", title: "Calories" };
}
