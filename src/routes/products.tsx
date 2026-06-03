import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGridSkeleton } from "@/components/LoadingSkeletons";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/catalog";
import { useProducts } from "@/lib/products-db";
import { SlidersHorizontal } from "lucide-react";

const search = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

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
  const { category, q } = Route.useSearch();
  const { data: products = [], isLoading } = useProducts();
  const filtered = products.filter((product) => {
    if (category && product.category !== category) return false;
    if (q && !`${product.title} ${product.brand}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });
  const currentCategory = category ? categories.find((item) => item.slug === category) : null;

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
                <span className="font-medium text-foreground">{filtered.length}</span> products
                {category && ` in ${currentCategory?.name.toLowerCase()}`}
              </p>
            </div>
          </div>
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

        <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
          <h3 className="mb-4 flex items-center gap-2 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
            <SlidersHorizontal className="size-3" /> Categories
          </h3>
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/products"
                search={q ? { q } : undefined}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-label-small transition-colors ${
                  !category
                    ? "bg-[var(--heat-8)] text-[var(--heat-100)]"
                    : "text-foreground hover:bg-[var(--black-alpha-4)]"
                }`}
              >
                All products
                <span className="text-mono-x-small text-[var(--black-alpha-40)]">
                  {products.length}
                </span>
              </Link>
            </li>
            {categories.map((item) => {
              const count = products.filter((product) => product.category === item.slug).length;
              const active = category === item.slug;
              return (
                <li key={item.slug}>
                  <Link
                    to="/products"
                    search={q ? { category: item.slug, q } : { category: item.slug }}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-label-small transition-colors ${
                      active
                        ? "bg-[var(--heat-8)] text-[var(--heat-100)]"
                        : "text-foreground hover:bg-[var(--black-alpha-4)]"
                    }`}
                  >
                    {item.name}
                    <span className="text-mono-x-small text-[var(--black-alpha-40)]">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <main>
          {isLoading ? (
            <ProductGridSkeleton />
          ) : filtered.length === 0 ? (
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
              {filtered.map((product, index) => (
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
