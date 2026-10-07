"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, ChartNoAxesColumnIncreasing, LayoutDashboard, Plus, Video } from "lucide-react";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/my-videos", label: "Video của tôi", icon: Video },
  { href: "/my-videos/new", label: "Tạo bài học", icon: Plus },
  { href: "/progress", label: "Tiến độ", icon: ChartNoAxesColumnIncreasing },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-clip bg-[var(--background)] text-[var(--foreground)]">
      <a className="skip-link" href="#main-content">Đi đến nội dung chính</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--border)] bg-white/90 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
        <Brand />
        <nav aria-label="Điều hướng chính" className="mt-10 space-y-1">
          {navigation.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-950 p-4 text-sm text-white">
          <p className="font-semibold">Chế độ học thử</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Tiến độ được lưu trong phiên máy chủ hiện tại.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 min-w-0 max-w-full border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
      </header>

      <main id="main-content" className="mx-auto min-h-screen min-w-0 w-full max-w-[1500px] overflow-x-clip px-4 pb-24 pt-6 sm:px-6 lg:ml-64 lg:w-auto lg:px-10 lg:pb-10 lg:pt-9">
        {children}
      </main>

      <nav aria-label="Điều hướng trên thiết bị di động" className="fixed inset-x-0 bottom-0 z-30 grid min-w-0 max-w-full grid-cols-[repeat(4,minmax(0,1fr))] overflow-hidden border-t border-[var(--border)] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        {navigation.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 max-w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-1 text-[11px] font-semibold ${active ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "text-slate-500"}`}>
              <Icon aria-hidden="true" size={19} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-4">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-[0_8px_24px_rgba(15,118,110,0.22)]"><BookOpenText aria-hidden="true" size={20} /></span>
      <span className={`${compact ? "text-lg" : "text-xl"} font-black tracking-[-0.035em] text-slate-950`}>Lingua<span className="text-[var(--brand)]">Tube</span></span>
    </Link>
  );
}
