import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, Heart, User, Menu, LogOut, Package, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth";

export function Header() {
  const items = useCart();
  const count = items.reduce((s, i) => s + i.qty, 0);
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: query ? { q: query } : undefined });
  };

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto flex items-center gap-3 px-4 py-2.5 sm:gap-6">
        <Link to="/" className="flex flex-col leading-none">
          <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Lap<span className="text-saffron">Kart</span>
          </span>
          <span className="text-[10px] italic opacity-80">
            Explore <span className="text-saffron">Genuine Parts</span>
          </span>
        </Link>

        <form onSubmit={submit} className="hidden flex-1 md:block">
          <div className="flex h-10 items-center overflow-hidden rounded-sm bg-card text-foreground shadow-sm">
            <Search className="ml-3 size-4 text-primary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for RAM, SSD, Motherboards…"
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link to="/products" className="hidden rounded-sm px-2.5 py-2 text-sm font-semibold hover:bg-white/10 sm:inline-block">Shop</Link>
          <Link to="/repair" className="hidden rounded-sm px-2.5 py-2 text-sm font-semibold hover:bg-white/10 md:inline-block">Repair</Link>
          <Link to="/trade-in" className="hidden rounded-sm px-2.5 py-2 text-sm font-semibold hover:bg-white/10 md:inline-block">Trade-In</Link>

          {user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10"
              >
                <div className="grid size-7 place-items-center rounded-full bg-saffron text-saffron-foreground text-xs font-bold">
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline">{(user.user_metadata?.full_name || user.email)?.split(" ")[0]?.split("@")[0]}</span>
                <ChevronDown className="size-3" />
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg bg-card text-foreground shadow-[var(--shadow-pop)]"
                  >
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-xs text-muted-foreground">Signed in as</p>
                      <p className="truncate text-sm font-semibold">{user.email}</p>
                    </div>
                    <Link to="/orders" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted">
                      <Package className="size-4" /> My Orders
                    </Link>
                    <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted">
                      <Package className="size-4" /> Admin Dashboard
                    </Link>
                    <Link to="/vendor" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted">
                      <Package className="size-4" /> Vendor Portal
                    </Link>
                    <button
                      onClick={async () => { setOpen(false); await signOut(); navigate({ to: "/" }); }}
                      className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5"
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1 rounded-sm bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
              <User className="size-4" /> <span className="hidden sm:inline">Login</span>
            </Link>
          )}

          <Link to="/products" className="hidden items-center gap-1 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10 md:flex">
            <Heart className="size-4" /> Wishlist
          </Link>
          <Link to="/cart" className="relative flex items-center gap-1.5 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10">
            <ShoppingCart className="size-5" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="absolute -right-1 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-[11px] font-bold text-saffron-foreground"
              >
                {count}
              </motion.span>
            )}
          </Link>
          <button className="md:hidden"><Menu className="size-6" /></button>
        </nav>
      </div>

      <div className="md:hidden">
        <form onSubmit={submit} className="container mx-auto px-4 pb-3">
          <div className="flex h-10 items-center overflow-hidden rounded-sm bg-card text-foreground">
            <Search className="ml-3 size-4 text-primary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts…"
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
