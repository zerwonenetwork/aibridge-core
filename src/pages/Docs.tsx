import { useState, useMemo, useEffect, useRef } from "react";
import { useSEOHead } from "@/hooks/useSEOHead";
import { ArchitectureDiagram } from "@/components/docs/ArchitectureDiagram";
import { FileTreeDiagram } from "@/components/docs/FileTreeDiagram";
import { Link } from "react-router-dom";
import { Search, ChevronLeft, Menu, X, Rocket, Lightbulb, FileJson, Terminal, LayoutDashboard, Globe, BookOpen, HelpCircle, ChevronRight, ExternalLink, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { docsCategories, docsSections, type DocSection } from "@/lib/docs-content";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import aibridgeLogo from "@/assets/logo.svg";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-diff";

const iconMap: Record<string, React.ElementType> = {
  Rocket, Lightbulb, FileJson, Terminal, LayoutDashboard, Globe, BookOpen, HelpCircle,
};

function CodeBlock({ lang, code, highlighted }: { lang: string; code: string; highlighted: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group my-4 rounded-lg border border-border overflow-hidden relative">
      {lang && (
        <div className="px-4 py-1.5 border-b border-border bg-muted/30 text-xs text-muted-foreground font-display flex items-center justify-between">
          <span>{lang}</span>
          <button onClick={handleCopy} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[10px]">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
      {!lang && (
        <button onClick={handleCopy} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed !bg-[#1d1f21] !m-0">
        <code className={`font-mono language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function renderMarkdown(content: string, onNavigate?: (sectionId: string) => void) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const codeText = codeLines.join("\n");
        const lang = codeLang || "plaintext";
        const grammar = Prism.languages[lang];
        const highlighted = grammar
          ? Prism.highlight(codeText, grammar, lang)
          : codeText;
        elements.push(
          <CodeBlock key={i} lang={codeLang} code={codeText} highlighted={highlighted} />
        );
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Custom component markers
    if (line.trim() === "<!-- architecture-diagram -->") {
      elements.push(<ArchitectureDiagram key={i} onNavigate={onNavigate} />);
      i++;
      continue;
    }
    if (line.trim() === "<!-- file-tree -->") {
      elements.push(<FileTreeDiagram key={i} />);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-3xl md:text-4xl font-display font-extrabold tracking-tight mt-2 mb-6 text-foreground">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-xl md:text-2xl font-display font-bold tracking-tight mt-10 mb-4 text-foreground border-b border-border pb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-lg font-display font-semibold mt-6 mb-3 text-foreground">{line.slice(4)}</h3>);
    }
    // Blockquote
    else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-4 my-4 text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }
    // Table
    else if (line.startsWith("|")) {
      const tableLines: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      elements.push(renderTable(tableLines, i));
      i = j;
      continue;
    }
    // List
    else if (line.match(/^- /)) {
      const listItems: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && lines[j].match(/^- /)) {
        listItems.push(lines[j].slice(2));
        j++;
      }
      elements.push(
        <ul key={i} className="my-3 space-y-1.5 list-none">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-foreground/85">
              <span className="text-primary mt-1.5 text-xs">●</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }
    // Empty line
    else if (line.trim() === "") {
      // skip
    }
    // Paragraph
    else {
      elements.push(<p key={i} className="my-3 text-foreground/80 leading-relaxed">{renderInline(line)}</p>);
    }

    i++;
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Process inline code, bold, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
    // Link
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);

    let earliest: { type: string; index: number; match: RegExpMatchArray } | null = null;

    if (codeMatch && codeMatch[1] !== undefined) {
      const idx = codeMatch[1].length;
      if (!earliest || idx < earliest.index) earliest = { type: "code", index: idx, match: codeMatch };
    }
    if (boldMatch && boldMatch[1] !== undefined) {
      const idx = boldMatch[1].length;
      if (!earliest || idx < earliest.index) earliest = { type: "bold", index: idx, match: boldMatch };
    }
    if (linkMatch && linkMatch[1] !== undefined) {
      const idx = linkMatch[1].length;
      if (!earliest || idx < earliest.index) earliest = { type: "link", index: idx, match: linkMatch };
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    if (earliest.type === "code") {
      const m = earliest.match;
      if (m[1]) parts.push(m[1]);
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-[0.85em]">{m[2]}</code>);
      remaining = m[3] || "";
    } else if (earliest.type === "bold") {
      const m = earliest.match;
      if (m[1]) parts.push(m[1]);
      parts.push(<strong key={key++} className="font-semibold text-foreground">{m[2]}</strong>);
      remaining = m[3] || "";
    } else if (earliest.type === "link") {
      const m = earliest.match;
      if (m[1]) parts.push(m[1]);
      parts.push(
        <a key={key++} href={m[3]} className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors" target="_blank" rel="noopener noreferrer">
          {m[2]}
        </a>
      );
      remaining = m[4] || "";
    }
  }

  return <>{parts}</>;
}

function renderTable(tableLines: string[], baseKey: number) {
  const rows = tableLines
    .filter(l => !l.match(/^\|[\s-|]+\|$/))
    .map(l => l.split("|").filter(Boolean).map(c => c.trim()));

  if (rows.length === 0) return null;

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div key={baseKey} className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            {header.map((cell, j) => (
              <th key={j} className="px-4 py-2.5 text-left font-display font-semibold text-foreground/90 border-b border-border">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-foreground/80">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  useSEOHead({
    title: "Documentation — AiBridge | Local-First AI Agent Coordination",
    description: "Complete documentation for AiBridge — the .aibridge protocol, CLI commands, local service, dashboard, auto-capture, and multi-agent coordination.",
    canonical: "https://aibridge.dev/docs",
    ogImage: "https://aibridge.dev/og-image.png",
  });

  const [activeSection, setActiveSection] = useState("introduction");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([
    docsCategories.find(c => docsSections.find(s => s.id === "introduction")?.category === c.id)?.id ?? "getting-started"
  ]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return docsSections;
    const q = search.toLowerCase();
    return docsSections.filter(
      s => s.title.toLowerCase().includes(q) || s.keywords.some(k => k.includes(q)) || s.content.toLowerCase().includes(q)
    );
  }, [search]);

  const currentSection = docsSections.find(s => s.id === activeSection) || docsSections[0];

  const toggleCategory = (id: string) => {
    setOpenCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    // Auto-expand the category of the target section
    const targetSection = docsSections.find(s => s.id === id);
    if (targetSection) {
      setOpenCategories(prev =>
        prev.includes(targetSection.category) ? prev : [...prev, targetSection.category]
      );
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Find prev/next
  const currentIndex = docsSections.findIndex(s => s.id === activeSection);
  const prevSection = currentIndex > 0 ? docsSections[currentIndex - 1] : null;
  const nextSection = currentIndex < docsSections.length - 1 ? docsSections[currentIndex + 1] : null;

  // Extract headings for table of contents
  const headings = currentSection.content
    .split("\n")
    .filter(l => l.match(/^#{2,3} /))
    .map(l => ({
      level: l.startsWith("### ") ? 3 : 2,
      text: l.replace(/^#{2,3} /, ""),
    }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center h-14 px-4 gap-3">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={aibridgeLogo} alt="AiBridge" className="w-6 h-6" />
            <span className="font-display text-sm font-bold tracking-wide">AiBridge</span>
          </Link>

          <Badge variant="outline" className="text-[10px] font-display shrink-0">Docs</Badge>

          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search documentation..."
                className="pl-9 pr-16 h-9 text-sm bg-muted/30 border-border/60"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground font-mono">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>

          <ThemeToggle />

          <Link to="/dashboard" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Dashboard <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={cn(
          "w-72 border-r border-border bg-background shrink-0 flex flex-col",
          "fixed lg:sticky top-14 h-[calc(100vh-3.5rem)] z-40",
          "transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-1">
              {docsCategories.map(cat => {
                const Icon = iconMap[cat.icon] || BookOpen;
                const sections = filteredSections.filter(s => s.category === cat.id);
                if (sections.length === 0 && search) return null;

                return (
                  <Collapsible
                    key={cat.id}
                    open={openCategories.includes(cat.id)}
                    onOpenChange={() => toggleCategory(cat.id)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full px-2.5 py-2 text-sm font-display font-semibold text-foreground/80 hover:text-foreground rounded-md hover:bg-muted/40 transition-colors">
                      <Icon className="w-4 h-4 text-primary/70" />
                      {cat.label}
                      <ChevronRight className={cn(
                        "w-3.5 h-3.5 ml-auto transition-transform text-muted-foreground",
                        openCategories.includes(cat.id) && "rotate-90"
                      )} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 pl-2 border-l border-border/60 space-y-0.5 mt-0.5 mb-2">
                        {sections.map(section => (
                          <button
                            key={section.id}
                            onClick={() => handleSectionClick(section.id)}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 text-sm rounded-md transition-colors",
                              activeSection === section.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            )}
                          >
                            {section.title}
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <Link
              to="/"
              className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to site
            </Link>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 flex gap-10">
            {/* Main content */}
            <article className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
                <span>Docs</span>
                <ChevronRight className="w-3 h-3" />
                <span>{docsCategories.find(c => c.id === currentSection.category)?.label}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{currentSection.title}</span>
              </div>

              {/* Search results mode */}
              {search && filteredSections.length > 0 && (
                <div className="mb-8 p-4 rounded-lg border border-border bg-muted/20">
                  <p className="text-sm text-muted-foreground mb-3">
                    {filteredSections.length} result{filteredSections.length !== 1 ? "s" : ""} for "{search}"
                  </p>
                  <div className="space-y-1">
                    {filteredSections.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { handleSectionClick(s.id); setSearch(""); }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted/40 transition-colors flex items-center gap-2"
                      >
                        <span className="text-foreground font-medium">{s.title}</span>
                        <Badge variant="outline" className="text-[10px]">{docsCategories.find(c => c.id === s.category)?.label}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {search && filteredSections.length === 0 && (
                <div className="text-center py-16">
                  <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">No results found for "{search}"</p>
                </div>
              )}

              {/* Rendered content */}
              {(!search || filteredSections.length > 0) && (
                <div className="docs-content">{renderMarkdown(currentSection.content, handleSectionClick)}</div>
              )}

              {/* Prev/Next navigation */}
              <div className="flex items-center justify-between mt-16 pt-6 border-t border-border">
                {prevSection ? (
                  <button
                    onClick={() => handleSectionClick(prevSection.id)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground/60">Previous</div>
                      <div className="font-medium">{prevSection.title}</div>
                    </div>
                  </button>
                ) : <div />}
                {nextSection ? (
                  <button
                    onClick={() => handleSectionClick(nextSection.id)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground/60">Next</div>
                      <div className="font-medium">{nextSection.title}</div>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : <div />}
              </div>
            </article>

            {/* Table of contents (right side) */}
            {headings.length > 1 && (
              <aside className="hidden xl:block w-48 shrink-0">
                <div className="sticky top-24">
                  <p className="text-xs font-display font-semibold text-muted-foreground mb-3 uppercase tracking-wider">On this page</p>
                  <nav className="space-y-1.5 border-l border-border/60 pl-3">
                    {headings.map((h, i) => (
                      <div
                        key={i}
                        className={cn(
                          "text-xs text-muted-foreground hover:text-foreground transition-colors cursor-default",
                          h.level === 3 && "ml-2"
                        )}
                      >
                        {h.text}
                      </div>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
