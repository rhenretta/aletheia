# 🌌 Aletheia (`α`)
### Personalized Epistemic News & Conversational Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![AWS ECS Fargate](https://img.shields.io/badge/AWS-ECS_Fargate-FF9900?style=flat-square&logo=amazon-aws)](https://aws.amazon.com/ecs/)
[![Terraform](https://img.shields.io/badge/Terraform-1.9.0-844FBA?style=flat-square&logo=terraform)](https://www.terraform.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-17%20Passed-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)

**Aletheia** is an autonomous, multi-agent epistemic news aggregator and conversational AI companion built on the **Mind-State Memory Architecture**. It delivers high-signal, bias-stripped, and clickbait-free technical journalism tailored dynamically to your evolving intellectual curiosities and engineering depth.

Aletheia is released under the **[ciclops.io](https://ciclops.io)** ecosystem at **[news.ciclops.io](https://news.ciclops.io)** with cross-subdomain Google OAuth Single Sign-On (SSO).

---

## 🏛️ Mind-State Memory Architecture

Aletheia replaces static news feeds and sycophantic chatbot interactions with a coordinated multi-agent state graph:

```mermaid
flowchart TD
    User(["User Prompt / Article Click"]) --> Intake["Dialogue Agent"]
    Intake --> Empath["Context Agent (The Empath)"]
    Empath --> SemanticResolver["Semantic Topic Resolver & Graph Traversal"]
    SemanticResolver --> ContextEnvelope["Calibrated Context Envelope"]
    ContextEnvelope --> Intake
    Intake --> DeepSeek["DeepSeek LLM Engine"]
    DeepSeek --> Response(["Synthesized Response"])
    
    Response -.-> Observer["Observer Agent (Active Listener)"]
    Observer --> MindStateNode[("Unified Topic Node & Graph")]
    
    Wire["Global RSS & Web Wires"] --> Epistemology["Epistemology Agent (Bias Stripper)"]
    Epistemology --> Discovery["Discovery Agent (Curator)"]
    MindStateNode --> Discovery
    Discovery --> Feed(["Personalized Epistemic Feed"])
```

### Core Agents

1. **Dialogue Agent (Intake & Delivery)**: Handles natural multi-turn conversations, expands technical queries, avoids sycophancy and superficial analogies, and delivers calibrated answers.
2. **Context Agent (The Empath)**: Dynamically constructs rich context envelopes. Leverages the `SemanticTopicResolver` to resolve ambiguous queries, traverse the topic graph, and adjust tone and technical depth (Novice, Intermediate, Expert, Academic).
3. **Discovery Agent (The Curator)**: Autonomous pipeline agent that clusters raw news events and triages them across three distinct epistemic horizons:
   - **Revealed Preferences**: High-confidence technical topics reflecting current user projects and expertise.
   - **Thematic Intersections**: Novel synthesis crossing multiple distinct interests (e.g. *Autonomous Robotics × Off-Grid Energy*).
   - **Curiosity Frontiers**: Deliberate exploratory topics outside core habits to combat echo chambers.
4. **Observer Agent (The Active Listener)**: Silently evaluates direct user statements across chat turns to extract core intellectual drivers and update the persistent `UnifiedTopicNode` without interrupting dialogue flow.
5. **Epistemology Agent (Bias Stripper)**: Evaluates incoming reporting from mainstream and independent feeds, neutralizes emotional/sensationalist framing, and extracts atomic, verifiable facts.

---

## ⚡ Key Features

- **Bias-Stripped, Multi-Source News Ingestion**: Free multi-source ingestion aggregating Reuters, BBC, Ars Technica, Hacker News, SpaceNews, and more with zero external API key requirements.
- **Deep Observability & Contextual DevTools**: Built-in interactive DevTools panel providing real-time visibility into agentic envelopes, semantic topic resolutions, tool executions, and state transitions.
- **Google OAuth Single Sign-On (SSO)**: Seamless authentication shared across `ciclops.io` and `news.ciclops.io` via wildcard domain session tokens.
- **Strict Data Multi-Tenancy**: Isolated PostgreSQL persistence ensuring every user has a private knowledge graph, curiosity frontier history, and chat memory.
- **Production-Ready AWS Infrastructure**: Fully declared in Terraform with ECS Fargate, Application Load Balancer, Route 53, CloudFront CDN, and RDS PostgreSQL.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with Glassmorphic Dark UI & CSS Variables
- **AI Models**: [DeepSeek](https://www.deepseek.com/) (`deepseek-chat` / `deepseek-reasoner`) via OpenAI-compatible SDK
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (Google OAuth Provider with shared cookie domain)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) (AWS RDS `db.t4g.micro`)
- **Infrastructure**: AWS ECS Fargate, CloudFront CDN, Route 53, SSM Parameter Store, Amazon ECR
- **IaC**: [Terraform](https://www.terraform.io/) (`>= 1.5.0`)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20+` or `v22+`
- **npm**: `v10+`
- **PostgreSQL**: (Optional for local development; system gracefully falls back to local memory store if no database URL is set)

### 1. Clone & Install Dependencies

```bash
git clone git@github.com:rhenretta/aletheia.git
cd aletheia
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# AI Engine
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-chat"

# Authentication (Google OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="your-32-char-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# Database (Optional for local development)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aletheia_news"

# Administration
ADMIN_EMAILS="your-email@gmail.com"
```

### 3. Run Schema Migrations (if using PostgreSQL)

```bash
npm run db:migrate
```

### 4. Start Local Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the comprehensive unit and integration test suite:

```bash
# Run all Vitest suites
npm run test

# Run TypeScript typecheck
npm run typecheck
```

---

## 🚢 Production Deployment

The project includes a complete Terraform infrastructure configuration in [`terraform/`](./terraform) and an automated GitHub Actions deployment workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

### GitHub Secrets Required

Set the following secrets in your repository settings (**Settings > Secrets and variables > Actions**):

| Secret Name | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key with permissions for ECR, ECS, and Terraform |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key |
| `DEEPSEEK_API_KEY` | DeepSeek API Key for AI synthesis |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `NEXTAUTH_SECRET` | 32-character NextAuth encryption secret |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |

### Triggering Deployments

Deployments run automatically on every push to `master` (or `main`):
1. **Validation**: Executes `npm run typecheck` and `npm run test`.
2. **Build & Push**: Compiles standalone Next.js Docker image and pushes to Amazon ECR (`aletheia`).
3. **Provisioning**: Runs `terraform apply -auto-approve` to ensure ECS, ALB, RDS, and CloudFront are configured.
4. **Database Migration**: Automatically extracts provisioned RDS `DATABASE_URL` and applies `schema.sql`.
5. **Zero-Downtime Rollout**: Triggers ECS rolling deployment and purges CloudFront edge cache.

---

## 📂 Project Structure

```text
aletheia/
├── .github/workflows/         # CI/CD deployment pipelines
├── data/                      # Local fallback cache directory
├── docs/                      # Architectural specs & state machine diagrams
├── src/
│   ├── app/                   # Next.js App Router (pages & API routes)
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth route handler
│   │   │   ├── chat/          # Auth-gated conversational intake endpoint
│   │   │   ├── devtools/      # Observability and live SSE stream
│   │   │   ├── pipeline/      # Autonomous news collector & discovery pipeline
│   │   │   ├── session/       # Multi-user session & Mind-State rehydration
│   │   │   └── telemetry/     # Behavioral & dwell telemetry ingestion
│   │   ├── layout.tsx         # Root layout with AuthProvider & metadata
│   │   └── page.tsx           # Main unified dashboard UI
│   ├── components/            # React UI components (DevTools, Modals, AuthProvider)
│   ├── core/
│   │   ├── agents/            # Multi-agent system (Dialogue, Context, Discovery, Observer, Epistemology)
│   │   ├── auth/              # NextAuth configuration and cookie domain scoping
│   │   ├── graph/             # LangGraph state machine workflow
│   │   ├── ingestion/         # Free RSS & wire search engines
│   │   ├── llm/               # DeepSeek client & structured response parsing
│   │   ├── observability/     # Trace logger & documentation sync worker
│   │   ├── search/            # Semantic Topic Resolver & graph traversal
│   │   ├── storage/           # PostgreSQL store, persistence, & schema DDL
│   │   └── types/             # TypeScript contracts & data interfaces
│   ├── scripts/               # Migration and documentation synchronization scripts
│   └── test/                  # Vitest unit & integration test suites
├── terraform/                 # AWS Infrastructure as Code (ECS, RDS, CloudFront, ECR)
├── Dockerfile                 # Production multi-stage Alpine Docker container
├── next.config.mjs            # Next.js standalone build configuration
└── package.json
```

---

## 📄 License

Private repository — Copyright © 2026 [ciclops.io](https://ciclops.io). All rights reserved.
