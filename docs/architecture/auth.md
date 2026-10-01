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

**Google sign-in is rendered but disabled.** The button is in its final position so the
layout does not move later, it is a real `disabled` button with no handler, and the provider
is only constructed when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are present *and*
`GOOGLE_SIGN_IN_ENABLED` is true. Turning it on is a one-line change in
`lib/auth/features.ts` plus the two secrets.

**Password reset is not implemented.** Faking the email step would be worse than not having
it. The pieces it needs already exist: `bumpSessionVersion` to invalidate sessions on reset,
and a repository that owns all user writes.
