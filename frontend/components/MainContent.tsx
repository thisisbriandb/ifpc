"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "@/lib/sidebar-context";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const noSidebar = pathname === "/login";

  return (
    <main className={`transition-all duration-300 ${noSidebar ? "" : collapsed ? "ml-16" : "ml-60"}`}>
      {children}
    </main>
  );
}
