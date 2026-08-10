"use client";

import { useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/lib/types";
import { money } from "@/lib/api";
import { useCart } from "./cart-provider";

export function AddToCartPanel({ product }: { product: Product }) {
  const { addItem } = useCart();
  const sizes = useMemo(() => Array.from(new Set(product.variants.map((variant) => variant.size))), [product.variants]);
  const [size, setSize] = useState(sizes[0]);
  const colors = useMemo(
    () => Array.from(new Set(product.variants.filter((variant) => variant.size === size).map((variant) => variant.color))),
    [product.variants, size]
  );
  const [color, setColor] = useState(colors[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  const selectedVariant: ProductVariant | undefined =
    product.variants.find((variant) => variant.size === size && variant.color === color) ||
    product.variants.find((variant) => variant.size === size);

  function handleSize(nextSize: string) {
    setSize(nextSize);
    const nextColor = product.variants.find((variant) => variant.size === nextSize)?.color || "";
    setColor(nextColor);
    setQuantity(1);
  }

  function handleAdd() {
    if (!selectedVariant || selectedVariant.stock <= 0) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      image: product.images[0]?.url || "",
      size: selectedVariant.size,
      color: selectedVariant.color,
      price_cents: product.price_cents,
      stock: selectedVariant.stock,
      quantity,
    });
    setNotice("Added to cart.");
  }

  return (
    <section className="surface rounded-[8px] p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--teal)]">{product.category.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">{product.name}</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{money(product.price_cents)}</p>
          {product.compare_at_cents && <p className="text-sm text-stone-500 line-through">{money(product.compare_at_cents)}</p>}
        </div>
      </div>

      <p className="mt-4 text-stone-700">{product.short_description}</p>

      <div className="mt-6 space-y-5">
        <div>
          <p className="text-sm font-semibold text-stone-800">Size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((candidate) => (
              <button
                key={candidate}
                onClick={() => handleSize(candidate)}
                className={`focus-ring h-10 min-w-12 rounded-[6px] border px-3 text-sm font-semibold ${
                  candidate === size ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-800"
                }`}
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-stone-800">Color</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((candidate) => (
              <button
                key={candidate}
                onClick={() => setColor(candidate)}
                className={`focus-ring rounded-[6px] border px-3 py-2 text-sm font-semibold ${
                  candidate === color ? "border-[var(--teal)] bg-teal-50 text-stone-950" : "border-stone-200 bg-white text-stone-800"
                }`}
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-stone-800">Quantity</p>
            <div className="mt-2 flex h-10 overflow-hidden rounded-[6px] border border-stone-200 bg-white">
              <button className="focus-ring w-10" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">
                -
              </button>
              <span className="grid w-10 place-items-center border-x border-stone-200 text-sm font-semibold">{quantity}</span>
              <button
                className="focus-ring w-10"
                onClick={() => setQuantity(Math.min(selectedVariant?.stock || 1, quantity + 1))}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
          <p className="text-sm text-stone-600">{selectedVariant ? `${selectedVariant.stock} in stock` : "Unavailable"}</p>
        </div>

        <button
          onClick={handleAdd}
          disabled={!selectedVariant || selectedVariant.stock <= 0}
          className="focus-ring btn-primary h-12 w-full rounded-[6px] px-5 text-sm font-bold disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Add to cart
        </button>
        {notice && <p className="text-sm font-semibold text-[var(--teal)]">{notice}</p>}
      </div>
    </section>
  );
}

