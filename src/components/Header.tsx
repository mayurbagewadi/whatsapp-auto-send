import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const CHROME_STORE_URL = "#";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Privacy", href: "/privacy" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/95 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-mono text-xl font-bold tracking-tight text-foreground">
          Wasapp<span className="text-gradient">Bulk</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) =>
            l.href.startsWith("/") && !l.href.includes("#") ? (
              <Link key={l.label} to={l.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </a>
            )
          )}
          <a
            href={CHROME_STORE_URL}
            className="gradient-cta text-primary-foreground text-sm font-semibold px-5 py-2 rounded-[var(--radius)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Install Extension
          </a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-foreground" aria-label="Toggle menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-background/98 backdrop-blur-md border-b border-border px-6 pb-6 animate-[fade-up_0.2s_ease-out]">
          {navLinks.map((l) =>
            l.href.startsWith("/") && !l.href.includes("#") ? (
              <Link key={l.label} to={l.href} onClick={() => setMenuOpen(false)} className="block py-3 text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block py-3 text-muted-foreground hover:text-primary transition-colors">
                {l.label}
              </a>
            )
          )}
          <a href={CHROME_STORE_URL} className="block mt-3 gradient-cta text-primary-foreground text-center font-semibold px-5 py-3 rounded-[var(--radius)]">
            Install Extension
          </a>
        </div>
      )}
    </header>
  );
}
