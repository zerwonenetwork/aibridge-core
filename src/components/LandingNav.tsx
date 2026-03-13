import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Menu, X, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import aibridgeLogo from "@/assets/logo.png";

const sections = [
  { id: "problem", label: "Problem" },
  { id: "structure", label: "Structure" },
  { id: "how-it-works", label: "How It Works" },
  { id: "agents", label: "Agents" },
  { id: "roadmap", label: "Roadmap" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/10" : "bg-transparent"
      }`}
    >
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src={aibridgeLogo} alt="AiBridge" className="w-7 h-7" />
          <span className="font-display text-sm font-bold text-foreground tracking-wide">AiBridge</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-display tracking-wide"
            >
              {s.label}
            </button>
          ))}

          <Link
            to="/docs"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-display tracking-wide flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </Link>

          <Button size="sm" variant="default" asChild className="gap-1.5 font-display text-xs">
            <Link to="/dashboard">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border overflow-hidden"
          >
            <div className="container max-w-6xl mx-auto px-4 py-4 space-y-3">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors font-display"
                >
                  {s.label}
                </button>
              ))}

              <Link
                to="/docs"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors font-display flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Docs
              </Link>

              <Button size="sm" variant="default" asChild className="w-full gap-1.5 font-display text-xs">
                <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
