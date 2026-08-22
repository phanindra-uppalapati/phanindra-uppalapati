/* ==========================================================
   HERO CONSTELLATION DATA — dedicated to the SkillConstellation
   component only. Deliberately NOT shared with SkillsSection.tsx
   (which reads SKILL_GRAPH from lib/content.ts instead).

   Edit this file freely to change what the hero graph shows —
   it will never affect the plain-text Skills section on the page,
   and vice versa.

   HOW TO CUSTOMIZE:
   - Add/remove/reorder clusters in CONSTELLATION_DATA freely — the
     layout positions clusters procedurally, so there are no
     coordinates to hand-place.
   - Each cluster's `skills` array can be any length (2–8 is the
     practical sweet spot before a cluster gets visually crowded;
     the layout math scales spacing with count, it won't hard-clip
     at any specific number).
   - `id` is only used internally to reference clusters in
     CONSTELLATION_CONNECTIONS below — it never renders.
   - CONSTELLATION_CONNECTIONS pairs are optional flavor (cluster-to-
     cluster relationship lines); every cluster already gets an
     automatic hub spoke regardless of what's listed here.
   - CONSTELLATION_ABBREVIATIONS and CONSTELLATION_INFO are both
     optional per-skill — anything omitted just falls back to the
     full label / no tooltip subtext.
   ========================================================== */

export type ConstellationCluster = {
  id: string;
  name: string;
  hue: string;
  skills: string[];
  labelSide?: 'top' | 'bottom' | 'left' | 'right';
};

export const CONSTELLATION_DATA: ConstellationCluster[] = [
  { id: 'mainframe', name: 'MAINFRAME', hue: '#C9A227', skills: ['PL/I', 'COBOL', 'JCL', 'REXX'] },
  { id: 'frontend', name: 'FRONTEND', hue: '#C4634F', skills: ['React', 'Next.js', 'JSP'] },
  { id: 'ai', name: 'AI', hue: '#A855F7', skills: ['Agentic Workflows', 'Multimodal Integration', 'Claude Code', 'Copilot'] },
  { id: 'cloud', name: 'CLOUD', hue: '#D0679A', skills: ['AWS', 'ROSA', 'PCF'] },
  { id: 'data', name: 'DATA', hue: '#3E7CB1', skills: ['PostgreSQL', 'Db2', 'Redis'] },
  { id: 'platform', name: 'PLATFORM', hue: '#7C6FE0', skills: ['GitLab CI', 'GitOps', 'Kubernetes'] },
  { id: 'backend', name: 'BACKEND', hue: '#2FA89D', skills: ['Java', 'Spring Boot', 'RabbitMQ'] },
];

/* Short forms for node labels on narrow screens. Anything not listed
   here falls back to lib/utils.ts's automatic shortener, so adding a
   new skill never breaks mobile layout — add an entry only if the
   auto-shortened version looks off. */
export const CONSTELLATION_ABBREVIATIONS: Record<string, string> = {
  'Agentic Workflows': 'Agentic',
  'Multimodal Integration': 'Multimodal',
  'Claude Code': 'Claude',
  'PostgreSQL': 'Postgres',
  'GitLab CI': 'GitLab',
  'Kubernetes': 'K8s',
  'Spring Boot': 'Spring',
  'RabbitMQ': 'Rabbit',
  'Next.js': 'Next',
};

/* Cluster-to-cluster edges layered on top of the automatic hub spokes.
   `weight`: 'primary' draws solid/stronger, 'secondary' draws
   dashed/subtle. Entries just need to reference two ids from
   CONSTELLATION_DATA above. */
export const CONSTELLATION_CONNECTIONS: { a: string; b: string; weight: 'primary' | 'secondary' }[] = [
  { a: 'backend', b: 'data', weight: 'primary' },
  { a: 'backend', b: 'mainframe', weight: 'primary' },
  { a: 'backend', b: 'frontend', weight: 'primary' },
  { a: 'backend', b: 'cloud', weight: 'primary' },
  { a: 'cloud', b: 'platform', weight: 'primary' },
  { a: 'data', b: 'ai', weight: 'primary' },
  { a: 'platform', b: 'ai', weight: 'primary' },
  { a: 'mainframe', b: 'cloud', weight: 'secondary' },
  { a: 'frontend', b: 'ai', weight: 'secondary' },
  { a: 'data', b: 'cloud', weight: 'secondary' },
  { a: 'mainframe', b: 'data', weight: 'secondary' },
  { a: 'platform', b: 'backend', weight: 'secondary' },
  { a: 'backend', b: 'ai', weight: 'secondary' },
];

/* Optional tooltip subtext shown under a node's name on hover/tap. A
   skill with no entry here just shows its name alone — adding a new
   skill never breaks anything. */
export const CONSTELLATION_INFO: Record<string, string> = {
  'PL/I': 'Core language for batch processing systems, 2013–2018.',
  COBOL: 'Maintained and extended legacy programs for Fortune 500 insurance workflows.',
  JCL: 'Job control scripts orchestrating daily mainframe batch cycles.',
  REXX: 'Automated mainframe operations and testing routines.',
  React: 'UI layer for the InsureSign AI proof-of-concept.',
  'Next.js': 'Framework behind this portfolio and recent proof-of-concept work.',
  JSP: 'Early-career UI work on Java-based enterprise web apps.',
  'Agentic Workflows': 'Directed an AI coding agent through a real 15-repo Spring Boot migration.',
  'Multimodal Integration': 'Wired Gemini Vision into a document-decisioning pipeline for InsureSign AI.',
  'Claude Code': 'Agent-assisted engineering across recent projects — including this site.',
  Copilot: 'Daily pair-programming tool for faster, more confident shipping.',
  AWS: 'Current production workloads run here for the Bloomington team.',
  ROSA: 'Red Hat OpenShift on AWS — the managed Kubernetes platform behind current services.',
  PCF: 'Deployed and operated services on Pivotal/Tanzu Cloud Foundry earlier in this role.',
  PostgreSQL: 'Primary relational store for current microservices.',
  Db2: "Worked with it on the mainframe-era systems this career began on.",
  Redis: 'Caching and session state for backend services.',
  'GitLab CI': 'Pipelines gating every deploy — including the AI-assisted migration.',
  GitOps: 'Git-driven deployment workflow for the current OpenShift/ROSA environment.',
  Kubernetes: 'Orchestration layer underneath current cloud-native services.',
  Java: '13+ years, from mainframe-adjacent systems to today\u2019s microservices.',
  'Spring Boot': 'Primary framework since 2019 — including leading its v3\u2192v4 migration.',
  RabbitMQ: 'Message broker for async workflows between backend services.',
};
