import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories } from "@/lib/catalog";
import { useProducts } from "@/lib/products-db";
import { Loader2, SlidersHorizontal } from "lucide-react";

const search = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "All components — lapkart" },
      { name: "description", content: "Browse RAM, SSDs, batteries, displays, processors and more." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { category, q } = Route.useSearch();
  const { data: products = [], isLoading } = useProducts();
  const filtered = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (q && !`${p.title} ${p.brand}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const currentCat = category ? categories.find((c) => c.slug === category) : null;

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />

      {/* Page header */}
      <div className="border-b border-[var(--border-faint)] bg-white">
        <div className="container mx-auto px-4 py-10">
          <nav className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
            <Link to="/" className="hover:text-[var(--heat-100)] transition-colors">home</Link>
            <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
            <Link to="/products" className="hover:text-[var(--heat-100)] transition-colors">catalog</Link>
            {currentCat && (
              <>
                <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
                <span className="text-[var(--heat-100)]">{currentCat.name}</span>
              </>
            )}
          </nav>
          <div className="mt-4 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="font-display text-title-h3 text-foreground">
                {currentCat ? currentCat.name : q ? `Results for "${q}"` : "All components"}
              </h1>
              <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">
                <span className="text-foreground font-medium">{filtered.length}</span> products
                {category && ` in ${currentCat?.name.toLowerCase()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="hidden h-fit lg:block lg:sticky lg:top-24">
          <h3 className="mb-4 flex items-center gap-2 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
            <SlidersHorizontal className="size-3" /> Categories
          </h3>
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/products"
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
            {categories.map((c) => {
              const count = products.filter((p) => p.category === c.slug).length;
              const active = category === c.slug;
              return (
                <li key={c.slug}>
                  <Link
                    to="/products"
                    search={{ category: c.slug }}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-label-small transition-colors ${
                      active
                        ? "bg-[var(--heat-8)] text-[var(--heat-100)]"
                        : "text-foreground hover:bg-[var(--black-alpha-4)]"
                    }`}
                  >
                    {c.name}
                    <span className="text-mono-x-small text-[var(--black-alpha-40)]">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <main>
          {isLoading ? (
            <div className="grid place-items-center py-24">
              <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-16 text-center">
              <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">no_match</p>
              <p className="mt-3 text-body-large text-foreground">No products found.</p>
              <Link
                to="/products"
                className="button button-primary mt-6 inline-flex items-center gap-2 rounded-md px-5 h-10 text-label-medium"
              >
                Reset filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p, i) => (
                <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                  <ProductCard p={p} />
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
