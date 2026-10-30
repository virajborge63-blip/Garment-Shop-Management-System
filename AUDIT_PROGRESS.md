# Audit Progress

Updated: 2026-10-30
Branch: `audit-fixes`

`Log-matched done` means the branch has a commit whose subject matches
`fix(F-xx): ...`. F-10 is separately recorded as already implemented after
current-code verification; its existing commit subject does not match that
pattern.

## Phase 2 - Data integrity

| Finding | Status | Commit |
|---|---|---|
| F-08 | Done - log-matched | `2669cd7` |
| F-09 | Done - log-matched | `749cf91` |
| F-02 | Done - log-matched | `b82f764` |
| F-03 | Done - log-matched | `650aed4` |
| F-05 | Done - log-matched | `ddfc5bb` |
| F-04 | Done - log-matched | `a299d88` |
| F-10 | Verified already implemented; skipped. Current tests pass; commit subject lacks the `F-10` marker. | `ed6fca8` |

## Phase 3 - Security

| Finding | Status | Commit |
|---|---|---|
| F-06 | Done - log-matched | `cee5249` |
| F-07 | Done - log-matched; TRUST_PROXY follow-up | `fedf127`, `0675d30` |
| F-11 | Done - log-matched | `e94a679` |
| F-17 | Done - log-matched | `fe8beb8` |
| F-12 | Same-origin design approved; implementation deferred by scope; no code changed | - |

## Phase 4 - Correctness and performance

| Finding | Status | Commit |
|---|---|---|
| F-13 | Done - log-matched; Asia/Kolkata business dates, no stored timestamp shifts | `ffcce56` |
| F-14 | Done - paginated employee/attendance lists, preserved complete roster and calculations; added attendance date/employee index | `3a6e2db` |
| F-15 | Done - strict session-bound audits for payroll/account changes; best-effort failures emit `AUDIT_WRITE_FAILED` | `6f10b88` |
| F-16 | Done - removed fake reset UI/API, documented manual owner reset; focused tests, type-check, and build passed | `b209ed6` |
| F-01 | Pending | - |

## Phase 5 - Low severity

| Finding | Status | Commit |
|---|---|---|
| F-18 | Done - log-matched | `0025623` |
| F-20 | Pending | - |
| F-22 | Pending | - |
| F-23 | Pending | - |
| F-19 | Pending | - |
| F-21 | Pending; proposal only | - |
| F-24 | No code action; remind owner to rotate credentials if `.env` was shared | - |

## Remaining finding details and acceptance criteria

These descriptions preserve the remaining backlog so work can continue without
the original audit conversation. Follow the finding order above, subject to the
safety notes below.

### F-16 - Forgot-password control is not a reset workflow

- Severity/area/location: Medium; C, D; `authRoutes.ts` forgot-password route.
- Problem/evidence: The route is not a reset workflow: it creates no token,
  sends no message, and permits no password reset. Its response says the system
  does not send reset emails.
- Decision: Remove the misleading control; do not build an email reset flow.
- Acceptance:
  1. Re-verify the frontend forgot-password link/form and the backend route.
  2. Replace the frontend link with the plain text
     “Contact the owner to reset your password.” The frontend must send no
     request to the forgot-password endpoint.
  3. Remove the backend route if unused; otherwise retain it with the same
     generic response for every input and no account-existence disclosure.
  4. Check whether an owner/admin can reset another user’s password in the
     current admin UI. Report yes/no; do not build a reset feature. If missing,
     report that to the owner.
  5. Add a short README manual-reset note only if the existing owner/admin
     workflow exists.
  6. Test that the login page shows the contact-owner text and the former
     endpoint no longer accepts/sends reset requests.
  7. Commit separately with subject `fix(F-16): ...`.

### F-01 - Production database connection is unavailable

- Severity/area/location: High; K; `db.ts` connection initialization.
- Problem/evidence: Render logs show a `MongooseServerSelectionError` and
  “MongoDB connection failed”; database-backed operations require a reachable
  configured MongoDB endpoint.
- Suggested hosting checks: Owner must review Render `MONGODB_URI`, Atlas
  availability, credentials/encoding, and Atlas network access, then verify
  `/api/health`. Do not contact Render or Atlas from this work.
