export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  position?: number;
  active?: boolean;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  position: number;
};

export type ProductVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
};

export type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  approved?: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  material?: string;
  care?: string;
  price_cents: number;
  compare_at_cents?: number | null;
  featured: boolean;
  active: boolean;
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  reviews: Review[];
  rating: number;
  review_count: number;
};

