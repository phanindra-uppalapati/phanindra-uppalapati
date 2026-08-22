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

export type SkillCluster = {
  id: string;
  name: string;
  hue: string;
  skills: string[];
  labelSide?: 'top' | 'bottom' | 'left' | 'right';
};

/* Drives the plain-text Skills section grid only (SkillsSection.tsx).
   The hero constellation graph has its own separate, independently
   editable data source — see lib/heroConstellation.ts — so changing
   one never affects the other. */
export const SKILL_GRAPH: SkillCluster[] = [
  { id: 'mainframe', name: 'MAINFRAME', hue: '#C9A227', skills: ['PL/I', 'COBOL', 'JCL', 'REXX'] },
  { id: 'frontend', name: 'FRONTEND', hue: '#C4634F', skills: ['React', 'Next.js', 'JSP'] },
  { id: 'ai', name: 'AI', hue: '#A855F7', skills: ['Agentic Workflows', 'Multimodal Integration', 'Claude Code', 'Copilot'] },
  { id: 'cloud', name: 'CLOUD', hue: '#D0679A', skills: ['AWS', 'ROSA', 'PCF'] },
  { id: 'data', name: 'DATA', hue: '#3E7CB1', skills: ['PostgreSQL', 'Db2', 'Redis'] },
  { id: 'platform', name: 'PLATFORM', hue: '#7C6FE0', skills: ['GitLab CI', 'GitOps', 'Kubernetes'] },
  { id: 'backend', name: 'BACKEND', hue: '#2FA89D', skills: ['Java', 'Spring Boot', 'RabbitMQ'] },
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
    hue: '#C9A227',
    notes: ['Mainframe engineering & enterprise systems'],
  },
  {
    period: 'Mar 2018 – Apr 2022',
    role: 'Team Lead',
    company: 'TCS',
    client: 'Fortune 500 Insurance Client',
    location: 'Chennai, India',
    tech: ['Java', 'Spring Boot', 'React', 'REST', 'SOAP'],
    hue: '#2FA89D',
    notes: ['Java modernization & technical leadership'],
  },
  {
    period: 'Apr 2022 – Present',
    role: 'Senior Software Engineer',
    company: 'TCS',
    client: 'Fortune 500 Insurance Client',
    location: 'Bloomington, Illinois, USA',
    tech: ['Java', 'Spring Boot', 'AWS', 'ROSA', 'OpenShift', 'GitOps', 'AI-assisted Development'],
    hue: 'var(--accent)',
    current: true,
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
  role?: 'branch'; // marks the off-spine failure-loop node ('fix') — laid out
  // below the main line instead of taking a slot in it
};
export type PipelineData = {
  ariaLabel: string;
  legend: { agent: string; developer: string };
  steps: PipelineStep[]; // in order, left to right
};

export const PIPELINES: Record<string, PipelineData> = {
  'spring-boot-migration': {
    ariaLabel:
      'A migration workflow: the agent analyzes, migrates, and validates the repository, then a developer approves the change, and the agent runs automated checks. If checks fail, the agent moves to a Fix step, applies the fix, and the repository loops back through Validate and Approve before Checks runs again. Once checks pass, the agent promotes to production. Approval is the one step that always stays human.',
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
        detail: 'On failure the repo routes to Fix, not back to square one \u2014 see the loop below.',
      },
      {
        id: 'fix',
        label: 'Fix',
        icon: '\ud83d\udd27',
        lane: 'agent',
        role: 'branch',
        caption: 'Recognized failures get an automatic fix; anything ambiguous escalates to a developer — then back to Validate.',
        detail:
          'A recognized failure pattern is fixed by the agent automatically; anything ambiguous is escalated to the developer to investigate. Either way, the repo re-enters the loop at Validate.',
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
  // kind: 'project' with `flow` only — opts into the stacked layout (text
  // block on top, full-width diagram below, like the pipeline cards)
  // instead of the default side-by-side has-media row. Scoped per-item so
  // future flow-diagram projects keep the standard layout unless they ask
  // for this one too.
  stackedMedia?: boolean;
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
    stackedMedia: true,
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
    title: 'Spring Boot 4 Migration, Agent-Driven',
    subtitle: 'AI-assisted migration with a human approval gate',
    summary: 'An OpenAI Codex agent ran the migration end to end — analyzing, rewriting, and validating each repo before handing off for review.',
    description:
      'The workflow started as one manual migration — the patterns it surfaced became a reusable skill that handled dependency bumps, config changes, and API rewrites across the other fourteen repos. Only the decisions that mattered — what to merge, what shipped to production — stayed with a person. When an automated check failed, the agent diagnosed the issue, applied a fix, and re-queued the repo without waiting on someone to unblock it.',
    tags: ['Spring Boot 4', 'OpenAI Codex', 'CI/CD', 'AI-assisted Development'],
    stats: [
      { value: '15', label: 'Repositories', icon: 'repo' },
      { value: '~45 → 7', label: 'Engineering Days', icon: 'clock' },
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
    "Every major transition in my career — Mainframes to Java, then to cloud — meant learning unfamiliar technology, adapting to new constraints, and earning trust all over again. But the technologies were never the real story. What's remained constant is learning, adapting, and leaving every system better than I found it.",
    "Good engineering begins before the first line of code — with understanding the problem, asking better questions, and resisting the urge to fix what isn't yet understood. If a system can't be explained clearly, it probably isn't understood well enough; the best solutions rarely appear until the problem does.",
    "The most valuable engineers aren't remembered for how many systems they built or technologies they mastered. They're remembered for being trusted with hard problems, for what others learned working alongside them, and for leaving software easier to understand than they found it. That's the standard I hold myself to.",
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
