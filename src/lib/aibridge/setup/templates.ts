import type { SetupTemplate, SetupTemplateId } from "./types";

const sharedWorkflow = {
  handoffPattern: "Lead agent creates scope and starter tasks, implementation agent executes, review agent validates before handoff back to lead.",
  reviewCadence: "Review after scaffold completion, after first working slice, and before release/update notes.",
};

const templates: SetupTemplate[] = [
  {
    id: "web-app",
    label: "Web App",
    description: "Browser-based product with UI, routing, and integration layers.",
    defaultPrimaryDeliverable: "Responsive web application with a working primary user flow.",
    structureAssumptions: ["frontend app shell", "core UI routes", "shared components", "tests for primary flow"],
    suggestedStacks: ["react", "vite", "typescript", "tailwind", "supabase"],
    defaultPriorities: ["quality", "speed"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Lead Builder", agentKind: "cursor", responsibilities: ["define scope", "implement UI shell"], ownership: ["app shell", "primary flow"] },
      { key: "review", name: "Reviewer", agentKind: "codex", responsibilities: ["review architecture", "tighten tests"], ownership: ["testing", "quality gates"] },
      { key: "content", name: "Content & QA", agentKind: "claude", responsibilities: ["refine copy", "check UX edge cases"], ownership: ["copy", "handoffs"] },
    ],
    defaultConventions: [
      { key: "web-flow", rule: "Preserve the primary user flow while iterating on UI structure.", category: "workflow" },
      { key: "web-tests", rule: "Add regression coverage for the main route before shipping changes.", category: "testing" },
    ],
    defaultTaskBlueprints: [
      { key: "scope", title: "Define product scope and acceptance flow", summary: "Turn the brief into a clear implementation slice for the first release.", priority: "high", suggestedRoleKey: "lead" },
      { key: "stack", title: "Confirm frontend stack and app structure", summary: "Lock the stack, routing approach, and shared component boundaries.", priority: "high", suggestedRoleKey: "lead" },
      { key: "build", title: "Implement the first working UI slice", summary: "Build the primary route and make it functional end to end.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tests", title: "Add regression coverage for the primary flow", summary: "Protect the working slice with practical tests.", priority: "medium", suggestedRoleKey: "review" },
      { key: "review", title: "Review polish, responsiveness, and accessibility", summary: "Validate the first slice on desktop/mobile and fix obvious issues.", priority: "medium", suggestedRoleKey: "content" },
      { key: "release", title: "Prepare release notes and definition-of-done review", summary: "Capture what shipped and what still blocks release.", priority: "low", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "Primary route works end to end.",
      "Responsive layout is acceptable on desktop and mobile.",
      "Main user flow has regression coverage.",
      "Known gaps are documented before release notes are written.",
    ],
    workflowPattern: {
      summary: "UI-first implementation with explicit review and release-note preparation.",
      ...sharedWorkflow,
      milestones: ["scope approved", "working UI slice", "tests green", "release notes drafted"],
    },
  },
  {
    id: "api-backend",
    label: "API Backend",
    description: "Service or backend API with schema, handlers, and tests.",
    defaultPrimaryDeliverable: "Versioned API with documented contract and passing tests.",
    structureAssumptions: ["service entrypoints", "data layer", "API contract", "integration tests"],
    suggestedStacks: ["node", "typescript", "postgres", "supabase", "vitest"],
    defaultPriorities: ["quality", "security"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "API Lead", agentKind: "cursor", responsibilities: ["shape contracts", "implement handlers"], ownership: ["API surface", "persistence"] },
      { key: "review", name: "Reliability Reviewer", agentKind: "codex", responsibilities: ["check edge cases", "tighten tests"], ownership: ["validation", "test quality"] },
    ],
    defaultConventions: [
      { key: "api-contract", rule: "Keep request/response contracts explicit and versioned.", category: "architecture" },
      { key: "api-validation", rule: "Validate all external input before it touches persistence.", category: "testing" },
    ],
    defaultTaskBlueprints: [
      { key: "contract", title: "Define API contract and persistence boundaries", summary: "Document the API shape and data model before implementation.", priority: "high", suggestedRoleKey: "lead" },
      { key: "scaffold", title: "Scaffold service and data access layer", summary: "Create the executable service entrypoint and repository structure.", priority: "high", suggestedRoleKey: "lead" },
      { key: "core", title: "Implement the first production route", summary: "Ship the highest-value API route with validation and persistence.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tests", title: "Add integration and validation tests", summary: "Cover success path, invalid input, and permission edge cases.", priority: "high", suggestedRoleKey: "review" },
      { key: "ops", title: "Document operational constraints and rollout checks", summary: "Capture how to run, verify, and troubleshoot the service.", priority: "medium", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "API contract is documented and matches implementation.",
      "Core routes pass integration tests.",
      "Validation and permission failures are covered.",
      "Operational runbook exists for local verification.",
    ],
    workflowPattern: {
      summary: "Contract-first backend delivery with validation and test review before release.",
      ...sharedWorkflow,
      milestones: ["contract locked", "service scaffolded", "core route working", "integration tests green"],
    },
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    description: "Mobile-first application with navigation, responsive states, and offline-aware decisions.",
    defaultPrimaryDeliverable: "Mobile experience for the primary user flow with clear state handling.",
    structureAssumptions: ["app shell", "mobile navigation", "device-aware state handling", "testing plan"],
    suggestedStacks: ["react-native", "expo", "typescript", "supabase"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Mobile Builder", agentKind: "cursor", responsibilities: ["build mobile flow", "own navigation"], ownership: ["mobile shell", "main screens"] },
      { key: "review", name: "QA Reviewer", agentKind: "codex", responsibilities: ["spot state edge cases", "test device behavior"], ownership: ["QA", "stability"] },
    ],
    defaultConventions: [
      { key: "mobile-states", rule: "Design loading, offline, and empty states before secondary polish.", category: "workflow" },
      { key: "mobile-performance", rule: "Prefer simple layouts and avoid avoidable heavy client work on first pass.", category: "architecture" },
    ],
    defaultTaskBlueprints: [
      { key: "flow", title: "Define the primary mobile user flow", summary: "Map the first user journey and key screens.", priority: "high", suggestedRoleKey: "lead" },
      { key: "shell", title: "Implement navigation and screen scaffold", summary: "Create the shell and navigation for the first slice.", priority: "high", suggestedRoleKey: "lead" },
      { key: "states", title: "Handle loading, empty, and error states", summary: "Make the primary flow resilient to state changes.", priority: "high", suggestedRoleKey: "lead" },
      { key: "qa", title: "Review device constraints and regression risks", summary: "Check interaction edge cases before widening scope.", priority: "medium", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "Primary mobile flow works on the target shell.",
      "Loading, empty, and error states are present.",
      "Navigation is stable and understandable.",
      "Device-specific caveats are documented.",
    ],
    workflowPattern: {
      summary: "Mobile-first flow validation before broadening scope.",
      ...sharedWorkflow,
      milestones: ["flow mapped", "navigation working", "states covered", "device review complete"],
    },
  },
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Marketing or product landing page focused on narrative, layout, and conversion flow.",
    defaultPrimaryDeliverable: "High-quality landing page with a clear narrative and conversion path.",
    structureAssumptions: ["hero section", "supporting proof sections", "CTA flow", "responsive styling"],
    suggestedStacks: ["html", "css", "typescript", "react", "tailwind"],
    defaultPriorities: ["speed", "quality"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Landing Builder", agentKind: "cursor", responsibilities: ["build the first pass", "shape layout"], ownership: ["hero", "overall structure"] },
      { key: "review", name: "Landing Reviewer", agentKind: "codex", responsibilities: ["tighten polish", "review responsiveness"], ownership: ["layout review", "follow-up fixes"] },
    ],
    defaultConventions: [
      { key: "landing-focus", rule: "Prioritize a strong narrative and conversion path over decorative extras.", category: "workflow" },
      { key: "landing-scope", rule: "Do not fabricate frontend implementation when the repo only contains metadata.", category: "documentation" },
    ],
    defaultTaskBlueprints: [
      { key: "audit", title: "Audit the repo and confirm landing-page surface", summary: "Identify the real app entrypoints or static files before designing changes.", priority: "high", suggestedRoleKey: "lead" },
      { key: "narrative", title: "Define the landing-page narrative and section plan", summary: "Map hero, proof, feature, and CTA sections before implementation.", priority: "high", suggestedRoleKey: "lead" },
      { key: "implement", title: "Build the first production landing-page pass", summary: "Implement the page with responsive layout and intentional styling.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review copy, responsiveness, and polish", summary: "Validate the page and apply targeted improvements.", priority: "medium", suggestedRoleKey: "review" },
      { key: "ship", title: "Document release copy and final QA notes", summary: "Capture what shipped and any remaining follow-up items.", priority: "low", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "The landing page communicates the product clearly above the fold.",
      "Primary CTA and supporting proof sections are present.",
      "Layout works across desktop and mobile breakpoints.",
      "Any missing source files or blockers are explicitly documented.",
    ],
    workflowPattern: {
      summary: "Narrative-first landing-page build with explicit repo audit before implementation.",
      ...sharedWorkflow,
      milestones: ["repo audit complete", "section plan agreed", "first pass built", "review fixes applied"],
    },
  },
  {
    id: "ai-automation",
    label: "AI Automation",
    description: "Workflow, agent, or automation project with prompts, tools, and validation rules.",
    defaultPrimaryDeliverable: "Working automation flow with explicit inputs, outputs, and validation.",
    structureAssumptions: ["workflow definitions", "tool interfaces", "prompt rules", "validation harness"],
    suggestedStacks: ["typescript", "python", "openai", "supabase", "workers"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Automation Lead", agentKind: "cursor", responsibilities: ["design the flow", "implement orchestration"], ownership: ["automation graph", "tooling"] },
      { key: "review", name: "Evaluation Reviewer", agentKind: "codex", responsibilities: ["design checks", "stress prompts"], ownership: ["evals", "failure analysis"] },
    ],
    defaultConventions: [
      { key: "automation-observability", rule: "Keep automation inputs, outputs, and failure reasons observable.", category: "architecture" },
      { key: "automation-evals", rule: "Add a concrete validation path before expanding scope.", category: "testing" },
    ],
    defaultTaskBlueprints: [
      { key: "spec", title: "Define the automation inputs, outputs, and workflow", summary: "Turn the brief into an explicit automation contract.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tools", title: "Wire the first tool or integration boundary", summary: "Implement the smallest useful integration slice.", priority: "high", suggestedRoleKey: "lead" },
      { key: "flow", title: "Implement the first automation path", summary: "Make the workflow execute from input to output.", priority: "high", suggestedRoleKey: "lead" },
      { key: "evals", title: "Add validation and failure-case coverage", summary: "Protect the automation with checks and review criteria.", priority: "high", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "The automation path runs on real inputs.",
      "Failure cases are observable.",
      "A validation/eval path exists.",
      "Scope and follow-up improvements are documented.",
    ],
    workflowPattern: {
      summary: "Automation contract first, then implementation, then evaluation hardening.",
      ...sharedWorkflow,
      milestones: ["workflow specified", "tooling wired", "automation path working", "evals passing"],
    },
  },
  {
    id: "research-docs",
    label: "Research & Docs",
    description: "Research brief, architectural exploration, or documentation-heavy project.",
    defaultPrimaryDeliverable: "Decision-ready research package or documentation set.",
    structureAssumptions: ["research questions", "sources", "synthesis", "final recommendation"],
    suggestedStacks: ["markdown", "docs", "notion-export", "typescript"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "single-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Research Lead", agentKind: "cursor", responsibilities: ["gather inputs", "write synthesis"], ownership: ["research doc", "recommendation"] },
      { key: "review", name: "Reviewer", agentKind: "codex", responsibilities: ["check gaps", "challenge reasoning"], ownership: ["review notes"] },
    ],
    defaultConventions: [
      { key: "research-sourcing", rule: "Separate source facts from recommendations and inference.", category: "documentation" },
      { key: "research-decision", rule: "End each research pass with a clear recommendation and unresolved questions.", category: "workflow" },
    ],
    defaultTaskBlueprints: [
      { key: "questions", title: "Define the research questions and scope", summary: "Clarify the decisions this work should inform.", priority: "high", suggestedRoleKey: "lead" },
      { key: "gather", title: "Gather primary references and evidence", summary: "Collect the materials needed to answer the scope.", priority: "high", suggestedRoleKey: "lead" },
      { key: "synthesis", title: "Write the synthesis and recommendation", summary: "Turn evidence into a decision-ready summary.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review gaps and unresolved questions", summary: "Challenge the synthesis before finalizing.", priority: "medium", suggestedRoleKey: "review" },
    ],
    definitionOfDone: [
      "Research questions are explicit.",
      "Recommendations are backed by source evidence.",
      "Open questions are listed separately from conclusions.",
      "The output is ready to hand off for a decision.",
    ],
    workflowPattern: {
      summary: "Research scope, evidence gathering, synthesis, and review before final recommendation.",
      ...sharedWorkflow,
      milestones: ["scope written", "evidence gathered", "synthesis drafted", "review complete"],
    },
  },
  {
    id: "empty",
    label: "Empty",
    description: "Minimal setup when the user wants full control with only light starter structure.",
    defaultPrimaryDeliverable: "Lightweight project brief and starter workspace scaffold.",
    structureAssumptions: ["basic bridge metadata", "starter tasks", "starter conventions"],
    suggestedStacks: ["custom"],
    defaultPriorities: ["speed"],
    defaultAgentMode: "single-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Builder", agentKind: "cursor", responsibilities: ["shape the project", "own the first slice"], ownership: ["initial project scope"] },
    ],
    defaultConventions: [
      { key: "empty-scope", rule: "Write down the first slice before broadening scope.", category: "workflow" },
    ],
    defaultTaskBlueprints: [
      { key: "brief", title: "Write the initial project brief", summary: "Capture what this project is and what success looks like.", priority: "high", suggestedRoleKey: "lead" },
      { key: "first-slice", title: "Define and deliver the first meaningful slice", summary: "Pick the smallest useful outcome and ship it.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review what the next slice should be", summary: "Decide what follows the first delivered slice.", priority: "medium", suggestedRoleKey: "lead" },
    ],
    definitionOfDone: [
      "The project brief exists.",
      "The first meaningful slice is defined.",
      "Conventions and next actions are recorded.",
    ],
    workflowPattern: {
      summary: "Minimal setup with only a brief, first slice, and explicit next-step review.",
      ...sharedWorkflow,
      milestones: ["brief written", "first slice defined", "next step documented"],
    },
  },
];

export function listSetupTemplates() {
  return templates.slice();
}

export function getSetupTemplate(templateId: SetupTemplateId) {
  return templates.find((template) => template.id === templateId);
}
