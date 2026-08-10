import Image from "next/image";
import Link from "next/link";
import { getCategories, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, featured] = await Promise.all([getCategories(), getProducts({ featured: true })]);

  return (
    <main>
      <section className="relative min-h-[440px] overflow-hidden bg-stone-950 text-white">
        <Image
          src="https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1800&q=85"
          alt="Clothing rack with curated apparel"
          fill
          priority
          className="object-cover opacity-58"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/10" />
        <div className="relative mx-auto grid min-h-[440px] max-w-7xl content-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-amber-200">New season edit</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight sm:text-6xl">StyleHub Store</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-stone-100">
              Clothing for busy weekdays, easy weekends, and the small humans with the strongest opinions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="focus-ring rounded-[6px] bg-white px-5 py-3 text-sm font-bold text-stone-950 hover:bg-stone-100"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="surface rounded-[8px] p-5 transition hover:border-stone-300 hover:bg-white"
            >
              <p className="text-sm font-semibold uppercase text-[var(--coral)]">{category.name}</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">{category.description}</h2>
            </Link>
          ))}
        </div>
      </section>

      {categories.map((category) => {
        const products = featured.filter((product) => product.category.slug === category.slug).slice(0, 4);
        return (
          <section key={category.id} className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase text-[var(--teal)]">Featured</p>
                <h2 className="text-3xl font-semibold text-stone-950">{category.name}</h2>
              </div>
              <Link className="text-sm font-bold text-stone-800 underline underline-offset-4" href={`/categories/${category.slug}`}>
                View all
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

