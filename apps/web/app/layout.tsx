import type { Metadata } from "next";
import "./globals.css";
import { OrganizationProvider } from "../lib/context/OrganizationContext";
import { ToastProvider } from "../lib/context/ToastContext";
import { AppShell } from "./components/ui/AppShell";

export const metadata: Metadata = {
  title: "FinIntel Operations Console",
  description: "Enterprise multi-tenant financial operations platform and fixed-precision double-entry ledger engine.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OrganizationProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