- Code-only acceptance:
  1. Re-verify and extend the existing `/api/health`; do not add a duplicate.
  2. No-auth health response is exactly
     `{"status":"ok","database":"connected"}` with HTTP 200 when Mongoose is
     connected, and
     `{"status":"degraded","database":"disconnected"}` with HTTP 503 otherwise.
     Never return URI, host, username, error text, or stack.
  3. Connection-failure logs contain only error name and sanitized message;
     redact any `mongodb://` or `mongodb+srv://` URI credentials.
  4. Preserve connection retry behavior and port binding.
  5. Test connected/disconnected health responses and verify a logged failure
     using a fake URI/password does not expose credentials.
  6. Commit separately with subject `fix(F-01): ...`.
  7. Production remains unreachable until the owner fixes `MONGODB_URI` or
     Atlas network access.

### F-20 - “Remember me” does not affect token persistence

- Severity/area/location: Low; J; `LoginPage.tsx`.
- Problem: Checkbox state is only reflected visually; the token always uses
  `localStorage`.
- Fix/acceptance: Store the token in `sessionStorage` when unchecked and
  `localStorage` when checked. Logout and auth restoration on page load must
  check/remove both stores. Verify the login behavior and commit separately
  with subject `fix(F-20): ...`.

### F-22 - Clean script is not portable to Windows

- Severity/area/location: Low; H; `package.json` clean script.
- Problem: It uses `rm -rf`, which is not portable to Windows shells.
- Fix/acceptance: Use `rimraf` or a small Node script; verify the clean command
  on Windows-compatible paths without deleting outside intended build outputs.
  Never use broad/root deletion. Commit separately with subject
  `fix(F-22): ...`.

### F-23 - Deployment documentation is stale

- Severity/area/location: Low; L; `README.md` deployment documentation.
- Problem: Documentation says the server exits when MongoDB is unavailable,
  while the current server binds first and retries initialization.
- Fix/acceptance: Describe connection retries, `/api/health`, and its HTTP 503
  degraded response. Commit separately with subject `fix(F-23): ...`.

### F-19 - Low-severity dependency advisories

- Severity/area/location: Low; H; `package-lock.json` Workbox/Vite PWA chain.
- Problem/evidence: `npm audit --omit=dev` was reported to show four low
  `deepmerge` prototype-pollution advisories.
- Fix/acceptance: Check for a compatible override or upstream update. Never use
  `--force` or a breaking forced downgrade. If no safe option exists, document
  the evidence and leave dependencies unchanged. Commit any safe fix separately
  with subject `fix(F-19): ...`.

### F-21 - Oversized source files

- Severity/area/location: Low; E; `adminRoutes.ts` (~1,255 lines) and
  `AttendanceManagement.tsx` (~1,468 lines) in the original audit.
- Fix/acceptance: Proposal/split plan only in this run. Do not refactor.

### F-24 - Local environment file may have been shared

- Severity/area/location: Low; D; `.env` values.
- Audit finding: `.env` was reported as gitignored and untracked, with no
  repository exposure found. No code change.
- Action: Remind the owner to rotate `MONGODB_URI` and `SESSION_SECRET` if the
  file was ever shared. Never inspect or expose `.env` contents.

## Log-matched completed findings

F-18, F-08, F-09, F-02, F-03, F-05, and F-04.

## Safety and execution notes

- Never read `.env`, expose secrets, or connect to production MongoDB.
- Use only local/in-memory MongoDB for tests; use `MongoMemoryReplSet` for transaction tests.
- Do not perform destructive data changes or rewrites; data correction scripts must be read-only dry runs.
- Keep each finding's fix in its own `fix(F-xx): ...` commit and update this file after each commit.
- Stop at each phase boundary and wait for the user's `continue`.
- Payroll reversal remains a proposal only; do not implement without approval.

## Phase 3 proposal notes

- F-12: Production UI/API are the same Render origin and have no external API clients. Approved direction is an HttpOnly, host-only session cookie (`Secure` in production, `SameSite=Lax`, seven-day expiry), session-bound CSRF token plus Origin validation, and CSP report-only before enforcement. Implementation remains deferred; do not change cookies, CORS, CSP, or token storage without a later explicit request.
- F-17 migration: Use the aggregate read-only report against a reviewed non-production copy. Keep legacy verification while successful logins opportunistically upgrade hashes to scrypt; monitor the legacy count to zero, then arrange owner-controlled resets for remaining accounts that never log in. Do not bulk-convert hashes without plaintext passwords or remove legacy verification before the inventory is zero and the owner approves.
- Deployment: Code reads `TRUST_PROXY`; set `TRUST_PROXY=1` in the Render service environment for its single trusted proxy hop. This repository change does not alter `.env` or configure the hosted Render dashboard.
