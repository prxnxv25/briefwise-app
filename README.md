# Briefwise

Briefwise is a Vercel-ready test application for uploading a business requirements document, asking questions grounded in its text, and generating a Functional Specification (FSD), Technical Specification (TSD), or Solution Proposal (SPD).

## What it does

- Email and password signup/login with Auth.js and JWT sessions. Test registration is open.
- User-owned projects with isolated source files, chats, analysis, generated documents, and versions.
- Private Vercel Blob storage for uploaded Word and PDF files. Files are deleted with their source document or project.
- Reads `.doc`, `.docx`, and text-based `.pdf` files. Other extensions are rejected. The upload limit is 8 MB. Scanned PDFs that do not contain selectable text require OCR and are reported as unsupported by the text extractor.
- Extracts up to 120,000 characters, segments the text, and retrieves relevant passages for chat and document generation.
- Chat answers are grounded in retrieved passages and cite source snippets. The current retrieval method is lexical matching, so a separate embeddings provider and vector index are not required for this test deployment.
- Model requests are capped per user over a rolling 24-hour window. Set `DAILY_MODEL_CALL_LIMIT` (default `60`) to adjust the cap.
- BRD analysis produces numbered FR/NFR/CON requirements, scope, stakeholders, assumptions, constraints, risks, and open questions. User answers are treated as authoritative; unanswered items are marked as assumptions during generation.
- Generates one section per server request for FSD, TSD, and SPD. Groq is called only on the server. Sections stream to the browser and are versioned when generated, edited, or restored.
- Word export downloads `.docx`. PDF export opens a print-ready view; choose “Save as PDF” in the browser’s print dialog.
- Traceability shows requirement coverage by document and flags cited IDs that are missing from the analysis.

## Local setup

Requirements: Node.js 20.9 or later, npm, a Neon Postgres database, a Groq API key, and a Vercel Blob store for private source-file storage.

1. Install packages:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `AUTH_SECRET`, `GROQ_API_KEY`, and `BLOB_READ_WRITE_TOKEN`.

   Generate an Auth.js secret with `npx auth secret` or `openssl rand -base64 32`.

3. Create the database tables:

   ```bash
   # macOS/Linux
   set -a && source .env.local && set +a && npm run db:push

   # PowerShell
   $env:DATABASE_URL = "your-neon-connection-string"
   npm run db:push
   ```

4. Start the local server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000> and sign up with a test email and a password of at least eight characters.

## Neon database setup

1. Create a Neon project and database.
2. Copy the pooled connection string from the Neon dashboard. Add it as `DATABASE_URL` locally and in Vercel.
3. With `DATABASE_URL` set, run `npm run db:push` to create/update tables from `src/db/schema.ts`.

The application reads `DATABASE_URL` lazily at request time, so the Next.js build does not need a live database connection. Drizzle CLI commands require it.

## Groq setup

Set these server-side environment variables:

```env
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=your-groq-key
GROQ_MODEL=openai/gpt-oss-120b
DAILY_MODEL_CALL_LIMIT=60
```

The API key must not be exposed in a `NEXT_PUBLIC_` variable. The SDK is only imported by server-side modules. Analysis uses structured JSON prompts, document sections stream as plain text, and model requests are retried once.

## Vercel deployment

1. Push this project to a Git repository and import it into Vercel.
2. In Vercel Marketplace/Storage, connect a Neon database and create a **private** Blob store.
3. Add `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `GROQ_BASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `DATABASE_URL`, and `BLOB_READ_WRITE_TOKEN` in the Vercel project’s environment-variable settings. Keep secrets server-only.
4. Run `npm run db:push` once with the production Neon `DATABASE_URL` set. Alternatively run it locally against that database.
5. Deploy. Vercel uses the included Next.js App Router routes; upload, analysis, chat, and generation routes declare `maxDuration` where long-running model/document work occurs.

Private Blob upload is direct from the browser so the file does not pass through a Vercel Function request body. App routes verify the signed-in user and project ownership before issuing upload tokens or serving extracted content.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run db:push
npm run db:generate
```

## Notes for this test build

- Self-service signup is open by design. Use non-sensitive test data while demonstrating the app.
- Each account can only access its own projects and private source files.
- Chat retrieval is lexical (document term matching), not embedding-based semantic vector search. It is a lightweight retrieval-augmented generation path; add embeddings and pgvector if semantic retrieval quality becomes a requirement.
- Scanned PDF OCR, template uploads, configurable rate limits, email domain restrictions, and email/password reset are outside the current test scope.
- Groq output is a draft. Review assumptions, citations, `[TBC]` markers, and business decisions before using generated documents as approved project artifacts.
