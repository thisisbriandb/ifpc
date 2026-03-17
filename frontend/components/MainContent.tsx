"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noSidebar = pathname === "/login";

  return (
    <main className={noSidebar ? "" : "ml-56"}>
      {children}
    </main>
  );
}
