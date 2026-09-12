# Roadmap — Future Improvements & Infrastructure Options

This tool was built under hard constraints: zero recurring cost, a
non-technical maintainer, and a single receptionist as the only user. Those
constraints produced deliberate trade-offs. This document is the upgrade path:
what to improve next while staying on the current stack, and what a more
robust infrastructure looks like if the constraints ever relax.

## Phase 1 — same stack, quick wins

These keep the zero-cost, no-build architecture and are all implementable in
vanilla JS + Apps Script:

- **Overlap / double-booking detection.** Add a `doGet` to `Code.gs` that
  returns the booked date ranges; before submit, the form warns if the chosen
  dates overlap an existing booking. This is the single highest-value
  addition — it turns the Sheet from a passive record into an active guard.
- **Calendar view of bookings.** A second page fetching the same `doGet`
  data, rendered as a simple month grid, so the receptionist can see
  occupancy at a glance instead of scanning rows.
- **Duplicate-submit guard.** Currently the button disables during save, but
  a refresh-and-resubmit still creates a duplicate row. A client-generated
  UUID column (checked server-side before append) closes this.
- **PWA / offline resilience.** A manifest + service worker would let the
  form load on a flaky connection and queue the submit until back online —
  relevant for a property in a low-connectivity area.
- **Sheet-driven configuration.** Move package types and message templates
  into a `Config` tab read at page load, so wording changes need no redeploy.

## Phase 2 — same stack, security hardening

- **Shared-secret header.** Have the Apps Script require a token header
  (stored in the Apps Script project's Script Properties, injected into the
  page at deploy time). Cheap, and removes the "URL is the password" exposure.
- **Basic access control.** A single shared passphrase gate on the site if
  more staff start using it — not real auth, but raises the bar from "anyone
  with the link".
- **Rate limiting / input caps.** `doPost` should cap field lengths and
  reject implausible headcounts; today it trusts the client-side validation.

## Phase 3 — when to graduate off Apps Script

Signals it's time: multiple properties or staff roles, real reporting needs,
automated (unattended) WhatsApp sending, or the Sheet growing past a few
thousand rows where append-and-count ID generation gets slow.

Options, roughly in order of fit for this product:

| Option | What you get | Trade-off |
|---|---|---|
| **Supabase** (Postgres + Auth + RLS) | Real schema, row-level security, proper auth (email or magic link), REST auto-generated from the DB, free tier comfortably covers this scale | Needs a build step or module imports; migrations and SQL schema to maintain |
| **Firebase / Firestore** | Realtime data (calendar updates live), phone-auth friendly, generous free tier | Vendor lock-in; NoSQL modeling for what is naturally relational data |
| **Cloudflare Workers + D1** | Edge-deployed API + SQLite, free tier, keeps the "tiny backend" feel | More assembly required (no auto API; you write the routes) |
| **Keep Sheets, add a Worker proxy** | Sheet stays the record; a Worker in front of the Apps Script hides the URL, adds the shared secret, and rate-limits | Least migration; still inherits Sheets' limits |

**Recommended path when the time comes:** Supabase. The data is relational,
row-level security replaces the URL-as-password model properly, and the
static frontend survives almost unchanged — only the `fetch()` target and the
config block move.

## Messaging: beyond wa.me

Click-to-chat links are free but human-driven (the receptionist presses send
in WhatsApp). Automating confirmations means the **WhatsApp Cloud API** (Meta):
template messages can be sent server-side on booking. Costs per conversation
are small but nonzero, templates need Meta approval, and a business account is
required — worth it only if booking volume grows to the point that the manual
send step is a real bottleneck. A middle ground: keep wa.me, but move the
owner notification to email (Apps Script can send via MailApp for free).

## Explicitly out of scope (for now)

Online payments, public-facing booking (guests self-serving), multi-property
support, native mobile app. Each would change the product's nature rather
than improve it — the current tool's value is that it does one thing with
nothing to maintain.
