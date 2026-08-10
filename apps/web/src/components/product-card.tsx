import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { money } from "@/lib/api";
import { StarRating } from "./star-rating";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-[8px] border border-stone-200 bg-white transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm"
    >
      <div className="relative aspect-[4/5] bg-stone-100">
        {image && (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        )}
        {product.compare_at_cents && (
          <span className="absolute left-3 top-3 rounded-[4px] bg-white px-2 py-1 text-xs font-semibold text-[var(--coral)]">
            Sale
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div>
          <p className="text-xs font-semibold uppercase text-stone-500">{product.category.name}</p>
          <h3 className="mt-1 text-base font-semibold text-stone-950">{product.name}</h3>
        </div>
        <StarRating rating={product.rating || 0} count={product.review_count} compact />
        <div className="flex items-center gap-2">
          <span className="font-semibold">{money(product.price_cents)}</span>
          {product.compare_at_cents && <span className="text-sm text-stone-500 line-through">{money(product.compare_at_cents)}</span>}
        </div>
      </div>
    </Link>
  );
}

