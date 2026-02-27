"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, BarChart3, Settings, Home } from "lucide-react";

const links = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/controle", label: "Contrôle", icon: FlaskConical },
  { href: "/bareme", label: "Barème", icon: BarChart3 },
  { href: "/expert", label: "Expert", icon: Settings },
  { href: "/colorimetrie", label: "Colorimétrie", icon: FlaskConical },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-clash font-bold text-lg text-gray-900 leading-none">IFPC</span>
          <span className="text-[10px] block text-gray-400 leading-tight">Pasteurisation</span>
        </div>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-gray-500 hover:text-brand-primary hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
