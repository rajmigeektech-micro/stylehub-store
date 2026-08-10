"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(images[0]);

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] bg-stone-100">
        {active && <Image src={active.url} alt={active.alt} fill priority className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {images.map((image) => (
          <button
            key={image.id}
            onClick={() => setActive(image)}
            className={`focus-ring relative aspect-square overflow-hidden rounded-[6px] border bg-stone-100 ${
              active?.id === image.id ? "border-stone-950" : "border-stone-200"
            }`}
            aria-label={`Show ${image.alt}`}
          >
            <Image src={image.url} alt={image.alt} fill className="object-cover" sizes="120px" />
          </button>
        ))}
      </div>
    </div>
  );
}

