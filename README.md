# 🌌 Aletheia (`α`)
### Personalized Epistemic News & Conversational Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![AWS ECS Fargate](https://img.shields.io/badge/AWS-ECS_Fargate-FF9900?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/ecs/)
[![Terraform](https://img.shields.io/badge/Terraform-1.9.0-844FBA?style=flat-square&logo=terraform)](https://www.terraform.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-41%20Passed%20(13%20Suites)-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)

**Aletheia** is an autonomous, multi-agent epistemic news aggregator and conversational AI companion built on the **Mind-State Memory Architecture**. It delivers high-signal, bias-stripped, and clickbait-free technical journalism tailored dynamically to your evolving intellectual curiosities and engineering depth.

Aletheia is released under the **[ciclops.io](https://ciclops.io)** ecosystem at **[news.ciclops.io](https://news.ciclops.io)** with cross-subdomain Google OAuth Single Sign-On (SSO).

---

## 🏛️ Mind-State Memory Architecture

Aletheia replaces static news feeds and sycophantic chatbot interactions with a coordinated, dual-loop multi-agent architecture:

```mermaid
flowchart TD
    subgraph ClientUI ["Frontend & User Experience (Next.js 14)"]
        User(["User Prompt / Article Discussion"])
        FeedUI["Personalized Epistemic Feed & Topic Briefs"]
        CompanionUI["Companion Chat & Source Reader Modal"]
        DevToolsUI["Real-Time DevTools (6-Stage Agentic Flow)"]
    end

    subgraph MindStateMemory ["Mind-State Memory & Single Source of Truth"]
        UnifiedNode[("UnifiedTopicNode (PostgreSQL RDS)
        - 3 Pillars: What / Why / Presentation
        - Living Narrative & Evolution Timeline
        - Recent Topic Diffs & Harmonization Runs")]
    end

    subgraph ConversationalPipeline ["Inverted Conversational Epistemic Pipeline"]
        direction TB
        Resolver["1. Semantic Topic Resolver
        (Graph Traversal & Discussion Subject)"]
        FeedFilter["Active Feed Filter
        (Real-Time Semantic Affinity)"]
        ContextEmpath["2. Context Agent (The Empath)
        (Depth Calibration & Candidate Story Grounding)"]
        EpistemicCheck{"3. Epistemic Sufficiency &
        Temporal Grounding Check"}
        LiveSearch["Live Wire Search Tool
        (FreeNewsFetcher Zero-Key Search)"]
        LLMDialogue["4. Aletheia Dialogue Engine (DeepSeek)
        Prefix-Rationale: Internal Deliberation FIRST
        Synthesized Conversational Stream LAST"]
    end

    subgraph ActiveListening ["Autonomous Background Adaptation"]
        direction TB
        Observer["Observer Agent (Active Listener)
        Silent Multi-Turn Evaluation"]
        MutationEngine["Topic Mutation Engine
        (create_topic / update_topic Tools)"]
        Harmonizer["Interest Harmonizer
        (Knowledge Graph Saturation Reconciliation)"]
        TelemetryEngine["Passive Telemetry Engine
        (Dwell Time / Scroll Depth / Decay)"]
    end

    subgraph AutonomousFeedPipeline ["Autonomous News Curation & Epistemology"]
        direction TB
        RSS["Global Multi-Source Wires & RSS"]
        Epistemology["Node A: Epistemology Agent
        (Bias Stripper & PureFact Object)"]
        Discovery["Discovery Agent (The Curator)
        Multi-Tiered Queries & Strict Quality Filter"]
        Matcher["Semantic Matcher & Topic Brief Builder
        (Velocity Status, Deduplication & Narrative Citations)"]
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

    CompanionUI -. "Completed Turn" .-> Observer
    FeedUI -. "User Dwell / Scroll Telemetry" .-> TelemetryEngine
    TelemetryEngine --> Observer
    Observer --> MutationEngine
    MutationEngine --> UnifiedNode
    Observer -. "Graph Saturation (>= 25)" .-> Harmonizer
    Harmonizer --> UnifiedNode

    RSS --> Epistemology
    Epistemology --> Discovery
    UnifiedNode -.-> Discovery
    Discovery --> Matcher
    Matcher --> FeedUI
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

6. **Epistemology Agent (`src/core/agents/epistemology/`) - Bias Stripper**:
   - Ingests raw news reporting, strips hyperbolic adjectives and emotive rhetoric, and outputs verifiable `PureFactObject` entities with agreed facts and disputed claims.

7. **Discovery Agent (`src/core/agents/discovery/discovery-agent.ts`) - The Curator**:
   - Synthesizes multi-tiered queries spanning revealed preferences, cross-domain intersections, and curiosity frontiers.
   - Rejects clickbait, low-density articles, and user anti-preferences before ingestion.

8. **Semantic Matcher & Topic Brief Builder (`src/core/matching/`)**:
   - Calculates multi-dimensional concept sphere alignment between stories and user knowledge graphs.
   - Builds intelligence topic dossiers with velocity status indicators (*breaking, active, recent, steady, dormant*).
   - Groups syndicated news coverage and generates sentence-level narrative summaries with interactive clickable citations.

---

## ⚡ Key Features

- **3-Pillar Living Topic Dossiers**: User interests are modeled across three distinct pillars:
  1. *What They Care About*: Sub-domains, technologies, and empirical focus boundaries.
  2. *Why They Care*: Core intellectual stakes, motivations, and philosophical worldview.
  3. *Presentation Strategy*: Editorial framing derived strictly from user feedback and engagement.
- **Active Discussion Feed Filtering**: Inquiring about a topic in companion chat dynamically isolates related feed stories in real time, accompanied by clear visual filter badges and dismissal controls.
- **Interactive Sentence-Level Narrative Citations**: Topic briefs provide cohesive synthesis where every sentence features clickable source citations that open in an in-app `SourceReaderModal`.
- **Syndication Deduplication**: Identical syndicated wire reporting across major news outlets is automatically deduplicated to maximize feed diversity.
- **Free Multi-Source News Ingestion (Zero API Keys)**: Live multi-source ingestion aggregating Reuters, BBC, Ars Technica, Hacker News, SpaceNews, and more with zero external API key requirements.
- **Deep Observability & 6-Stage DevTools**: Built-in DevTools panel displaying real-time agentic flow steps, raw system prompts, raw user prompts, executed tool queries, and live SSE traces.
- **Architectural Guardrails & Zero Overfitting**: Strict guardrail tests enforce pure generalizability and ban brittle regex intent routing or hardcoded test-case entities.
- **Google OAuth Single Sign-On (SSO)**: Cross-subdomain session management shared between `ciclops.io` and `news.ciclops.io`.
- **Production PostgreSQL Persistence & Seed State**: Full schema support with pgvector, JSONB diff tracking, and embedded `SEED_DATA_STATE` for seamless zero-downtime boots.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with Glassmorphic Dark UI & CSS Variables
- **AI Models**: [DeepSeek](https://www.deepseek.com/) (`deepseek-chat` / `deepseek-reasoner`) via OpenAI-compatible SDK
- **Multi-Agent Engine**: [LangGraph](https://github.com/langchain-ai/langgraphjs) & Autonomous Specialized Agents
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (Google OAuth Provider with shared cookie domain)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) + `pgvector` (AWS RDS `db.t4g.micro`)
- **Infrastructure**: AWS ECS Fargate, CloudFront CDN, Route 53, SSM Parameter Store, Amazon ECR
- **IaC**: [Terraform](https://www.terraform.io/) (`>= 1.5.0`)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Testing**: [Vitest](https://vitest.dev/) (41 unit & integration tests across 13 suites)

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

---

## 🧪 Testing & Verification

Run the comprehensive test suite and architectural integrity checks:

```bash
# Run all 13 Vitest suites (41 tests)
npm run test

# Run TypeScript strict typecheck
npm run typecheck

# Synchronize living documentation and mermaid graphs
npm run doc-sync
```

---

## 🔧 CLI & Production Tooling

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server |
| `npm run dev:docker` | Builds and launches local stack in Docker Compose |
| `npm run build` | Builds production standalone Next.js bundle |
| `npm run test` | Executes all 41 unit and integration tests |
| `npm run typecheck` | Validates strict TypeScript compilation without emission |
| `npm run db:migrate` | Runs idempotent schema DDL and seeds RDS PostgreSQL with persistent data |
| `npm run doc-sync` | Synchronizes `docs/system_architecture.md` and `docs/state_graph.mermaid` |
| `npm run prod:inspect` | Secure interactive CLI to inspect live AWS production state, topics, and traces |

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

---

## 📂 Project Structure

```text
aletheia/
├── .agents/rules/             # Architectural integrity rules & guardrails
├── .github/workflows/         # CI/CD deployment pipelines
├── data/                      # Local fallback cache directory
├── docs/                      # Architectural specs & state machine diagrams
│   ├── state_graph.mermaid    # Dynamic Mermaid state topology
│   └── system_architecture.md # Living system architecture documentation
├── src/
│   ├── app/                   # Next.js App Router (pages & API routes)
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth route handler
│   │   │   ├── chat/          # Auth-gated conversational intake & SSE token stream
│   │   │   ├── devtools/      # DevTools telemetry inspection & live SSE stream
│   │   │   ├── interests/     # Knowledge graph harmonization endpoint
│   │   │   ├── pipeline/      # Autonomous news collector & discovery pipeline
│   │   │   ├── session/       # Multi-user session & Mind-State rehydration
│   │   │   ├── telemetry/     # Behavioral & dwell telemetry ingestion
│   │   │   └── traces/        # Agent trace log querying endpoint
│   │   ├── layout.tsx         # Root layout with AuthProvider & metadata
│   │   └── page.tsx           # Main unified dashboard UI
│   ├── components/            # React UI components (DevTools, Modals, MobileCompanion)
│   ├── core/
│   │   ├── agents/            # Multi-agent system (Dialogue, Context, Discovery, Observer, Epistemology)
│   │   ├── auth/              # NextAuth configuration and cookie domain scoping
│   │   ├── graph/             # LangGraph state machine workflow
│   │   ├── ingestion/         # Free RSS & wire search engines
│   │   ├── llm/               # DeepSeek client & structured response parsing
│   │   ├── matching/          # Semantic matcher & topic brief builder
│   │   ├── observability/     # Trace logger & living documentation sync worker
│   │   ├── search/            # Semantic Topic Resolver & graph traversal
│   │   ├── storage/           # PostgreSQL store, seed state, & schema DDL
│   │   └── types/             # TypeScript contracts & data interfaces
│   ├── scripts/               # Migration, inspection, and documentation scripts
│   └── test/                  # Vitest unit & integration test suites
├── terraform/                 # AWS Infrastructure as Code (ECS, RDS, CloudFront, ECR)
├── Dockerfile                 # Production multi-stage Alpine Docker container
├── next.config.mjs            # Next.js standalone build configuration
└── package.json
```

---

## 📄 License

Private repository — Copyright © 2026 [ciclops.io](https://ciclops.io). All rights reserved.
