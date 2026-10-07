import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LinguaTube", template: "%s · LinguaTube" },
  description: "Biến video YouTube thành bài học ngôn ngữ có transcript, từ vựng, ngữ pháp và bài tập.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
