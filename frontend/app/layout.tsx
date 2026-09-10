import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Navbar";
import MainContent from "@/components/MainContent";
import AssistantLauncher from "@/components/assistant/AssistantLauncher";
import TeinteSection from "@/components/TeinteSection";
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
            <TeinteSection />
            <Sidebar />
            <MainContent>{children}</MainContent>
            {/* Hors de MainContent : la bulle est ancrée à la fenêtre, pas au
                contenu, et ne doit pas se décaler avec la barre latérale. */}
            <AssistantLauncher />
          </SidebarProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
