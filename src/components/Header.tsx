import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, User, LogOut, Package, ChevronDown, Flame } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: query ? { q: query } : undefined });
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-xl shadow-[0_1px_0_0_var(--border-muted)]"
          : "bg-white border-b border-[var(--border-faint)]"
      }`}
    >
      {/* Top utility strip */}
      <div className="hidden md:block bg-[var(--accent-black)] text-white/70">
        <div className="container mx-auto flex items-center justify-between gap-6 px-4 py-1.5 text-mono-x-small">
          <span className="uppercase tracking-[0.18em]">
            <span className="text-[var(--heat-100)]">●</span>&nbsp;Free shipping on orders ₹999+
          </span>
          <div className="flex items-center gap-5 tracking-wider">
            <span className="opacity-80">India · ₹ INR</span>
            <Link to="/orders" className="hover:text-[var(--heat-100)] transition-colors">Track order</Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex items-center gap-4 px-4 py-3 sm:gap-8">
        <Link to="/" className="group flex items-baseline gap-2">
          <Flame className="size-5 text-[var(--heat-100)] -translate-y-px transition-transform group-hover:rotate-6" strokeWidth={2.4} />
          <div className="leading-none">
            <span className="font-display text-[22px] font-medium tracking-[-0.02em] text-foreground">
              lap<span className="text-[var(--heat-100)]">kart</span>
            </span>
            <span className="ml-1.5 text-mono-x-small text-[var(--black-alpha-40)]">/parts</span>
          </div>
        </Link>

        <form onSubmit={submit} className="hidden flex-1 md:block max-w-[520px]">
          <label className="group flex h-10 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] focus-within:border-[var(--heat-100)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--heat-12)] transition-all">
            <Search className="ml-3 size-[15px] text-[var(--black-alpha-40)] group-focus-within:text-[var(--heat-100)] transition-colors" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search RAM, SSDs, batteries…"
              className="h-full flex-1 bg-transparent px-3 text-body-medium outline-none placeholder:text-[var(--black-alpha-32)]"
            />
            <kbd className="mr-2 hidden lg:flex items-center gap-1 rounded-sm border border-[var(--border-muted)] bg-white px-1.5 py-0.5 text-mono-x-small text-[var(--black-alpha-48)]">
              ⌘K
            </kbd>
          </label>
        </form>

        <nav className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            to="/products"
            className="hidden md:inline-flex items-center text-label-medium text-foreground/80 hover:text-[var(--heat-100)] transition-colors px-2 py-2"
          >
            Shop
          </Link>
          <Link
            to="/repair"
            className="hidden lg:inline-flex items-center text-label-medium text-foreground/80 hover:text-[var(--heat-100)] transition-colors px-2 py-2"
          >
            Repair
          </Link>
          <Link
            to="/delivery"
            className="hidden lg:inline-flex items-center text-label-medium text-foreground/80 hover:text-[var(--heat-100)] transition-colors px-2 py-2"
          >
            Delivery
          </Link>
          <Link
            to="/ai-detection"
            className="hidden lg:inline-flex items-center text-label-medium text-foreground/80 hover:text-[var(--heat-100)] transition-colors px-2 py-2"
          >
            AI Detect
          </Link>

          {user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-label-small text-foreground hover:bg-[var(--black-alpha-4)] transition-colors"
              >
                <div className="grid size-7 place-items-center rounded-full bg-[var(--heat-100)] text-white text-mono-small font-medium">
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {(user.user_metadata?.full_name || user.email)?.split(" ")[0]?.split("@")[0]}
                </span>
                <ChevronDown className="size-3 text-[var(--black-alpha-40)]" />
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
                  >
                    <div className="border-b border-[var(--border-faint)] px-4 py-3">
                      <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">Signed in</p>
                      <p className="truncate text-label-small mt-0.5 text-foreground">{user.email}</p>
                    </div>
                    <MenuItem to="/orders" icon={Package} label="My orders" onClick={() => setOpen(false)} />
                    <MenuItem to="/dashboard" icon={Package} label="Customer dashboard" onClick={() => setOpen(false)} />
                    <MenuItem to="/vendor" icon={Package} label="Vendor dashboard" onClick={() => setOpen(false)} />
                    <MenuItem to="/admin" icon={Package} label="Admin dashboard" onClick={() => setOpen(false)} />
                    <button
                      onClick={async () => { setOpen(false); await signOut(); navigate({ to: "/" }); }}
                      className="flex w-full items-center gap-3 border-t border-[var(--border-faint)] px-4 py-2.5 text-label-small text-[var(--accent-crimson)] hover:bg-[var(--heat-4)] transition-colors"
                    >
                      <LogOut className="size-[15px]" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3 py-1.5 text-label-small text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] transition-colors"
            >
              <User className="size-4" /> <span className="hidden sm:inline">Login</span>
            </Link>
          )}

          <Link
            to="/cart"
            className="relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label-small text-foreground hover:bg-[var(--black-alpha-4)] transition-colors"
          >
            <ShoppingCart className="size-[18px]" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 18 }}
                className="absolute -right-0.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--heat-100)] px-1 text-[10px] font-medium text-white shadow-[0_2px_4px_0_var(--heat-40)]"
              >
                {count}
              </motion.span>
            )}
          </Link>
        </nav>
      </div>

      <div className="md:hidden border-t border-[var(--border-faint)]">
        <form onSubmit={submit} className="container mx-auto px-4 py-2.5">
          <label className="flex h-9 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] focus-within:border-[var(--heat-100)]">
            <Search className="ml-3 size-[15px] text-[var(--black-alpha-40)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts…"
              className="h-full flex-1 bg-transparent px-3 text-body-medium outline-none"
            />
          </label>
        </form>
      </div>
    </header>
  );
}

function MenuItem({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: typeof Package;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-label-small text-foreground hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)] transition-colors"
    >
      <Icon className="size-[15px] text-[var(--black-alpha-48)]" /> {label}
    </Link>
  );
}
