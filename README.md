# Gixxer.ai

A premium multi-model AI workspace. This repository is being built in three phases.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Authentication | Complete |
| 2 | Landing page | Complete |
| 3 | AI workspace: chat, images, files, Chatbot Pro, widget, scheduled prompts, plugins, projects | Complete |

Phase 1 delivers registration, sign-in, sign-out, persistent sessions and server-side route
protection. Phase 2 delivers the public landing page. Phase 3 delivers the workspace behind
`/app`: chat on Groq with a Think mode that shows the model's reasoning, voice input,
image generation with style presets, file intelligence with cited answers, Chatbot Pro with an
embeddable widget, scheduled prompts, plugins, projects, and a settings window with
personalization, data export and sign-out-everywhere.

## Requirements

- Node.js 20 or newer (developed on 22)
- A MongoDB instance, local or hosted

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Generate a session secret with `openssl rand -base64 32` and put it in `AUTH_SECRET`.
`.env.local` is git-ignored and must never be committed.

The app starts at http://localhost:3000 on the landing page. `/login` and `/register` handle
accounts, and `/app` is the authenticated workspace: chat, search, images, library,
scheduled, plugins, projects and Chatbot Pro. A bot's widget is one script tag, served from
`/widget.js`.

## Environment variables

`.env.example` is the authoritative list. Phase 1 needs only the first four.

| Variable | Required now | Purpose |
| --- | --- | --- |
| `APP_URL` | yes | Public origin, no trailing slash |
| `AUTH_SECRET` | yes | Signs and encrypts the session cookie, 32+ characters |
| `MONGODB_URI` | yes | Connection string including the database name (Atlas SRV strings work; add `/gixxer` before the `?`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Google sign-in. Configured and wired, button disabled until `GOOGLE_SIGN_IN_ENABLED` is flipped. Register `<origin>/api/auth/callback/google` on the Google client |
| `GROQ_API` | for chat | Chat, Think mode and voice transcription (a Groq key, `gsk_…`) |
| `HUGGINGFACE_API_KEY` | for images and retrieval | Text-to-image and embeddings through Hugging Face inference providers |
| `GROQ_MODEL`, `GROQ_THINK_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_TRANSCRIBE_MODEL`, `HF_IMAGE_MODEL`, `HF_EMBEDDING_MODEL` | no | Model overrides; defaults are verified live |
| `CRON_SECRET` | no | Lets an external scheduler run due prompts through `POST /api/cron` |
| `AI_MOCK` | tests only | Replaces every provider with a local stand-in |

Every variable is read and validated server-side only, in `lib/env.ts`. No provider key is
ever exposed to the browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Route type generation, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit and database integration tests (Vitest) |
| `npm run test:e2e` | Browser tests against a production build (Playwright) |
| `npm run test:e2e:dev` | Same tests against the dev server, faster to iterate |
| `npm run check` | Typecheck, lint and unit tests |
| `npm run verify` | `check` plus the browser tests |

Tests never touch your development data. Vitest uses the `gixxer_test` database and
Playwright builds and serves the app on port 3100 against `gixxer_e2e`.

Playwright needs its browser once: `npx playwright install chromium`.

## Project layout

```
app/                       Routes only. Thin pages that call into lib/.
  page.tsx                 The public landing page
  (auth)/                  Login and register, sharing the split-screen shell
  (workspace)/app/         The workspace: chat/[id], search, images, library, scheduled, plugins, projects/[id], chatbots/[id]/[tab]
  api/auth/[...nextauth]/  Auth.js HTTP endpoints
  api/chat, files, images  Streaming chat, uploads and downloads, image generation
  api/transcribe, export   Voice transcription, the data export
  api/cron                 Runs due scheduled prompts for an external scheduler
  api/widget/[key]/        Public widget endpoints: config, chat, lead
  embed/[key]/             The framed chat page a widget opens
  widget.js/               The embeddable loader script
components/
  auth/                    Forms and auth-specific controls
  brand/                   Wordmark, loader, brand panel
  landing/                 The landing page: hero/, sections/, primitives/, nav and footer
  ui/                      Button, input, field, alert, spinner
  workspace/               Shell, sidebar, account menu, settings window, shared primitives
  chat/                    Chat view, messages, composer, attachments, thinking panel, voice input
  images/, library/        Image studio (styles, sparkles, progress ring) and the file library
  scheduled/, plugins/, projects/  Scheduled prompts, the plugin catalogue, projects
  chatbots/                Chatbot Pro dashboard tabs
  widget/                  The visitor-facing embed chat
lib/
  auth/                    Sessions, server actions, validation, hashing, rate limits
  ai/                      Provider manager, Groq, Hugging Face and mock providers
  chat/, files/, images/   Repositories, services, validation and server actions
  bots/                    Chatbot Pro: repository, ingestion, visitor answering, actions
  knowledge/               Extraction, chunking, indexing and retrieval
  plugins/                 The catalogue and what each plugin adds to a turn
  schedules/, projects/    Scheduled prompts (timing, runner) and projects
  settings/                Per-user settings, usage counts, data controls
  widget/                  The embeddable loader script
  db/                      Mongoose connection, models and GridFS storage
  landing/                 Landing page copy, kept out of the components
  motion/                  GSAP setup, reduced-motion and device-capability helpers
  security/                CSP, rate limiters, SSRF guard, request helpers
  env.ts                   Validated server environment
proxy.ts                   Route gating and per-request CSP
tests/
  unit/                    Vitest
  e2e/                     Playwright
docs/architecture/         Design notes
```

The rule the layout enforces: routes and components never talk to the database or to a
provider directly. They call a function in `lib/`, and that function owns the details.

## Design system

Glossy black `#030000` to white `#FFFFFF`, with neutral greys between them; light mode runs the
same ramp the other way. Tokens live in `app/globals.css` and are semantic, so every component
works in both themes without a `dark:` utility. On the landing page, colour outside that ramp
means "error"; it is never decoration. The workspace adds one accent blue for the reader's own
messages and the send control, the way a chat app marks "you". Three faces: Geist for everything readable, Instrument Serif italic for one
accent phrase per headline, and Exo 2 for the wordmark only.

## Architecture

- [docs/architecture/auth.md](docs/architecture/auth.md): sessions, route protection,
  password storage, brute-force protection, and the tradeoffs taken.
- [docs/architecture/landing.md](docs/architecture/landing.md): which animation library does
  what and why, the hero 3D visual and its fallbacks, reduced motion, and measured
  performance.
- [docs/architecture/workspace.md](docs/architecture/workspace.md): the tenant boundary,
  provider fallback, chat branching, the file pipeline, Chatbot Pro and the widget.
