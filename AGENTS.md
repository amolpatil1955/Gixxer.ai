<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Gixxer.ai project conventions

Read `README.md` for setup and `docs/architecture/auth.md` before touching authentication.

- Build in phases. Phases 1 (auth), 2 (landing page) and 3 (AI workspace) are done, including
  Scheduled, Plugins and Projects (built September 2026 at the owner's request). Do not start a
  further phase without being asked.
- Read `docs/architecture/workspace.md` before touching chat, files, images, bots or the widget.
- Every repository function takes the owner id and puts it in the query. Never add a read
  path that skips it.
- Models talk to the app only through `lib/ai/manager.ts`. Text, reasoning and voice run on
  Groq; images and embeddings on Hugging Face. Gemini was removed and must not come back
  unless the owner asks. Tests run with `AI_MOCK=1`.
- Mongoose document types are explicit interfaces (`new Schema<T>`), never `InferSchemaType`:
  inferring the workspace schemas ran the TypeScript checker out of memory.
- Never gate above-the-fold content behind a JavaScript animation: it delays Largest
  Contentful Paint. Use the CSS `animate-rise` entrance there, Motion below the fold.
- Anything whose rendered markup depends on a device preference reads it through
  `useSyncExternalStore` (see `lib/motion/use-prefers-reduced-motion.ts`), never a direct
  media-query read, which breaks hydration.
- Routes and components never query the database or call a provider. They call `lib/`.
- Secrets are read only through `lib/env.ts`, server-side. Never reference `process.env`
  for a secret in a client component, and never commit `.env.local`.
- Authorization is enforced server-side with `requireUser()`. `proxy.ts` is a fast filter,
  never the only check.
- Validate untrusted input with the zod schemas in `lib/auth/validation.ts` before use.
- User-facing errors stay generic. Details go to the server log.
- Before calling anything done: `npm run check`, then `npm run test:e2e`.
