# 🌌 Aletheia (`α`)
### Personalized Epistemic News & Conversational Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![AWS ECS Fargate](https://img.shields.io/badge/AWS-ECS_Fargate-FF9900?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/ecs/)
[![Terraform](https://img.shields.io/badge/Terraform-1.9.0-844FBA?style=flat-square&logo=terraform)](https://www.terraform.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-6772E5?style=flat-square&logo=stripe)](https://stripe.com/)
[![Tests](https://img.shields.io/badge/Tests-181%20Passed%20(29%20Suites)-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)

**Aletheia** is an autonomous, multi-agent epistemic news aggregator and conversational AI companion built on the **Mind-State Memory Architecture**. It delivers high-signal, bias-stripped, and clickbait-free technical journalism tailored dynamically to your evolving intellectual curiosities, presentation preferences, and engineering depth.

Aletheia is released under the **[ciclops.io](https://ciclops.io)** ecosystem at **[news.ciclops.io](https://news.ciclops.io)** with cross-subdomain Google OAuth Single Sign-On (SSO).

---

## 🏛️ Mind-State Memory Architecture

Aletheia replaces static news feeds and sycophantic chatbot interactions with a coordinated, dual-loop multi-agent architecture grounded in persistent entity GUIDs (`topic_id`) and finished-only card rendering:

```mermaid
flowchart TD
    subgraph ClientUI ["Frontend & User Experience (Next.js 14)"]
        User(["User Prompt / Article Discussion"])
        FeedUI["Personalized Epistemic Feed & Dynamic Topic Briefs\n(Finished-Only Reveal Policy: Zero Flashes)"]
        CompanionUI["Companion Chat & Source Reader Modal"]
        ObservabilityUI["Agentic Observability Studio (/observability)\n(Live Traces, Rationale, Token Metering & Disk Warmup)"]
        DevToolsUI["Real-Time DevTools (6-Stage Agentic Flow)"]
        PersonaHubs["Persona Topic Hubs\n(/tech, /business, /policy, /scholar, /wellness)"]
    end

    subgraph MindStateMemory ["Mind-State Memory & Single Source of Truth"]
        UnifiedNode[("UnifiedTopicNode (PostgreSQL RDS + pgvector)
        - Persistent topic_id GUID Entity Grounding
        - 3 Pillars: What / Why / Presentation Strategy
        - Living Narrative & Append-Only Evolution Timeline
        - Recent Topic Diffs & Harmonization Runs")]
    end

    subgraph ConversationalPipeline ["Inverted Conversational Epistemic Pipeline"]
        direction TB
        Resolver["1. Semantic Topic Resolver
        (Deterministic topic_id Resolution & Graph Traversal)"]
        FeedFilter["Active Feed Filter
        (Real-Time Semantic Affinity & Card Highlighting)"]
        ContextEmpath["2. Context Agent (The Empath)
        (Depth Calibration & Candidate Story Grounding)"]
        EpistemicCheck{"3. Epistemic Sufficiency &
        Temporal Grounding Check"}
        LiveSearch["Live Wire Search Tool
        (FreeNewsFetcher Zero-Key Multi-Source Search)"]
        LLMDialogue["4. Aletheia Dialogue Engine (DeepSeek)
        Prefix-Rationale: Internal Deliberation FIRST
        Synthesized Conversational Stream LAST"]
    end

    subgraph ActiveListening ["Autonomous Background Adaptation"]
        direction TB
        Observer["Observer Agent (Active Listener)
        Silent Multi-Turn Cognitive Evaluation"]
        MutationEngine["Topic Mutation Engine
        (create_topic / update_topic Atomic Tools)"]
        Harmonizer["Interest Harmonizer
        (Knowledge Graph Saturation Reconciliation >= 25)"]
        TelemetryEngine["Passive Telemetry Engine
        (Decoupled Dwell Time / Scroll Depth / Decay)"]
    end

    subgraph AutonomousFeedPipeline ["Autonomous News Curation & Generative Brief Evolution"]
        direction TB
        RSS["Global Multi-Source Wires & RSS\n(Reuters, BBC, Ars Technica, Hacker News, Reddit, Bluesky)"]
        Discovery["Discovery Agent (The Curator)\nMulti-Tiered Queries & Strict Anti-Preference Filter"]
        EpistemicEval{"Epistemic Evaluator\n(Candidate Coverage Sufficiency & Ideological Divergence)"}
        DeepResearch["Autonomous Deep Research Loop\n(Gap Querying & Follow-up Wire Enrichment)"]
        Epistemology["Node A: Epistemology Agent\n(Bias Stripper & PureFactObject with topic_id)"]
        CardEvolution["Topic Card Evolution Orchestrator (5 Phases)\n(LiveDiscovery -> EvolutionDecision -> LayoutArchitect -> TargetedResearch -> CardSynthesis)"]
        Archetypes["7 Dynamic Presentation Archetypes\n(field_synthesis, deep_dive, comparative, breaking_pulse, controversy, tech_arch, timeline)"]
        Matcher["Topic Brief Builder & Synthesizer\n(O(1) topic_id Bucketing, Velocity Status & Narrative Citations)"]
    end

    %% Flow connections
    User --> Resolver
    UnifiedNode -.-> Resolver
    Resolver --> FeedFilter
    FeedFilter --> ContextEmpath
    ContextEmpath --> EpistemicCheck
    EpistemicCheck -- "Local Context Lacks Fresh Facts" --> LiveSearch
    LiveSearch --> LLMDialogue
    EpistemicCheck -- "Sufficient Verified Facts" --> LLMDialogue
    LLMDialogue --> CompanionUI
    LLMDialogue -.-> DevToolsUI
    LLMDialogue -.-> ObservabilityUI

    CompanionUI -. "Completed Turn" .-> Observer
    FeedUI -. "User Dwell / Scroll Telemetry" .-> TelemetryEngine
    TelemetryEngine --> Observer
    Observer --> MutationEngine
    MutationEngine --> UnifiedNode
    Observer -. "Graph Saturation (>= 25)" .-> Harmonizer
    Harmonizer --> UnifiedNode

    RSS --> Discovery
    Discovery --> EpistemicEval
    EpistemicEval -- "Information Gaps Detected" --> DeepResearch
    DeepResearch --> RSS
    EpistemicEval -- "Coverage Sufficient" --> Epistemology
    UnifiedNode -.-> Discovery
    Epistemology --> CardEvolution
    CardEvolution --> Archetypes
    Archetypes --> Matcher
    Matcher --> FeedUI
    PersonaHubs -.-> UnifiedNode
```

---

### Core Agents & Components

1. **Dialogue Agent (`src/core/agents/intake/dialogue-agent.ts`)**:
   - **Inverted Execution Order**: Evaluates topic resolution and filters feed stories *first*, grounds context in candidate articles *second*, evaluates epistemic sufficiency *third*, and streams the token response *last*.
   - **Prefix-Rationale Decision Ordering**: Mandates internal cognitive deliberation (`agent_internal_rationale`) prior to generating conversational tokens, guaranteeing reasoned, peer-level responses.
   - **Real-Time Temporal & Spatial Grounding**: Injects exact local calendar date, client timezone, user region, and article age calculations to eliminate chronological hallucinations.
   - **Real-Time Streaming Extractor**: High-speed JSON stream parsing via `JsonMessageStreamExtractor`.

2. **Context Agent (`src/core/agents/context/context-agent.ts`) - The Empath**:
   - Analyzes conversation threads using `SemanticTopicResolver` to calibrate technical depth (`introductory`, `practitioner`, `expert`, `deep_technical`).
   - Dynamically scores candidate feed stories against active topic motivations, enforces psychological boundaries, and injects empath guidance.

3. **Observer Agent (`src/core/agents/observer/observer-agent.ts`) - The Active Listener**:
   - Silently evaluates user statements across conversation turns to build and evolve **Living Topic Dossiers**.
   - Emits discrete tool calls through the `TopicMutationEngine` without relying on keyword regexes or brittle heuristics.
   - Preserves historical context through non-overwriting cumulative synthesis and append-only evolution timelines.

4. **Topic Mutation Engine (`src/core/agents/observer/topic-mutation-engine.ts`)**:
   - Executes atomic mutation tools (`create_topic`, `update_topic`) driven purely by LLM reasoning.
   - Validates verbatim user evidence, updates weights, and logs state transitions in `recent_topic_diffs`.

5. **Interest Harmonizer (`src/core/agents/observer/interest-harmonizer.ts`)**:
   - Automatically clusters, merges, and cleans redundant topic dossiers when knowledge graphs approach saturation ($\ge 25$ topics).
   - Generates audited action records stored in `harmonization_runs` on the `UnifiedTopicNode`.

6. **Epistemology Agent (`src/core/agents/epistemology/bias-stripper.ts`) - Bias Stripper**:
   - Ingests raw news reporting, strips hyperbolic adjectives and emotive rhetoric, and outputs verifiable `PureFactObject` entities with agreed facts and disputed claims bound to an immutable `topic_id`.

7. **Discovery Agent (`src/core/agents/discovery/discovery-agent.ts`) - The Curator**:
   - Synthesizes multi-tiered queries spanning revealed preferences, cross-domain intersections, and curiosity frontiers.
   - Rejects clickbait, low-density articles, and user anti-preferences before ingestion using `TopicRelevanceFilter`.

8. **Epistemic Evaluator & Autonomous Deep Research (`src/core/agents/discovery/epistemic-evaluator.ts`)**:
   - Evaluates whether candidate news collections possess sufficient empirical depth, cross-source confirmation, and balanced perspectives.
   - Identifies epistemic gaps and autonomously triggers follow-up wire research loops to enrich sparse coverage before synthesis.

9. **Topic Card Evolution Orchestrator (`src/core/agents/cards/topic-card-evolution-orchestrator.ts`)**:
   - Coordinates the 5-phase briefing lifecycle: **Live Discovery**, **Evolution Decision**, **Layout Architect**, **Targeted Research**, and **Card Synthesis**.
   - Dynamically selects from **7 presentation archetypes** (`field_synthesis`, `deep_dive_narrative`, `comparative_dossier`, `breaking_pulse`, `regulatory_controversy`, `technical_architecture`, `timeline_evolution`).
   - Emits dynamic section payloads rendered seamlessly by `DynamicBriefSectionRenderer`.

10. **Semantic Matcher & Topic Brief Builder (`src/core/matching/`)**:
    - Calculates multi-dimensional concept sphere alignment between stories and user knowledge graphs.
    - Deterministically buckets articles and cards by persistent `topic_id` in $O(1)$ time, eliminating duplicate cards and key collisions.
    - Assigns velocity status indicators (*breaking, active, recent, steady, dormant*) and generates sentence-level narrative summaries with clickable citations.

11. **Agentic Observability Studio & Trace Logger (`src/core/observability/trace-logger.ts` & `/observability`)**:
    - Dedicated execution tracing studio capturing full agent hierarchy, system prompts, user prompts, cognitive rationale, token metering, and latency.
    - Persistent warm-up from `traces/trace_latest.jsonl` guarantees trace continuity across server restarts and hot reloads.

12. **Persistent GUID (`topic_id`) Architecture & Finished-Only Reveal Policy**:
    - Generates stable, canonical topic identifiers (e.g. `"top_space_exploration"`) at the semantic intake boundary and propagates them end-to-end.
    - Suppresses interim wire cards while the multi-agent evolution orchestrator is actively working; reveals completed dossiers with zero layout jumps or flashing.

13. **User Management & Monetization (`src/core/storage/postgres-store.ts`, `src/core/stripe/stripe-service.ts`)**:
    - Tiered accounts (`free`, `pro`, `enterprise`) with automatic quota tracking, rate limits, and Stripe Customer Portal integration (`/api/stripe/*`).
    - Administrative controls (`/api/admin/users`) for quota overrides, tier elevation, and system telemetry.

---

## ⚡ Key Features

- **3-Pillar Living Topic Dossiers**: User interests are modeled across three distinct pillars:
  1. *What They Care About*: Sub-domains, technologies, architectures, and empirical focus boundaries.
  2. *Why They Care*: Core intellectual stakes, motivations, philosophical worldview, and core concerns.
  3. *Presentation Strategy*: Editorial framing and density derived strictly from user feedback and engagement.
- **5-Phase Generative Brief Evolution**: Cards dynamically evolve from breaking alerts into rich multi-section dossiers featuring executive takes, deep-dive analyses, key metrics, and chronological developments.
- **7 Dynamic Presentation Archetypes**: Layouts adapt to story characteristics (`field_synthesis`, `deep_dive_narrative`, `comparative_dossier`, `breaking_pulse`, `regulatory_controversy`, `technical_architecture`, `timeline_evolution`).
- **Persistent GUID Topic Intelligence**: Every topic, wire article, fact entity, and UI card is keyed by an immutable `topic_id`, ensuring deterministic $O(1)$ bucketing, zero card duplication, and rock-solid React DOM stability.
- **Finished-Only Card Reveal Policy**: Prevents jarring layout shifts and flashing wire cards. Users see a single cohesive loading skeleton until the multi-phase evolution finishes, revealing a complete dossier.
- **Epistemic Evaluator & Autonomous Deep Research**: AI agents evaluate news collections for source sufficiency and bias, executing autonomous recursive search loops to fill factual deficits before writing.
- **Active Discussion Feed Filtering**: Inquiring about a topic in companion chat dynamically isolates related feed stories in real time, accompanied by clear visual filter badges and dismissal controls.
- **Interactive Sentence-Level Narrative Citations**: Cohesive topic summaries where each sentence features clickable source citations that open in an in-app `SourceReaderModal`.
- **Free Multi-Source News Ingestion (Zero API Keys)**: Live multi-source ingestion aggregating Reuters, BBC, Ars Technica, Hacker News, Reddit, Bluesky, and niche technical outlets with zero API keys required.
- **Standalone Agentic Observability Studio (`/observability`)**: Comprehensive tracing dashboard featuring parent-child agent execution trees, cognitive rationale inspection, token consumption meters, and disk trace warm-up.
- **Multi-Tier Monetization & Stripe Billing**: Seamless subscription management supporting `free`, `pro`, and `enterprise` tiers with checkout sessions, customer billing portal, and automated webhook synchronization.
- **Dedicated Persona Topic Hubs**: Tailored landing views for `/tech`, `/business`, `/policy`, `/scholar`, and `/wellness` with contextual onboarding and persona navigation.
- **Architectural Guardrails & Zero Overfitting**: Strict guardrail tests enforce pure generalizability and ban brittle regex intent routing or hardcoded test-case entities.
- **Google OAuth Single Sign-On (SSO)**: Cross-subdomain session management shared seamlessly between `ciclops.io` and `news.ciclops.io`.
- **Production PostgreSQL Persistence & Seed State**: Full schema support with pgvector, JSONB diff tracking, and embedded `SEED_DATA_STATE` for seamless zero-downtime boots.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language**: [TypeScript 5.7+](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/) with Glassmorphic Dark UI & CSS Variables
- **AI Models**: [DeepSeek](https://www.deepseek.com/) (`deepseek-chat` / `deepseek-reasoner`) via OpenAI-compatible SDK
- **Multi-Agent Engine**: [LangGraph](https://github.com/langchain-ai/langgraphjs) (`@langchain/langgraph` & `@langchain/core`)
- **Billing & Subscriptions**: [Stripe](https://stripe.com/) (`stripe` SDK)
- **Authentication**: [NextAuth.js 4.24](https://next-auth.js.org/) (Google OAuth Provider with shared cookie domain)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) + `pgvector` (AWS RDS `db.t4g.micro`)
- **Infrastructure**: AWS ECS Fargate, CloudFront CDN, Route 53, SSM Parameter Store, Amazon ECR
- **IaC**: [Terraform](https://www.terraform.io/) (`>= 1.5.0`)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Testing**: [Vitest](https://vitest.dev/) (181 unit & integration tests across 29 suites)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20+` or `v22+`
- **npm**: `v10+`
- **PostgreSQL**: (Optional for local development; system gracefully falls back to local file persistence if no database URL is provided)

### 1. Clone & Install Dependencies

```bash
git clone git@github.com:rhenretta/aletheia.git
cd aletheia
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Database & Cache
DATABASE_URL="postgresql://aletheia:aletheia_secret@localhost:5432/aletheia_db"
REDIS_URL="redis://localhost:6379"

# AI Engine (DeepSeek)
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
DEEPSEEK_MODEL="deepseek-chat"

# Authentication (Google OAuth)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-32-char-random-secret"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ADMIN_EMAILS="your-email@gmail.com"

# Stripe Monetization (Optional for local dev)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."

# Application Config
PORT=3000
NODE_ENV=development
```

### 3. Run Schema Migrations & Auto-Seed

```bash
npm run db:migrate
```

### 4. Start Local Development Server

```bash
# Standard local Next.js dev server
npm run dev

# Or run with Docker Compose
npm run dev:docker
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
Open [http://localhost:3000/observability](http://localhost:3000/observability) for the Agentic Observability Studio.

---

## 🧪 Testing & Verification

Run the comprehensive test suite and architectural integrity checks:

```bash
# Run all 29 Vitest suites (181 tests)
npm run test

# Run TypeScript strict typecheck
npm run typecheck

# Synchronize living documentation and mermaid graphs
npm run doc-sync

# Complete pre-deployment validation pipeline (typecheck + test + build)
npm run validate
```

---

## 🔧 CLI & Production Tooling

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server on port 3000 |
| `npm run dev:docker` | Builds and launches local development stack in Docker Compose |
| `npm run build` | Compiles production standalone Next.js bundle |
| `npm run test` | Executes all 181 unit and integration tests across 29 suites |
| `npm run test:watch` | Starts Vitest in interactive watch mode for rapid test iteration |
| `npm run typecheck` | Validates strict TypeScript compilation without emission (`tsc --noEmit`) |
| `npm run validate` | Executes full pre-deployment pipeline: `typecheck && test && build` |
| `npm run db:migrate` | Runs idempotent schema DDL and seeds RDS PostgreSQL with persistent data |
| `npm run doc-sync` | Synchronizes `docs/system_architecture.md` and `docs/state_graph.mermaid` |
| `npm run prod:inspect` | Secure interactive CLI to inspect live AWS production state, topics, and traces |
| `npm run prepare` | Configures repository git hooks (`.githooks`) |

---

## 🚢 Production Deployment

The project includes complete Terraform infrastructure in [`terraform/`](./terraform) and automated CI/CD deployment via GitHub Actions in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

### GitHub Secrets Required

Set the following secrets in repository settings (**Settings > Secrets and variables > Actions**):

| Secret Name | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key with permissions for ECR, ECS, and Terraform |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key for AI synthesis and epistemic evaluation |
| `GOOGLE_CLIENT_ID` | Shared Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Shared Google OAuth Client Secret |
| `NEXTAUTH_SECRET` | 32-character NextAuth encryption secret |
| `ADMIN_EMAILS` | Comma-separated administrator email addresses |
| `STRIPE_SECRET_KEY` | Stripe Secret Key for subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook signing secret |

---

## 📂 Project Structure

```text
aletheia/
├── .agents/rules/             # Architectural integrity rules & guardrails
├── .github/workflows/         # CI/CD deployment pipelines (deploy.yml)
├── data/                      # Local fallback cache & persistence directory
├── docs/                      # Architectural specs & state machine diagrams
│   ├── state_graph.mermaid    # Dynamic Mermaid state topology (auto-synced)
│   └── system_architecture.md # Living system architecture documentation (auto-synced)
├── src/
│   ├── app/                   # Next.js App Router (pages & API routes)
│   │   ├── business/          # Business persona landing page
│   │   ├── observability/     # Agentic Observability & Execution Studio UI
│   │   ├── policy/            # Policy & governance persona landing page
│   │   ├── scholar/           # Research & academic persona landing page
│   │   ├── support/           # User support & inquiry page
│   │   ├── tech/              # Technology persona landing page
│   │   ├── wellness/          # Health & wellness persona landing page
│   │   ├── api/
│   │   │   ├── admin/         # Admin user management & quota overrides
│   │   │   ├── auth/          # NextAuth route handler & dev sessions
│   │   │   ├── briefs/        # Generative brief synthesis & card evolution
│   │   │   ├── chat/          # Auth-gated conversational intake & SSE token stream
│   │   │   ├── devtools/      # DevTools telemetry inspection & live SSE stream
│   │   │   ├── interests/     # Knowledge graph harmonization endpoint
│   │   │   ├── observability/ # Execution studio traces & metrics query API
│   │   │   ├── pipeline/      # Autonomous news collector & discovery pipeline
│   │   │   ├── session/       # Multi-user session & Mind-State rehydration
│   │   │   ├── stripe/        # Stripe checkout, customer portal, webhook & sync
│   │   │   ├── support/       # User support ticket dispatching
│   │   │   ├── telemetry/     # Behavioral & dwell telemetry ingestion
│   │   │   ├── traces/        # Agent trace log querying endpoint
│   │   │   └── user/          # User usage meters and limit inspection
│   │   ├── layout.tsx         # Root layout with AuthProvider & global analytics
│   │   └── page.tsx           # Main unified dashboard UI & finished-only feed
│   ├── components/            # React UI components
│   │   ├── briefs/            # DynamicBriefSectionRenderer & presentation archetypes
│   │   ├── landing/           # Persona nav, client wrappers, and footers
│   │   ├── AuthProvider.tsx   # NextAuth session context wrapper
│   │   ├── DevToolsPanel.tsx  # 6-stage agentic workflow inspection drawer
│   │   ├── FormattedMessage.tsx # Streamlined markdown & clickable citations
│   │   ├── MobileCompanionSheet.tsx # Drawer for mobile companion dialogue
│   │   ├── SourceReaderModal.tsx # In-app original article viewer
│   │   ├── SubscriptionModal.tsx # Stripe pricing & tier selection modal
│   │   ├── SupportModal.tsx   # User feedback and support modal
│   │   ├── UserManagerModal.tsx # Admin user management & quota modal
│   │   └── UserMenu.tsx       # Profile menu, tier indicators, and sign-out
│   ├── core/
│   │   ├── agents/            # Multi-agent system
│   │   │   ├── cards/         # TopicCardEvolutionOrchestrator (5 phases, 7 archetypes)
│   │   │   ├── context/       # ContextAgent (The Empath, depth calibration)
│   │   │   ├── discovery/     # DiscoveryAgent, EpistemicEvaluator, topic filter
│   │   │   ├── epistemology/  # BiasStripper & PureFactObject extraction
│   │   │   ├── intake/        # DialogueAgent (Inverted flow, prefix-rationale)
│   │   │   ├── observer/      # ObserverAgent, TopicMutationEngine, Harmonizer
│   │   │   ├── scout/         # Direct & Social source scouts (Reddit, Bluesky)
│   │   │   ├── serendipity/   # Epsilon-greedy exploration/exploitation bandit
│   │   │   └── telemetry/     # Passive dwell & scroll interaction tracker
│   │   ├── auth/              # NextAuth configuration and cookie domain scoping
│   │   ├── graph/             # LangGraph state machine workflow
│   │   ├── ingestion/         # Free RSS, direct crawler & live search engines
│   │   ├── llm/               # DeepSeek provider & structured response parsing
│   │   ├── matching/          # Semantic matcher & TopicBriefBuilder (topic_id GUID)
│   │   ├── observability/     # TraceLogger, DocWorker, & live trace persistence
│   │   ├── search/            # SemanticTopicResolver & knowledge graph traversal
│   │   ├── storage/           # PostgreSQL store, seed state, & schema DDL
│   │   ├── stripe/            # StripeService for subscriptions & checkout
│   │   └── types/             # TypeScript contracts & data interfaces
│   ├── scripts/               # Migration, inspection, and documentation scripts
│   │   ├── migrate-db.ts      # Schema migration & auto-seeding
│   │   ├── prod-inspector.ts  # Live production RDS & ECS diagnostic CLI
│   │   └── sync-docs.ts       # Living documentation synchronization runner
│   └── test/                  # Vitest unit & integration test suites (29 suites)
├── terraform/                 # AWS Infrastructure as Code (ECS, RDS, CloudFront, ECR)
├── Dockerfile                 # Production multi-stage Alpine Docker container
├── next.config.mjs            # Next.js standalone build configuration
└── package.json
```

---

## 📄 License

Private repository — Copyright © 2026 [ciclops.io](https://ciclops.io). All rights reserved.
