"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { money, publicApiBase } from "@/lib/api";
import { useCart } from "@/components/cart-provider";

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const [name, setName] = useState("Test Shopper");
  const [email, setEmail] = useState("test.shopper@example.com");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shipping = subtotal >= 12500 || subtotal === 0 ? 0 : 895;
  const tax = Math.round(subtotal * 0.0825);
  const total = subtotal + shipping + tax;

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${publicApiBase}/api/checkout/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name, email },
          items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed.");
      clearCart();
      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <section>
        <h1 className="text-4xl font-semibold text-stone-950">Cart</h1>
        {items.length === 0 ? (
          <div className="surface mt-6 rounded-[8px] p-8">
            <p className="text-stone-700">Your cart is empty.</p>
            <Link href="/" className="mt-4 inline-flex rounded-[6px] bg-stone-950 px-5 py-3 text-sm font-bold text-white">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-stone-200 overflow-hidden rounded-[8px] border border-stone-200 bg-white">
            {items.map((item) => (
              <article key={item.variantId} className="grid gap-4 p-4 sm:grid-cols-[120px_1fr_auto]">
                <div className="relative aspect-square overflow-hidden rounded-[6px] bg-stone-100">
                  {item.image && <Image src={item.image} alt={item.productName || "Cart item"} fill className="object-cover" sizes="120px" />}
                </div>
                <div>
                  <Link href={`/products/${item.productSlug}`} className="font-semibold text-stone-950">
                    {item.productName}
                  </Link>
                  <p className="mt-1 text-sm text-stone-600">
                    {item.size} / {item.color}
                  </p>
                  <p className="mt-2 font-semibold">{money(item.price_cents)}</p>
                  <div className="mt-4 inline-flex h-10 overflow-hidden rounded-[6px] border border-stone-200">
                    <button className="focus-ring w-10" onClick={() => updateQuantity(item.variantId, item.quantity - 1)} aria-label="Decrease quantity">
                      -
                    </button>
                    <span className="grid w-10 place-items-center border-x border-stone-200 text-sm font-semibold">{item.quantity}</span>
                    <button className="focus-ring w-10" onClick={() => updateQuantity(item.variantId, item.quantity + 1)} aria-label="Increase quantity">
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="focus-ring h-10 w-10 rounded-[6px] border border-stone-200 text-stone-600 hover:border-stone-300"
                  onClick={() => removeItem(item.variantId)}
                  aria-label={`Remove ${item.productName}`}
                  title="Remove"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="surface h-fit rounded-[8px] p-5">
        <h2 className="text-xl font-semibold text-stone-950">Checkout</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{shipping ? money(shipping) : "Free"}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Estimated tax</dt>
            <dd>{money(tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <form className="mt-5 space-y-3" onSubmit={checkout}>
          <label className="block text-sm font-semibold text-stone-800">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="focus-ring mt-1 h-11 w-full rounded-[6px] border border-stone-200 px-3"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-stone-800">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="focus-ring mt-1 h-11 w-full rounded-[6px] border border-stone-200 px-3"
              required
            />
          </label>
          {error && <p className="rounded-[6px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={items.length === 0 || loading} className="focus-ring btn-primary h-12 w-full rounded-[6px] text-sm font-bold disabled:bg-stone-300">
            {loading ? "Opening Stripe..." : "Pay with Stripe Test Mode"}
          </button>
        </form>
      </aside>
    </main>
  );
}
