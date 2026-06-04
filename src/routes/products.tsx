import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGridSkeleton } from "@/components/LoadingSkeletons";
import { ProductCard } from "@/components/ProductCard";
import { categories, discountPct } from "@/lib/catalog";
import { useProducts } from "@/lib/products-db";
import { SlidersHorizontal, X } from "lucide-react";

const search = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  inStock: z.string().optional(),
  minRating: z.string().optional(),
  sort: z.string().optional(),
});

type ProductSearch = z.infer<typeof search>;

const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating-desc", label: "Top rated" },
  { value: "discount-desc", label: "Biggest discount" },
  { value: "newest", label: "Newest" },
];

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "All components - lapkart" },
      {
        name: "description",
        content: "Browse RAM, SSDs, batteries, displays, processors and more.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const { category, q, brand, minPrice, maxPrice, inStock, minRating, sort } = Route.useSearch();
  const { data: products = [], isLoading } = useProducts();

  const minPriceValue = Number(minPrice);
  const maxPriceValue = Number(maxPrice);
  const minRatingValue = Number(minRating);
  const activeSort = sortOptions.some((option) => option.value === sort) ? sort : "relevance";
  const currentCategory = category ? categories.find((item) => item.slug === category) : null;
  const scopedProducts = category
    ? products.filter((product) => product.category === category)
    : products;
  const brandOptions = Array.from(new Set(scopedProducts.map((product) => product.brand)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const updateSearch = (patch: Partial<ProductSearch>) => {
    const next: ProductSearch = {
      category,
      q,
      brand,
      minPrice,
      maxPrice,
      inStock,
      minRating,
      sort,
      ...patch,
    };

    for (const key of Object.keys(next) as Array<keyof ProductSearch>) {
      if (!next[key]) delete next[key];
    }

    void navigate({ to: "/products", search: next });
  };

  const filtered = products.filter((product) => {
    if (category && product.category !== category) return false;
    if (q && !`${product.title} ${product.brand}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (brand && product.brand !== brand) return false;
    if (Number.isFinite(minPriceValue) && product.price < minPriceValue) return false;
    if (Number.isFinite(maxPriceValue) && product.price > maxPriceValue) return false;
    if (inStock === "true" && product.stock <= 0) return false;
    if (Number.isFinite(minRatingValue) && product.rating < minRatingValue) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (activeSort === "price-asc") return a.price - b.price;
    if (activeSort === "price-desc") return b.price - a.price;
    if (activeSort === "rating-desc") return b.rating - a.rating;
    if (activeSort === "discount-desc") return discountPct(b) - discountPct(a);
    return 0;
  });

  const appliedFilters = [
    currentCategory ? { key: "category", label: currentCategory.name } : null,
    q ? { key: "q", label: `Search: ${q}` } : null,
    brand ? { key: "brand", label: brand } : null,
    minPrice ? { key: "minPrice", label: `Min ${formatPrice(Number(minPrice))}` } : null,
    maxPrice ? { key: "maxPrice", label: `Max ${formatPrice(Number(maxPrice))}` } : null,
    inStock === "true" ? { key: "inStock", label: "In stock" } : null,
    minRating ? { key: "minRating", label: `${minRating}+ rating` } : null,
    activeSort !== "relevance"
      ? { key: "sort", label: sortOptions.find((option) => option.value === activeSort)?.label }
      : null,
  ].filter(Boolean) as Array<{ key: keyof ProductSearch; label: string }>;

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />

      <div className="border-b border-[var(--border-faint)] bg-white">
        <div className="container mx-auto px-4 py-10">
          <nav className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
            <Link to="/" className="transition-colors hover:text-[var(--heat-100)]">
              home
            </Link>
            <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
            <Link to="/products" className="transition-colors hover:text-[var(--heat-100)]">
              catalog
            </Link>
            {currentCategory && (
              <>
                <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
                <span className="text-[var(--heat-100)]">{currentCategory.name}</span>
              </>
            )}
          </nav>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-title-h3 text-foreground">
                {currentCategory
                  ? currentCategory.name
                  : q
                    ? `Results for "${q}"`
                    : "All components"}
              </h1>
              <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">
                <span className="font-medium text-foreground">{sorted.length}</span> products
                {category && ` in ${currentCategory?.name.toLowerCase()}`}
              </p>
            </div>
            <label className="flex min-w-[220px] flex-col gap-2">
              <span className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                Sort
              </span>
              <select
                value={activeSort}
                onChange={(event) => updateSearch({ sort: event.target.value })}
                className="h-11 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {appliedFilters.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {appliedFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => updateSearch({ [filter.key]: undefined })}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--heat-20)] bg-[var(--heat-4)] px-3 text-label-small text-[var(--heat-100)]"
                >
                  {filter.label}
                  <X className="size-3.5" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => void navigate({ to: "/products", search: {} })}
                className="inline-flex h-8 items-center rounded-full border border-[var(--border-muted)] bg-white px-3 text-label-small text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[240px_1fr]">
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Link
              to="/products"
              search={q ? { q } : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-label-small transition-colors ${
                !category
                  ? "border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]"
                  : "border-[var(--border-muted)] bg-white text-foreground"
              }`}
            >
              All products
            </Link>
            {categories.map((item) => {
              const active = category === item.slug;
              return (
                <Link
                  key={item.slug}
                  to="/products"
                  search={q ? { category: item.slug, q } : { category: item.slug }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-label-small transition-colors ${
                    active
                      ? "border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]"
                      : "border-[var(--border-muted)] bg-white text-foreground"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="hidden h-fit space-y-7 lg:sticky lg:top-24 lg:block">
          <h3 className="mb-4 flex items-center gap-2 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
            <SlidersHorizontal className="size-3" /> Filters
          </h3>
          <FilterGroup title="Category">
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => updateSearch({ category: undefined, brand: undefined })}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-label-small transition-colors ${
                    !category
                      ? "bg-[var(--heat-8)] text-[var(--heat-100)]"
                      : "text-foreground hover:bg-[var(--black-alpha-4)]"
                  }`}
                >
                  All products
                  <span className="text-mono-x-small text-[var(--black-alpha-40)]">
                    {products.length}
                  </span>
                </button>
              </li>
              {categories.map((item) => {
                const count = products.filter((product) => product.category === item.slug).length;
                const active = category === item.slug;
                return (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => updateSearch({ category: item.slug, brand: undefined })}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-label-small transition-colors ${
                        active
                          ? "bg-[var(--heat-8)] text-[var(--heat-100)]"
                          : "text-foreground hover:bg-[var(--black-alpha-4)]"
                      }`}
                    >
                      {item.name}
                      <span className="text-mono-x-small text-[var(--black-alpha-40)]">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </FilterGroup>

          <FilterGroup title="Brand">
            <select
              value={brand ?? ""}
              onChange={(event) => updateSearch({ brand: event.target.value || undefined })}
              className="h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-small text-foreground"
            >
              <option value="">Any brand</option>
              {brandOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup title="Price">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={minPrice ?? ""}
                onChange={(event) => updateSearch({ minPrice: event.target.value })}
                inputMode="numeric"
                placeholder="Min"
                className="h-10 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-small"
              />
              <input
                value={maxPrice ?? ""}
                onChange={(event) => updateSearch({ maxPrice: event.target.value })}
                inputMode="numeric"
                placeholder="Max"
                className="h-10 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-small"
              />
            </div>
          </FilterGroup>

          <FilterGroup title="Availability">
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-label-small text-foreground hover:bg-[var(--black-alpha-4)]">
              <input
                type="checkbox"
                checked={inStock === "true"}
                onChange={(event) =>
                  updateSearch({ inStock: event.target.checked ? "true" : undefined })
                }
                className="size-4 accent-[var(--heat-100)]"
              />
              In stock only
            </label>
          </FilterGroup>

          <FilterGroup title="Rating">
            <select
              value={minRating ?? ""}
              onChange={(event) => updateSearch({ minRating: event.target.value || undefined })}
              className="h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-small text-foreground"
            >
              <option value="">Any rating</option>
              <option value="4.5">4.5 and above</option>
              <option value="4">4.0 and above</option>
              <option value="3.5">3.5 and above</option>
            </select>
          </FilterGroup>
        </aside>

        <main>
          {isLoading ? (
            <ProductGridSkeleton />
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-16 text-center">
              <p className="text-label-small text-[var(--heat-100)]">No matching parts</p>
              <p className="mt-3 text-body-large text-foreground">No products found.</p>
              <Link
                to="/products"
                className="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-label-medium"
              >
                Reset filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sorted.map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index * 30, 400)}ms` }}
                >
                  <ProductCard p={product} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
        {title}
      </h4>
      {children}
    </section>
  );
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "";
  return `₹${value.toLocaleString("en-IN")}`;
}
