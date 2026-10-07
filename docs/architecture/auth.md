# Authentication architecture

Phase 1 of Gixxer.ai. Written for engineers working on this codebase.

## Layers

```
Browser (client components)
  └─ Server Actions            lib/auth/actions.ts       input parsing, user-facing messages
       └─ Auth.js              lib/auth/auth.ts          session issuing, credentials provider
            └─ Auth service    lib/auth/auth-service.ts  registration and credential checks
                 └─ Repository lib/auth/user-repository.ts  the only place that queries users
                      └─ Mongoose  lib/db/
```

Each layer only knows the one below it. A React component never imports Mongoose, and the
repository never formats a message for a person to read.

`proxy.ts` sits in front of all of this. It gates routes on the session cookie and attaches
a per-request Content Security Policy.

## Sessions

Sessions are JSON Web Tokens in an HTTP-only, SameSite=Lax cookie, issued by Auth.js and
signed with `AUTH_SECRET`. They last 30 days and are re-issued at most once a day.

The token carries two custom claims, kept short because the cookie rides on every request:

- `uid`, the user id
- `sv`, the session version

A JWT session normally cannot be revoked before it expires. `sv` fixes that. Every user
document has a `sessionVersion`, and `getSessionState()` compares the value in the token
against the value in the database on every server-side check. Incrementing
`sessionVersion` (see `bumpSessionVersion`) invalidates every outstanding session for that
user immediately, which is what a password change or a "sign out everywhere" action needs.

The cost is one indexed lookup by `_id` per protected request. `getSessionState` is wrapped
in React's `cache`, so a layout and the page inside it share a single query. The lookup also
handles a deleted account, whose token would otherwise stay valid.

`SessionState` has three values, and the difference matters:

| State | Meaning | What happens |
| --- | --- | --- |
| `anonymous` | No usable session cookie | Redirect to `/login` |
| `stale` | Cookie present, account gone or revoked | Redirect to `/session-expired` |
| `authenticated` | Cookie matches a live account | Render |

Server components cannot delete cookies, so `/session-expired` renders a client component
that submits the logout action once. That clears the cookie and lands the visitor on
`/login?reason=expired` with an explanation instead of a silent bounce.

## Route protection

Two independent checks, deliberately:

1. **The proxy** (`proxy.ts`) redirects anyone without a session cookie away from `/app*`,
   and redirects anyone with one away from `/login` and `/register`. This is a fast filter
   that only inspects the cookie. It cannot detect a revoked session.
2. **`requireUser()`** in the protected layout and page is the authoritative check. It hits
   the database and redirects unless the session is genuinely valid.

Never rely on the proxy alone for authorization. Anything that reads or writes user data
calls `requireUser()` (or `getSessionState()`) itself.

The `next` parameter used to return a visitor to where they were going runs through
`safeInternalPath()`, which accepts only same-origin paths. Absolute URLs,
protocol-relative URLs (`//evil.example`), backslash tricks and control characters all fall
back to `/app`, so the login page cannot be turned into an open redirect.

## Passwords

Hashed with scrypt from `node:crypto`: N=2^15, r=8, p=2, a 16-byte random salt and a 64-byte
key, which is roughly 32 MiB and ~100 ms of work per hash. No native build step and no extra
dependency.

The stored format is `scrypt$N$r$p$<salt>$<hash>`. Because the parameters travel with the
hash, they can be raised later without invalidating anything already stored.

Verification is constant-time (`timingSafeEqual`) and returns `false` for malformed input
rather than throwing. Passwords are normalized to Unicode NFKC first, so a precomposed `é`
and `e` plus a combining accent are treated as the same password. Input longer than 1024
characters is refused outright, so nobody can make the server spend minutes hashing.

When an email does not exist, `verifyCredentials` still runs a comparison against a
throwaway hash. Without that, the response time alone would tell an attacker which emails
are registered.

### Capacity note

Hashing is meant to be slow, and `crypto.scrypt` runs on libuv's thread pool, which holds
four threads by default. Four concurrent sign-ins will saturate it and a fifth waits. Any
deployment expecting concurrent authentication should raise `UV_THREADPOOL_SIZE` to match
the available cores (the end-to-end suite sets 16), and should watch sign-in latency as a
capacity signal rather than assuming it is free.

Registration costs two hashes: one to store the password and one when the follow-up
sign-in verifies it. That is the price of keeping a single sign-in code path, which is the
right trade while the alternative is a bespoke token provider that the HTTP endpoint could
also reach.

## Brute-force protection

Rate limiting lives in the credentials provider's `authorize` callback, not in the server
action. The sign-in form is not the only way in: `POST /api/auth/callback/credentials` is a
real endpoint, and an attacker can fetch a CSRF token and talk to it directly. Both paths
run `authorize`, so that is where the gate belongs. There is an end-to-end test that drives
the endpoint directly and asserts it gets throttled.

| Budget | Limit | Window |
| --- | --- | --- |
| Sign-in per email | 5 | 15 minutes |
| Sign-in per IP | 30 | 15 minutes |
| Registration per IP | 10 | 60 minutes |

A successful sign-in clears that email's budget, so a legitimate user who mistyped a few
times is not left locked out.

The limiter is a fixed-window counter in process memory with a bounded key table
(`lib/security/rate-limit.ts`). That is correct for a single instance and wrong for several,
because each would keep its own counts. Moving to a shared store means implementing the
`RateLimiter` interface against Redis and swapping it in `lib/auth/rate-limits.ts`. Nothing
else changes.

