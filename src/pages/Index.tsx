import { LandingNav } from "@/components/LandingNav";
import HeroSection from "@/components/HeroSection";
import ProblemSolution from "@/components/ProblemSolution";
import FileStructure from "@/components/FileStructure";
import HowItWorks from "@/components/HowItWorks";
import AgentsAndCommands from "@/components/AgentsAndCommands";
import RoadmapAndPhilosophy from "@/components/RoadmapAndPhilosophy";
import Footer from "@/components/Footer";
import { useSEOHead } from "@/hooks/useSEOHead";

const Index = () => {
  useSEOHead({
    title: "AiBridge — Local-First AI Agent Coordination for Multi-Agent Development",
    description: "Coordinate multiple AI coding agents from a single .aibridge directory. Shared context, task tracking, conventions, and handoffs across Cursor, Claude Code, Codex, Copilot, and Windsurf.",
    canonical: "https://aibridge.dev/",
    ogImage: "https://aibridge.dev/og-image.png",
  });

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <div id="problem"><ProblemSolution /></div>
      <div id="structure"><FileStructure /></div>
      <div id="how-it-works"><HowItWorks /></div>
      <div id="agents"><AgentsAndCommands /></div>
      <div id="roadmap"><RoadmapAndPhilosophy /></div>
      <Footer />
    </div>
  );
};

export default Index;
