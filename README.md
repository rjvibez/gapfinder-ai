# GapFinder AI — Intelligent Diagnostic Learning & Syllabus Gap Analysis Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_PostgreSQL-3ecf8e?style=flat&logo=supabase)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/Groq-LPU_Inference-f55036?style=flat)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat&logo=vercel)](https://vercel.com/)

---

## 1. Project Overview

**GapFinder AI** is an adaptive, curriculum-grounded EdTech platform engineered to help students identify and close critical knowledge gaps before examinations. 

Traditional revision workflows often rely on passive re-reading or generic question banks disconnected from a student's actual syllabus. Students frequently spend hours reviewing topics they already understand while overlooking foundational misconceptions.

GapFinder AI solves this by converting course lecture notes, reading materials, and syllabus documents into an interactive diagnostic engine:
- **Zero Hallucination Guarantee:** Diagnostics, topic hierarchies, and explanations are grounded strictly in the student's uploaded PDF materials with exact page citations.
- **Cognitive Gap Detection:** Rather than merely cataloging raw incorrect answers, GapFinder AI evaluates mistake patterns against mapped syllabus concepts to reveal underlying misconceptions (e.g., distinguishing fundamental processing cycles vs. application software).
- **Automated Remediation:** Diagnostic outcomes dynamically feed into an individualized, prioritized daily revision plan that targets weak and medium mastery topics.
- **Enterprise-Grade Data Isolation:** Every student's documents, topics, quiz attempts, and revision schedules are strictly segregated using Supabase Authentication and PostgreSQL Row Level Security (RLS).

---

## 2. Live Application & Repository

