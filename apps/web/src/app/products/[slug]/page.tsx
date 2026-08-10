import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api";
import { AddToCartPanel } from "@/components/add-to-cart-panel";
import { ProductGallery } from "@/components/product-gallery";
import { StarRating } from "@/components/star-rating";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={`/categories/${product.category.slug}`} className="text-sm font-bold text-stone-600 underline underline-offset-4">
        {product.category.name}
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <ProductGallery images={product.images} />
        <div className="space-y-6">
          <AddToCartPanel product={product} />
          <section className="surface rounded-[8px] p-5">
            <StarRating rating={product.rating || 0} count={product.review_count} />
            <p className="mt-4 text-stone-700">{product.description}</p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-stone-950">Material</dt>
                <dd className="mt-1 text-stone-600">{product.material}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-950">Care</dt>
                <dd className="mt-1 text-stone-600">{product.care}</dd>
              </div>
            </dl>
          </section>
          <section className="surface rounded-[8px] p-5">
            <h2 className="text-xl font-semibold text-stone-950">Customer reviews</h2>
            <div className="mt-4 space-y-4">
              {product.reviews.map((review) => (
                <article key={review.id} className="border-t border-stone-200 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-stone-950">{review.title}</h3>
                      <p className="text-sm text-stone-500">{review.reviewer_name}</p>
                    </div>
                    <StarRating rating={review.rating} compact />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{review.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

