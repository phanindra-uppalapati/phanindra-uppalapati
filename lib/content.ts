/* ==========================================================
   SITE CONTENT — the single source of truth.
   Edit values here; nothing else in the app hardcodes copy.
   ========================================================== */

export type ProfileCta = { label: string; href: string };

export type Profile = {
  initials: string;
  name: string;
  title: string;
  tagline: string;
  bio: string;
  avatar: string;
  resume: string;
  links: {
    linkedin: string;
    github: string;
    email: string;
  };
  ctas: {
    primary: ProfileCta;
    secondary: ProfileCta;
  };
};

export const PROFILE: Profile = {
  initials: 'PU',
  name: 'Phanindra Uppalapati',
  title: 'Senior Software Engineer',
  tagline:
    'I modernize complex systems into resilient, cloud-native platforms — without losing what made them work.',
  bio: "With 13+ years of experience spanning mainframe systems, cloud-native microservices, and AI-enabled applications, I care most about leaving every system clearer than I found it.",
  avatar: '/profile.jpg',
  resume: '/resume.pdf',
  links: {
    linkedin: 'https://www.linkedin.com/in/phanindrauppalapati/',
    github: 'https://github.com/phanindra-uppalapati',
    email: 'mailto:phanindra.uppalapati@gmail.com',
  },
  ctas: {
    primary: { label: 'Explore My Work', href: '#projects' },
    secondary: { label: 'My Journey', href: '#journey' },
  },
};

/* `labelSide` is an optional manual override for where a cluster's name
   renders relative to its halo ('top'|'bottom'|'left'|'right'). Leave it
   unset and the graph picks whichever side has the least label/halo
   collision automatically — set it only if you want to force a specific
   side for a specific cluster (e.g. it keeps landing somewhere you don't
   like on your own content). Same idea per-skill via `SKILL_ABBREVIATIONS`
   below for the short mobile label. */
export type SkillCluster = {
  id: string;
  name: string;
  hue: string;
  skills: string[];
  labelSide?: 'top' | 'bottom' | 'left' | 'right';
};

/* Each cluster: id (used to reference it in SKILL_CONNECTIONS below), name,
   hue, and its skills list. Position is NOT stored here — the graph
   scatters clusters organically (a seeded, deterministic layout — stable
   across reloads, not random each time) and pushes them apart until
   nothing overlaps and everything stays inside the panel, so adding,
   removing, or reordering a cluster just works with no coordinates to
   hand-place. This same array also drives the plain-text Skills section,
   so the two never drift out of sync. */
export const SKILL_GRAPH: SkillCluster[] = [
  { id: 'mainframe', name: 'MAINFRAME', hue: '#C9A227', skills: ['PL/I', 'COBOL', 'JCL', 'REXX'] },
  { id: 'frontend', name: 'FRONTEND', hue: '#C4634F', skills: ['React', 'Next.js', 'JSP'] },
  { id: 'ai', name: 'AI', hue: '#A855F7', skills: ['Agentic Workflows', 'Multimodal Integration', 'Claude Code', 'Copilot'] },
  { id: 'cloud', name: 'CLOUD', hue: '#D0679A', skills: ['AWS', 'ROSA', 'PCF'] },
  { id: 'data', name: 'DATA', hue: '#3E7CB1', skills: ['PostgreSQL', 'Db2', 'Redis'] },
  { id: 'platform', name: 'PLATFORM', hue: '#7C6FE0', skills: ['GitLab CI', 'GitOps', 'Kubernetes'] },
  { id: 'backend', name: 'BACKEND', hue: '#2FA89D', skills: ['Java', 'Spring Boot', 'RabbitMQ'] },
];

/* Short forms shown for node labels on narrow screens (abbreviation, not
   truncation with an ellipsis — reads cleaner at small sizes). Anything
   not listed here falls back to an automatic shortener (lib/utils.ts:
   abbreviateSkill) so a newly added skill never breaks mobile layout —
   add an entry here only if the auto-shortened version looks off. */
