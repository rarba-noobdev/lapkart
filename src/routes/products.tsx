import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { categories, products } from "@/lib/catalog";

const search = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "All Laptop Components — LapKart" },
      { name: "description", content: "Browse RAM, SSDs, batteries, displays, processors and more." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { category, q } = Route.useSearch();
  const filtered = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (q && !`${p.title} ${p.brand}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden h-fit rounded-lg border border-border bg-card p-4 lg:block">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Categories
          </h3>
          <ul className="space-y-1 text-sm">
            <li>
              <Link
                to="/products"
                className={`block rounded px-2 py-1.5 hover:bg-accent ${!category ? "bg-accent font-semibold text-primary" : ""}`}
              >
                All Products
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/products"
                  search={{ category: c.slug }}
                  className={`block rounded px-2 py-1.5 hover:bg-accent ${category === c.slug ? "bg-accent font-semibold text-primary" : ""}`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {category ? categories.find((c) => c.slug === category)?.name : "All Components"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filtered.length} items)
              </span>
            </h1>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">No products found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
