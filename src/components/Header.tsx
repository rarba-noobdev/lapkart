import { Link } from "@tanstack/react-router";
import { Search, ShoppingCart, Heart, User, Menu } from "lucide-react";
import { useCart } from "@/lib/cart-store";

export function Header() {
  const items = useCart();
  const count = items.reduce((s, i) => s + i.qty, 0);

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

        <div className="hidden flex-1 md:block">
          <div className="flex h-10 items-center overflow-hidden rounded-sm bg-card text-foreground shadow-sm">
            <Search className="ml-3 size-4 text-primary" />
            <input
              type="search"
              placeholder="Search for RAM, SSD, Motherboards…"
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <nav className="ml-auto flex items-center gap-1 sm:gap-4">
          <Link
            to="/products"
            className="hidden rounded-sm px-3 py-2 text-sm font-semibold hover:bg-white/10 sm:inline-block"
          >
            Shop
          </Link>
          <button className="hidden items-center gap-1 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10 sm:flex">
            <User className="size-4" /> Login
          </button>
          <Link
            to="/products"
            className="hidden items-center gap-1 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10 md:flex"
          >
            <Heart className="size-4" /> Wishlist
          </Link>
          <Link
            to="/cart"
            className="relative flex items-center gap-1.5 rounded-sm px-2 py-2 text-sm font-semibold hover:bg-white/10"
          >
            <ShoppingCart className="size-5" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-[11px] font-bold text-saffron-foreground">
                {count}
              </span>
            )}
          </Link>
          <button className="md:hidden">
            <Menu className="size-6" />
          </button>
        </nav>
      </div>

      <div className="md:hidden">
        <div className="container mx-auto px-4 pb-3">
          <div className="flex h-10 items-center overflow-hidden rounded-sm bg-card text-foreground">
            <Search className="ml-3 size-4 text-primary" />
            <input
              type="search"
              placeholder="Search parts…"
              className="h-full flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
