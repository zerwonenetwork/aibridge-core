import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import aibridgeLogo from "@/assets/logo.svg";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const Footer = () => {
  const { ref, isInView } = useScrollReveal();

  return (
    <footer ref={ref} className="relative py-28 px-6">
      <div className="absolute inset-0 gradient-radial opacity-60" />

      {/* Top CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        className="relative container max-w-3xl mx-auto text-center mb-20"
      >
        <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
          Ready to <span className="text-gradient">bridge</span> your agents?
        </h2>
        <p className="text-muted-foreground mb-10 text-lg">
          Install in seconds. Free and open source.
        </p>
        <Button variant="hero" size="lg" className="gap-2 text-base px-8 py-6">
          <Terminal className="h-5 w-5" />
          npx aibridge init
        </Button>
      </motion.div>

      {/* Bottom */}
      <div className="relative container max-w-5xl mx-auto border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img src={aibridgeLogo} alt="AiBridge" className="h-7 w-7" />
          <span className="font-display text-sm font-bold text-foreground tracking-tight">AiBridge</span>
          <span className="text-xs text-muted-foreground/50">by ZerwOne</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="https://github.com/zerwone/aibridge-core" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/50 hover:text-primary transition-colors font-display">GitHub</a>
        </div>
        <p className="text-xs text-muted-foreground/40 font-display">
          MIT License
        </p>
      </div>
    </footer>
  );
};

export default Footer;
