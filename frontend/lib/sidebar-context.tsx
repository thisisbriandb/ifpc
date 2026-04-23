"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: true,
  toggle: () => {},
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{
      collapsed,
      toggle: () => setCollapsed((v) => !v),
      setCollapsed,
      mobileOpen,
      setMobileOpen
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
