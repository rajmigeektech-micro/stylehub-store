create extension if not exists "uuid-ossp" with schema extensions;

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'SH-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default extensions.uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text not null,
  material text,
  care text,
  price_cents integer not null check (price_cents > 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents >= price_cents),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  color text not null,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create table if not exists public.customers (
  id uuid primary key default extensions.uuid_generate_v4(),
  email text not null unique,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text not null,
  body text not null,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_number text not null unique default public.next_order_number(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  stripe_session_id text unique,
  stripe_payment_intent text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null,
  product_slug text not null,
  variant_sku text not null,
  size text not null,
  color text not null,
  image_url text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists product_images_product_id_idx on public.product_images(product_id);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists reviews_product_id_idx on public.reviews(product_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists product_variants_low_stock_idx on public.product_variants(stock);

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_stripe_session_id text,
  p_payment_intent text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_summary jsonb;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.payment_status <> 'paid' then
    for v_item in
      select * from public.order_items where order_id = p_order_id order by created_at
    loop
      update public.product_variants
      set stock = stock - v_item.quantity
      where id = v_item.variant_id and stock >= v_item.quantity;

      if not found then
        raise exception 'Insufficient inventory for sku %', v_item.variant_sku;
      end if;
    end loop;

    update public.orders
    set
      payment_status = 'paid',
      status = 'paid',
      stripe_session_id = coalesce(p_stripe_session_id, stripe_session_id),
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent),
      paid_at = coalesce(paid_at, now())
    where id = p_order_id;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'payment_status', o.payment_status,
    'status', o.status,
    'total_cents', o.total_cents,
    'customer_name', c.name,
    'customer_email', c.email,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'variant_sku', oi.variant_sku,
          'size', oi.size,
          'color', oi.color,
          'quantity', oi.quantity,
          'unit_price_cents', oi.unit_price_cents,
          'line_total_cents', oi.line_total_cents
        )
        order by oi.created_at
      ) filter (where oi.id is not null),
      '[]'::jsonb
    )
  )
  into v_summary
  from public.orders o
  join public.customers c on c.id = o.customer_id
  left join public.order_items oi on oi.order_id = o.id
  where o.id = p_order_id
  group by o.id, c.id;

  return v_summary;
end;
$$;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
on public.product_images for select
to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.active = true));

drop policy if exists "Public can read product variants" on public.product_variants;
create policy "Public can read product variants"
on public.product_variants for select
to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.active = true));

drop policy if exists "Public can read approved reviews" on public.reviews;
create policy "Public can read approved reviews"
on public.reviews for select
to anon, authenticated
using (approved = true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.categories, public.products, public.product_images, public.product_variants, public.reviews to anon, authenticated;
grant all on public.categories, public.products, public.product_images, public.product_variants, public.customers, public.reviews, public.orders, public.order_items to service_role;
grant usage, select on sequence public.order_number_seq to service_role;
grant execute on function public.mark_order_paid(uuid, text, text) to service_role;
grant execute on function public.next_order_number() to service_role;