`AUTH_RATE_LIMIT_IP_SCALE` multiplies the per-IP budgets only, and exists because an
automated browser run sends every request from one address. Per-email limits are never
scaled. Do not set it in production.

## Admins and signing in as another account

Every user document carries a `role`, `user` or `admin`. `ADMIN_EMAILS` is a comma-separated
list that grants the admin role when a listed email signs in, through either provider, so a
fresh database still has an owner without anyone editing it by hand. The list only ever
grants; the role on the document is what every check reads, and `scripts/grant-admin.mjs`
sets or removes it directly.

An admin can open the account directory at `/app/admin`, see what an account has been doing
in counts and titles, and sign in as it for support. The directory never shows the contents
of a chat or a file: reading those means entering the account, which is recorded.

Impersonation does **not** replace the admin's session. A second cookie, `gixxer-acting-as`,
holds a ticket signed with `AUTH_SECRET` naming the admin, the account and the audit record.
`getSessionState()` re-checks it on every request and ignores it unless the admin still
exists, still holds a valid session and is still an admin, so "sign out everywhere" ends a
sitting at once. The ticket carries its own expiry and lasts at most an hour. On its own,
without the admin's session beside it, the cookie grants nothing.

While a sitting is open, `requireUser()` returns the account being acted on, which is what
every page and repository should see. `requireAdmin()` deliberately returns the *signed-in*
account and refuses while impersonating, so a sitting can never be used to start another one
or to change roles. An admin's account cannot be opened this way at all.

Each sitting is written to `impersonations` before the cookie is set, with who, whom, why,
the address and when it started, and closed when it ends. A banner naming both accounts is
shown across every page for the whole time and cannot be dismissed.

**What this does not do.** It records that an account was entered and for how long, not each
action taken inside it. And the Data controls panel still tells users their data is theirs
alone; if this feature is used on real accounts, that wording should say that administrators
can access an account for support.

## Content Security Policy

`proxy.ts` generates a fresh 128-bit nonce per request and sets the policy on both the
request and the response. Next.js reads it back and applies the nonce to its own scripts.
This is why the root layout awaits `connection()`: a nonce needs a request, so pages must
render dynamically.

`script-src` is `'self' 'nonce-…' 'strict-dynamic'`, which means an injected `<script>` tag
cannot execute. `'unsafe-eval'` is added in development only, because React uses `eval` to
rebuild server stack traces. `style-src` still allows inline styles, since React and Motion
set style attributes at runtime; that is a known and deliberate relaxation.

Static headers that do not change per request (`X-Frame-Options`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`, HSTS) are set in `next.config.ts`.

## Input validation

Zod schemas in `lib/auth/validation.ts` are shared by the browser and the server. The
browser copy gives immediate feedback; the server copy is the one that decides. Server
actions parse untrusted input with `safeParse` before anything else happens, which is also
what keeps a crafted object such as `{ "$ne": null }` from ever reaching a database query.

## Deliberate tradeoffs

**Registration reveals that an email is taken.** "An account with this email already exists"
is far better for a real user than a vague failure, and the alternative (always claiming
success, then sending mail) needs an email provider we do not have. Registration is rate
limited per IP to make bulk enumeration expensive. Revisit this if the product ever needs
to hide its user list.

**Sign-in reveals nothing.** A wrong password and an unknown email return exactly the same
message and take roughly the same time.

**Google sign-in is on.** The button is a plain form posting to the `googleSignInAction`
server action, which calls `signIn("google")` and lands on the validated `next` path. The
provider is only mounted when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are present
*and* `GOOGLE_SIGN_IN_ENABLED` (`lib/auth/features.ts`) is true; the auth pages compute
`googleAuthStatus().available` server-side and render the button disabled with a short note
when the provider is missing, so a deployment without the secrets degrades cleanly. The
provider asks Google for `select_account` so the account chooser always appears.

- The callback Auth.js answers on is `<origin>/api/auth/callback/google`. It must be
  registered on the Google OAuth client for every origin the app runs on, currently
  `http://localhost:3000` and `https://gixxer-ai.vercel.app`.
- There is no database adapter, so `lib/auth/auth.ts` maps a Google identity to a user
  document in its `jwt` callback with `upsertOAuthUser`: a verified Google email links to
  the existing account with that email (the password stays), otherwise a password-less
  account with `provider: "google"` is created. The `signIn` callback refuses unverified
  emails, which is what makes linking by email safe. The JWT then carries our user id and
  session version exactly as for a credentials login.
- The secrets are read only through `lib/env.ts`, server-side. Nothing about Google reaches
  the client bundle apart from the disabled button.

**MongoDB Atlas.** `MONGODB_URI` is an SRV string (`mongodb+srv://…/gixxer?appName=…`) and
must include the database name; `lib/env.ts` rejects one without it. `lib/db/mongoose.ts`
keeps one pool per process on `globalThis`, so development hot reloads and warm serverless
invocations reuse it, with a small pool and idle timeouts suited to serverless. Some
development machines route DNS through a local stub that refuses SRV queries; when the
driver fails that way, the module resolves the SRV and TXT records through public DNS and
connects with the equivalent standard string (`lib/db/srv.ts`). The tests never use Atlas:
unit tests run on `gixxer_test` and the browser suite on `gixxer_e2e`, both local.

**Password reset is not implemented.** Faking the email step would be worse than not having
it. The pieces it needs already exist: `bumpSessionVersion` to invalidate sessions on reset,
and a repository that owns all user writes.
