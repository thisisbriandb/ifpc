import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Navbar";
import MainContent from "@/components/MainContent";
import { SidebarProvider } from "@/lib/sidebar-context";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IFPC",
  description: "Outil d'aide à la prise de décision pour la filière cidricole",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <I18nProvider>
          <SidebarProvider>
            <Sidebar />
            <MainContent>{children}</MainContent>
          </SidebarProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
