import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 bg-[oklch(0.22_0.03_260)] text-white/80">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">
            About
          </h3>
          <ul className="space-y-2 text-sm">
            <li>Contact Us</li>
            <li>About LapKart</li>
            <li>Careers</li>
            <li>Press</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">
            Help
          </h3>
          <ul className="space-y-2 text-sm">
            <li>Payments</li>
            <li>Shipping</li>
            <li>Returns & Warranty</li>
            <li>FAQ</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">
            Policy
          </h3>
          <ul className="space-y-2 text-sm">
            <li>Privacy</li>
            <li>Terms of Use</li>
            <li>Security</li>
            <li>EPR Compliance</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">
            Shop
          </h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products">All Components</Link></li>
            <li>RAM & Storage</li>
            <li>Batteries & Chargers</li>
            <li>Repair Kits</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} LapKart. All rights reserved.</p>
          <p>Genuine laptop components · Fast delivery · Easy returns</p>
        </div>
      </div>
    </footer>
  );
}