- **Production URL:** [https://gapfinder-ai-gules.vercel.app](https://gapfinder-ai-gules.vercel.app)
- **GitHub Repository:** [https://github.com/rjvibez/gapfinder-ai](https://github.com/rjvibez/gapfinder-ai)

---

## 3. Student Registration and Login Instructions

GapFinder AI utilizes self-contained email-and-password authentication powered by Supabase Auth. Follow these steps to register and access your personal workspace:

### Registration & Sign In Steps:
1. Open the live application: [https://gapfinder-ai-gules.vercel.app](https://gapfinder-ai-gules.vercel.app)
2. On the authentication screen, select the **Sign Up** tab.
3. Enter your **Full Name**, optional **Course / Role** (e.g., Computer Science Student), **Email Address**, and a secure **Password** (minimum 6 characters).
4. Click **Create Account** to submit the registration form.
5. If Supabase email confirmation is enabled on the project, a confirmation email with a verification link will be dispatched to your registered address.
6. Open your email inbox, locate the verification message from Supabase / GapFinder AI, and click the **Confirm your mail** link.
7. Once verified, return to the GapFinder AI application tab.
8. Switch to the **Sign In** tab.
9. Enter your registered **Email Address** and **Password**.
10. Click **Sign In** to access your private, authenticated dashboard.

### Important Authentication Notes:
- **Email Verification:** If confirmation is active, you must click the verification link in your email before your first sign-in.
- **Spam / Junk Folder:** If the confirmation email does not appear in your inbox within 1–2 minutes, check your Spam or Junk folder.
- **No Third-Party Accounts Needed:** You do not need a GitHub, Vercel, or Google account. Registration uses standard email and password credentials.
- **Individual Accounts:** Each student registers with their own distinct email.
- **Row Level Security (RLS):** All database tables enforce PostgreSQL RLS policies (`auth.uid() = user_id`). Your uploaded PDFs, extracted topics, quiz scores, and revision plans are completely private and inaccessible to any other user.

---

## 4. Application Features

| Module | Purpose & Core Capabilities |
| :--- | :--- |
| **Dashboard Overview** | Comprehensive workspace hub displaying real-time metrics: mapped topics count, diagnostic quizzes completed, revision tasks pending, and primary study recommendations. Features a guided setup flow directing students to upload materials or take pending quizzes. |
| **My Materials** | Secure document repository. Upload course PDF notes or syllabi (up to 10 MB). Automatically extracts the document title from the filename (editable), captures page counts, validates PDF magic headers, and segments text into page-referenced chunks. Includes material status tracking, view mode, and duplicate upload prevention. |
| **AI Topic Mapping** | Automated syllabus extraction engine powered by Groq. Analyzes uploaded material chunks page-by-page to extract structured topics, subtopics, importance levels (`High`, `Medium`, `Low`), learning objectives, key concepts, formulas, and exact source page citations. Renders an interactive hierarchy with prerequisite awareness. |
| **Diagnostic Quiz** | Low-stakes, 5-question multiple-choice diagnostic assessments generated on-demand from the student's mapped topics. Every question is grounded strictly in document chunks with 4 distinct options, verified correct answers, explanations, and page citations. Automatically updates topic mastery upon submission. |
| **Gap Analysis** | Pedagogical evaluation engine that classifies topics into distinct mastery tiers: **Weak** (<50%), **Medium** (50–79%), **Strong** (≥80%), and **Not Assessed** (topics awaiting initial quiz). Synthesizes incorrect answers into **Conceptual Knowledge Gaps**, grouping repeated mistakes under specific concepts with problem diagnoses, actions, and source citations. |
| **Revision Planner** | Intelligent study planner that translates diagnostic findings into structured revision tasks (Concept Reviews, Practice Sets, Error Logs). Automatically prioritizes Weak topics followed by Medium topics, allocates estimated durations, prevents duplicate tasks, and enables marking tasks as completed or undoing completion. |
| **Progress Tracking** | Transparent learning analytics dashboard reflecting genuine student activity. Tracks overall diagnostic accuracy, chronological quiz attempt history, mastery progression trends over time, and task completion velocity. Omits fabricated metrics and supports manual data refresh. |
| **Settings** | Personalization center allowing students to update their profile name, academic title, and weekly study goal hours. Preferences are persisted directly to Supabase. Includes a sign-out action clearing authenticated sessions securely. |

---

## 5. End-to-End Student Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Register │ ──> │ 2. Verify    │ ──> │  3. Sign In  │ ──> │  4. Upload   │
│  & Sign Up   │     │    Email     │     │   to Account │     │  Course PDF  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                      │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│ 8. Generate  │ <── │ 7. Analyze   │ <── │ 6. Take      │ <──────────┘
│    Plan      │     │    Gaps      │     │  Diagnostic  │     5. Extract
└──────┬───────┘     └──────────────┘     └──────────────┘        Topics
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ 9. Execute   │ ──> │ 10. Track    │
│    Tasks     │     │   Progress   │
└──────────────┘     └──────────────┘
```

1. **Register:** Create a student account with full name, email, and password.
2. **Verify Email:** Confirm your email address via the link sent by Supabase Auth.
3. **Sign In:** Authenticate into your isolated workspace.
4. **Upload PDF:** Upload lecture notes or syllabus documents in **My Materials**. The system extracts text and creates page-referenced chunks.
5. **Extract Topics:** Trigger **Map Topics** to let the AI analyze the document and construct a structured topic hierarchy with key concepts and citations.
6. **Take Diagnostic:** Navigate to **Diagnostic Quiz**, pick a mapped topic, and complete a 5-question source-grounded assessment.
7. **Analyze Gaps:** Review **Gap Analysis** to inspect your mastery tier and examine conceptual mistakes grouped by knowledge gap.
8. **Generate Plan:** Open **Revision Planner** to generate targeted study tasks prioritized by your weakest assessed areas.
9. **Execute & Complete:** Work through scheduled tasks, review cited material pages, and mark tasks complete.
10. **Track Progress:** Monitor mastery growth and quiz scores over time in the **Progress** dashboard.

---

## 6. Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.4.6** (App Router) | React Server Components, server actions, route handlers, and Turbopack optimization. |
| **Language** | **TypeScript 5.x** | End-to-end strict type safety across database schemas, API contracts, and UI components. |
| **Styling** | **Tailwind CSS v4** | Modern utility-first CSS framework with tailored typography and micro-interactions. |
| **Database & Auth** | **Supabase** (`@supabase/supabase-js`) | Managed PostgreSQL database, JWT-based Supabase Auth, and Row Level Security (RLS) policies. |
| **AI / LLM Inference** | **Groq SDK** (`@ai-sdk/groq`, `ai` v7) | Ultra-low latency LPU inference using `openai/gpt-oss-120b` for topic extraction, quiz generation, and schema-constrained JSON outputs. |
| **Schema Validation** | **Zod** (`zod` v4) | Runtime structured JSON schema validation for strict AI output conformance. |
| **PDF Processing** | **PDF.js** (`pdfjs-dist` v6) | Server-side binary PDF inspection, magic header validation, page-by-page text extraction, and character chunking. |
| **Hosting Platform** | **Vercel** | Serverless deployment with edge CDN caching and automated CI/CD pipelines. |

---

## 7. Local Installation & Development

### Prerequisites:
- **Node.js:** v20.x or higher installed ([Node.js Downloads](https://nodejs.org/))
- **npm:** v10.x or higher (or `pnpm` / `yarn`)
- **Supabase Account:** Active project with database schema applied
- **Groq Cloud API Key:** Active key from [Groq Console](https://console.groq.com/)

### Step-by-Step Setup:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rjvibez/gapfinder-ai.git
   cd gapfinder-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the project root with the variables described in Section 8:
   ```bash
   # Create .env.local and populate the required keys
   touch .env.local
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open the local application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

6. **Verify production build & linting:**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```

---

## 8. Environment Variables

Create a `.env.local` file in the root directory and configure the following variables. **Never commit actual secret keys or credentials to version control.**

```env
# ==============================================================================
# Supabase Configuration (Client & Server)
# ==============================================================================
# Found in Supabase Dashboard -> Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key

# ==============================================================================
# Groq AI Inference Configuration (Server-side Route Handlers Only)
# ==============================================================================
# Found in Groq Cloud Console -> API Keys (Used for LLM topic extraction and quizzes)
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### Variable Details:
- `NEXT_PUBLIC_SUPABASE_URL`: The HTTPS base endpoint of your hosted Supabase instance.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public anonymous key for client-side and server-side Supabase requests (protected by PostgreSQL RLS).
- `GROQ_API_KEY`: Secret API key used strictly on server-side Next.js route handlers (`/api/topics/extract`, `/api/quiz/generate`, `/api/quiz/submit`).

---

## 9. Vercel Deployment

GapFinder AI is optimized for zero-configuration deployment on Vercel:

1. **Import Repository:**
   - Sign in to [Vercel](https://vercel.com).
   - Click **Add New Project** and select the `gapfinder-ai` repository from your GitHub account.

2. **Configure Build Settings:**
   - **Framework Preset:** Next.js
   - **Build Command:** `next build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

3. **Set Environment Variables in Vercel:**
   In the project settings, add the three production environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`

4. **Deploy:**
   - Click **Deploy**. Vercel will build the production application, optimize serverless routes, and output the live deployment URL.

5. **Supabase Auth Redirect URL Configuration:**
   - In your [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication** -> **URL Configuration**, add your Vercel deployment URL to **Site URL** and **Redirect URLs** (e.g., `https://gapfinder-ai-gules.vercel.app/**`).

---

## 10. Current Limitations & Roadmap

To maintain academic and professional transparency, the following boundaries and planned enhancements are documented:

- **OCR for Scanned Image PDFs:** PDF processing currently extracts selectable digital text via PDF.js. Image-only scanned PDFs (e.g., photocopied textbook pages without an OCR layer) require optical character recognition, which is planned for a future release.
- **Push & Email Study Reminders:** The application UI includes an alert preference setting, which is currently labeled as an upcoming feature while background email notification jobs are under development.
- **Live Stopwatch / Session Timer:** Study hours in the Progress dashboard reflect completed revision tasks and diagnostic activity; an active live timer for offline study tracking is on the feature roadmap.
- **Non-PDF Document Formats:** Currently, `.pdf` is the sole supported format. Support for `.docx`, `.pptx`, and Markdown file uploads is planned for future iterations.

---

## 11. License

This project is licensed under the [MIT License](LICENSE).
