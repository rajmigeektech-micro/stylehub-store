"use client";

import Link from "next/link";
import { LayoutDashboard, ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function SiteHeader() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-mono text-lg font-bold tracking-normal text-stone-950">
          StyleHub
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-700 md:flex">
          <Link className="hover:text-stone-950" href="/categories/men">
            Men
          </Link>
          <Link className="hover:text-stone-950" href="/categories/women">
            Women
          </Link>
          <Link className="hover:text-stone-950" href="/categories/kids">
            Kids
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
            aria-label="Admin panel"
            title="Admin panel"
          >
            <LayoutDashboard className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-[6px] bg-[var(--ink)] text-white hover:bg-stone-700"
            aria-label="Cart"
            title="Cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