export const SKILL_ABBREVIATIONS: Record<string, string> = {
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

/* Cluster-to-cluster edges — each pair reflects a real relationship in how
   these domains actually connect in your work, not an exhaustive mesh.
   `weight` controls line treatment: 'primary' draws solid/stronger,
   'secondary' draws dashed/subtle (see SkillGraphCanvas). These sit
   alongside the avatar→domain spokes, which every domain gets
   automatically and aren't listed here. Edit freely: entries just need
   to reference two ids from SKILL_GRAPH above.

   Note: a couple of pairs you dictated conflicted between the two lists
   (e.g. 'Data–AI' and 'Backend–Frontend' each showed up under both
   primary and secondary) — resolved to primary, since that was each
   pair's first/stronger listing. 'Backend–AI' was in your original
   11-pair list but dropped from the later primary/secondary pass, so
   it's kept here as secondary rather than silently dropped. */
export const SKILL_CONNECTIONS: { a: string; b: string; weight: 'primary' | 'secondary' }[] = [
  // primary — strong, visible relationships
  { a: 'backend', b: 'data', weight: 'primary' },
  { a: 'backend', b: 'mainframe', weight: 'primary' },
  { a: 'backend', b: 'frontend', weight: 'primary' },
  { a: 'backend', b: 'cloud', weight: 'primary' },
  { a: 'cloud', b: 'platform', weight: 'primary' },
  { a: 'data', b: 'ai', weight: 'primary' },
  { a: 'platform', b: 'ai', weight: 'primary' },
  // secondary — real but less visually dominant
  { a: 'mainframe', b: 'cloud', weight: 'secondary' },
  { a: 'frontend', b: 'ai', weight: 'secondary' },
  { a: 'data', b: 'cloud', weight: 'secondary' },
  { a: 'mainframe', b: 'data', weight: 'secondary' },
  { a: 'platform', b: 'backend', weight: 'secondary' },
  { a: 'backend', b: 'ai', weight: 'secondary' },
];

export type JourneyEntry = {
  period: string;
  role: string;
  company: string;
  client: string;
  location: string;
  tech: string[];
  hue: string;
  current?: boolean;
  notes: string[];
};

/* client is intentionally generic — real end-client names are usually
   withheld on a public page. */
export const JOURNEY: JourneyEntry[] = [
  {
    period: 'Jun 2013 – Mar 2018',
    role: 'Software Developer — Mainframe',
    company: 'TCS',
    client: 'Fortune 500 Insurance Client',
    location: 'Chennai, India',
    tech: ['COBOL', 'PL/I', 'JCL', 'IMS', 'DB2'],
    hue: '#5B7180',
    notes: ['Mainframe engineering & enterprise systems'],
  },

  {
    period: 'Mar 2018 – Apr 2022',
    role: 'Team Lead',
    company: 'TCS',
    client: 'Fortune 500 Insurance Client',
    location: 'Bloomington, IL / Chennai, India',
    tech: ['Java', 'Spring Boot', 'React', 'REST', 'SOAP'],
    hue: '#3B82A0',
    notes: ['Java modernization & technical leadership'],
  },

  {
    period: 'Apr 2022 – Present',
    role: 'Senior Software Engineer',
    company: 'TCS',
    client: 'Fortune 500 Insurance Client',
    location: 'Bloomington, IL, USA',
    tech: ['Java', 'Spring Boot', 'AWS ROSA', 'GitLab CI/CD', 'Codex'],
    hue: '#2FA89D',
    notes: ['Cloud modernization & agentic engineering'],
  },
];

export type FlowSpineNode = { id: string; label: string; icon: string };
export type FlowOutcome = { id: string; label: string; icon: string; hue: string; loopsTo?: string };
export type FlowDemoState = { outcome: string; label: string };
export type Flow = {
  ariaLabel: string;
  spine: FlowSpineNode[];
  outcomes: FlowOutcome[];
  demoStates: FlowDemoState[];
  strapline?: string;
  disclaimer?: string;
};

/* Data for the generic flow-diagram renderer (components/FlowDiagram.tsx).
   Add a new key here to give another project its own animated diagram —
   the renderer lays it out automatically from this data. */
export const FLOWS: Record<string, Flow> = {
  'signature-decisioning': {
    ariaLabel:
      'An applicant uploads a document, Gemini Vision assesses it for a signature, and a deterministic decision engine routes the result to Verified, Correction Required, or Human Review by confidence. Correction Required loops back to upload.',
    spine: [
      { id: 'upload', label: 'Upload', icon: '📄' },
      { id: 'vision', label: 'Gemini Vision', icon: '✨' },
      { id: 'engine', label: 'Decision Engine', icon: '🔀' },
    ],
    outcomes: [
      { id: 'verified', label: 'Verified', icon: '✅', hue: '#2FA89D' },
      { id: 'correction', label: 'Correction Required', icon: '↩️', hue: '#C9A227', loopsTo: 'upload' },
      { id: 'review', label: 'Human Review', icon: '🧑‍💼', hue: '#7C6FE0' },
    ],
    demoStates: [
      { outcome: 'verified', label: '96% confidence · signature found → VERIFIED' },
      { outcome: 'correction', label: '93% confidence · signature missing → CORRECTION REQUIRED' },
      { outcome: 'review', label: '71% confidence · uncertain → HUMAN REVIEW' },
    ],
    strapline: 'Automate the obvious. Escalate the uncertain.',
    disclaimer: 'Gemini only assesses the document — a deterministic engine decides the outcome.',
  },
};

/* ----------------------------------------------------------------
   PIPELINE — the migration workflow as a story, not a flowchart
   (components/MigrationPipeline.tsx). Two lanes make who's driving
   explicit at a glance: the agent lane carries the automated work
   (analyze, migrate, validate, checks, promote); the flow dips into
   the developer lane exactly once, for the one step that always
   stays human — approval. Visually modeled on FlowDiagram (small
   circle nodes, smooth curved edges, a single narrated caption)
   rather than literal flowchart shapes, so it reads as a story at
   a glance. The retry/triage logic behind "Checks" is real but
   secondary, so it lives behind a click instead of cluttering the
   main path.
   ---------------------------------------------------------------- */
export type MigrationLane = 'agent' | 'developer';
export type PipelineStep = {
  id: string;
  label: string;
  icon: string;
  lane: MigrationLane;
  caption: string; // narrates this moment while the step is active
  detail?: string; // optional — click-to-reveal extra explanation
};
export type PipelineData = {
  ariaLabel: string;
  legend: { agent: string; developer: string };
  steps: PipelineStep[]; // in order, left to right
};

export const PIPELINES: Record<string, PipelineData> = {
  'spring-boot-migration': {
    ariaLabel:
      'A migration workflow: the agent analyzes, migrates, and validates the repository, a developer approves the change, and the agent runs automated checks and promotes to production. Approval is the one step that always stays human; if a check fails, the agent fixes recognized issues itself or escalates unclear ones to the developer before retrying.',
    legend: { agent: 'Agent', developer: 'Developer' },
    steps: [
      {
        id: 'analyze',
        label: 'Analyze',
        icon: '\ud83d\udd0d',
        lane: 'agent',
        caption: 'Agent scans the repo for Spring Boot 3 \u2192 4 breaking changes.',
      },
      {
        id: 'migrate',
        label: 'Migrate',
        icon: '\ud83d\udee0\ufe0f',
        lane: 'agent',
        caption: 'Agent rewrites dependencies, configs, and API calls.',
      },
      {
        id: 'validate',
        label: 'Validate',
        icon: '\u2705',
        lane: 'agent',
        caption: 'Agent compiles the project and runs the full test suite.',
      },
      {
        id: 'approve',
        label: 'Approve',
        icon: '\ud83e\uddd1\u200d\ud83d\udcbb',
        lane: 'developer',
        caption: 'Developer reviews the diff \u2014 nothing merges without a human yes.',
      },
      {
        id: 'checks',
        label: 'Checks',
        icon: '\u2699\ufe0f',
        lane: 'agent',
        caption: 'CI/CD and a smoke test confirm the build is production-ready.',
        detail:
          'A failed check is triaged first: a recognized pattern is fixed by the agent automatically; anything ambiguous is escalated to the developer to investigate. Either way, the fix loops back to Validate before trying again.',
      },
      {
        id: 'promote',
        label: 'Promote',
        icon: '\ud83d\ude80',
        lane: 'agent',
        caption: 'Agent promotes the validated build to production.',
      },
      {
        id: 'live',
        label: 'Live',
        icon: '\ud83c\udfc1',
        lane: 'agent',
        caption: 'Deployed \u2014 the agent moves on to the next repository.',
      },
    ],
  },
};

export type ProjectStat = { value: string; label: string; icon?: 'repo' | 'clock' | 'sparkle' };

export type WorkKind = 'project' | 'article';

/* One shared item shape for everything in the Projects section — the card
   body swaps by `kind`, so a project and an article sit comfortably in the
   same grid/row without separate components to keep in sync.

   `summary` is always shown; `description`, if present, is the fuller
   version revealed behind "Read more" (omit it if summary already says
   everything). `live` is reserved for a future live-evidence panel (e.g.
   streamed build/run logs) — the card already knows how to render its
   placeholder state; wiring an actual source (`live.sourceUrl`) is a
   separate follow-up, not implemented yet. */
export type WorkItem = {
  kind: WorkKind;
  title: string;
  subtitle?: string;
  summary: string;
  description?: string;
  tags: string[];
  badge?: string;
  stats?: ProjectStat[];
  flow?: string;
  pipeline?: string;
  image?: string;
  repoUrl?: string;
  demoUrl?: string;
  // kind: 'article' only
  articleUrl?: string;
  readTime?: string;
  publishedDate?: string;
  // kind: 'project' only — optional, reserved for future live-evidence streaming
  live?: { note?: string; sourceUrl?: string };
};

export const WORK_ITEMS: WorkItem[] = [
  {
    kind: 'project',
    title: 'InsureSign AI',
    subtitle: 'Confidence-based signature verification & intelligent workflow routing',
    summary:
      'AI assesses each document for a signature — a deterministic decision engine, not the model itself, decides what happens next.',
    description:
      'A time-boxed proof-of-concept for life-insurance document intake: an applicant uploads an authorization form, Gemini Vision assesses it for a signature, and a deterministic decision engine — not the model itself — decides the outcome. High-confidence results resolve automatically; anything uncertain is routed to a human reviewer instead of being guessed at.',
    tags: ['Next.js 16', 'Gemini Vision', 'Deterministic Decision Engine', 'Human-in-the-loop'],
    flow: 'signature-decisioning',
    repoUrl: 'https://github.com/phanindra-uppalapati/AI-Document-Decisioning',
    demoUrl: 'https://ai-document-decisioning.vercel.app/',
  },
  {
    kind: 'project',
    title: 'Spring Boot 4 Migration: 15 Repositories in 7 Days',
    subtitle: 'AI-assisted migration with a human approval gate',
    summary: 'An AI coding agent handled the mechanical migration work across 15 repos — every merge still gated by a human reviewer.',
    description:
      'An OpenAI Codex-based skill handled the mechanical work of migrating fifteen Spring Boot repositories from version 3 to 4 — dependency bumps, config changes, API rewrites — while every consequential decision, from what to merge to what shipped to production, stayed with a human reviewer.',
    tags: ['Spring Boot 4', 'OpenAI Codex', 'CI/CD', 'AI-assisted Development'],
    stats: [
      { value: '15', label: 'Repositories', icon: 'repo' },
      { value: '7', label: 'Days', icon: 'clock' },
      { value: 'AI-assisted', label: 'Migration', icon: 'sparkle' },
    ],
    pipeline: 'spring-boot-migration',
  },
];


export type Note = {
  quote: string;
  heading: string;
  paragraphs: string[];
  signature: string;
  motto: string;
};

export const NOTE: Note = {
  quote: '"We don\'t always choose the systems we inherit. We do choose what we leave behind."',
  heading: 'A Note Before We Work Together',
  paragraphs: [
    "Every major transition in my career felt like a new beginning. From Mainframes to Java, and later to cloud platforms, each chapter meant learning unfamiliar technologies, adapting to new constraints, and earning trust all over again. Looking back, the technologies were never the real story. Learning, adapting, and leaving every system better than I found it have remained constant.",
    "Good engineering begins long before the first line of code. It begins with understanding the problem, asking better questions, and resisting the temptation to fix what hasn't been fully understood. I've learned that if a system can't be explained clearly, it probably isn't understood well enough — and the best solutions rarely appear until the problem itself becomes clear.",
    "I've come to believe that the most valuable engineers aren't remembered for the number of systems they built or the technologies they mastered. They're remembered because people trusted them with difficult problems, learned from working alongside them, and inherited software that was easier to understand than when they found it. That's the standard I try to live up to every day.",
  ],
  signature: 'Phanindra',
  motto: 'Understanding first. Everything else follows.',
};

/* Award data lives in lib/awards-data.ts (a dedicated file, since the full
   public list is long) — see AWARDS_DATA there. */

export type SectionConfig = {
  id: string;
  label: string;
  kind: 'hero' | 'journey' | 'awards' | 'skills' | 'projects' | 'note';
  topNav: boolean;
  eyebrow?: string;
  title?: string;
};

/* Add one object here to add a page section — nav links (top bar +
   floating rail) are generated automatically from this list. */
export const SECTIONS: SectionConfig[] = [
  { id: 'hero', label: 'Hero', kind: 'hero', topNav: false },
  { id: 'journey', label: 'Journey', kind: 'journey', topNav: true, eyebrow: 'THE PATH', title: 'Engineering Journey' },
  { id: 'awards', label: 'Awards', kind: 'awards', topNav: true, eyebrow: 'RECOGNITION', title: 'Awards' },
  { id: 'skills', label: 'Skills', kind: 'skills', topNav: true, eyebrow: 'TECHNICAL TOOLKIT', title: 'Skills' },
  { id: 'projects', label: 'Projects', kind: 'projects', topNav: true, eyebrow: 'SELECTED WORK', title: 'Projects' },
  { id: 'note', label: 'Note', kind: 'note', topNav: true, eyebrow: 'BEFORE WE BEGIN', title: 'A Note' },
];
