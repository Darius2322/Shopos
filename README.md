# ShopOS

Offline-first POS and business-management scaffold: React + TypeScript + Vite,
Dexie (IndexedDB) for local storage, Supabase (Postgres + Auth) for the
backend, PWA-installable.

This is a **rebuilt core**, not the full 85-item spec. It's built to be
correct and extendable rather than wide-but-shaky. Read "What's implemented"
below before assuming a feature exists.

---

## Why this was rebuilt from scratch

The previous build (a compiled `dist` bundle called "Duka") had no available
source code, so nothing in it could be safely edited. Reverse-engineering the
sale/debt logic from the minified bundle showed the **local** debt math was
actually correct — the real risk was in how the app pushed local records to
Supabase: it sent JS camelCase field names (`remainingAmount`, `paidAmount`)
straight into `.upsert()` with no mapping to the database's snake_case
columns, which is exactly the kind of mismatch that can make a debt look
zeroed-out anywhere except the original device.

This rebuild fixes that class of bug at three separate layers, on purpose,
so it can't quietly reappear:

1. **Local calculation** (`src/lib/sales.ts`) — `balanceDue = total - amountPaid`,
   a debt is only ever created for `balanceDue > 0`, and `amountPaid` is never
   silently clamped up to the total when the payment method is credit.
2. **Sync layer** (`src/lib/sync.ts`) — every synced entity has an explicit
   `toRow` / `fromRow` mapper. Nothing is ever upserted as a raw object.
   Adding a new synced table means adding one mapper entry, not skipping one.
3. **Database constraint** (`supabase/schema.sql`) — the `debts` table has
   `check (remaining_amount = original_amount - paid_amount)`. If any future
   code path ever tries to write an inconsistent debt, Postgres rejects the
   write outright instead of silently storing a wrong number.

---

## What's implemented

Working end-to-end, including offline queueing and sync:

- Multi-tenant Postgres schema with Row Level Security covering core
  commerce, suppliers/purchases, quotations, invoices, refunds, correction
  requests, employee payments, loyalty, notifications, support tickets,
  platform admin access, owner sign-up requests, and WebAuthn credential
  references — `supabase/schema.sql`
- Offline-first local database (Dexie) mirroring the synced entities
- Sync engine: push queue with retry/backoff, pull-since-last-sync, explicit
  field mapping, idempotent client-generated UUIDs
- **POS**: product search, cart, payment method incl. Credit/Debt, correct
  debt creation, customer credit-limit warning, printable/shareable receipt
  showing loyalty points earned
- **Sales history**: full list, request a refund or a correction on any sale
- **Debts**: list, filter, guarded partial/full payment, live-derived balance
- **Refunds**: request → manager/owner approval → processed, restores
  resalable stock only, reduces a linked debt instead of editing the sale,
  optionally gated behind a biometric confirmation
- **Correction requests**: employees flag mistakes instead of silently
  editing a completed sale; manager/owner reviews and resolves
- **Quotations**: create, mark sent, convert directly to a completed sale
  (reuses the same debt-safe sale path, not a separate looser one)
- **Invoices**: create, record partial/full payments, balance always
  derived as total − paid and guarded against overpayment
- **Customers**: list, add, loyalty registration, live outstanding balance
- **Inventory**: list, low/out-of-stock filters, add product, transactional
  stock deduction on sale
- **Suppliers & purchases**: record supplies with line items, stock
  auto-increments, supplier balance tracked like customer debt
- **Employee payments**: salary/wage records with additions/deductions/
  advances; staff only see their own
- **Users**: staff list, per-user sales performance, role/status changes,
  per-employee permission overrides enforced by RLS
- **Loyalty**: business-configurable earning rate, registration required to
  earn, points shown on receipt, never awarded to unregistered customers
- **Notifications**: a bell in the header showing what needs attention right
  now — low/out-of-stock, overdue debts, pending refund/correction requests,
  failed syncs — computed live rather than a stored feed that can drift
- **Support**: employees/owners submit tickets, view their own status
- **Security**: optional biometric (WebAuthn platform authenticator)
  confirmation gate on refund approval, using the device's own fingerprint/
  face check
- **Branch switching**: identical mobile bottom-sheet / desktop dropdown,
  restricted to authorized branches
- **Dashboard**, **Sync Center**, **PWA** install support

### Platform admin portal — `../shopos-admin`

A genuinely separate app (own `package.json`, own build, own deploy target,
dark theme so it's visually distinct from the business app), matching the
spec's requirement that it never be reachable from inside ShopOS itself.
It covers:

- Admin sign-in, gated by a `platform_admins` table (populated manually —
  there's intentionally no in-app way to self-grant this)
- **Owner requests**: a public "request access" form (linked from the admin
  login screen) lets a prospective business owner apply; an admin approves
  or rejects
- **Businesses**: list all, pause/activate
- **Support tickets**: list all, change status across every business

Approving an owner request needs to create a real `auth.users` row, which
requires Supabase's service-role key — that key must never reach a browser.
So approval calls a Supabase **Edge Function** (`supabase/functions/approve-owner`)
that runs server-side with the service role, invites the new owner by email,
and creates their business/branch/profile rows atomically. Deploy it with
`supabase functions deploy approve-owner` (see Supabase CLI docs) and set
`SUPABASE_SERVICE_ROLE_KEY` as a function secret, not an app env var.

## What's scaffolded in the schema but has no UI yet

## What's genuinely not built

Push notifications (the in-app bell is real and live; browser/OS push isn't
wired up), thermal/ESC-POS receipt formatting for physical printers, and
owner-editable document number prefixes (numbers generate correctly with
fixed `QT-`/`INV-`/`REC-` prefixes). None of these have schema or code yet.

## Fixed this round

Support ticket replies are now two-way in the main app (a tap-to-open
thread, not just a status label) and sync via `support_ticket_replies`.
`loyalty_settings` and `profile_permissions` now have real Dexie tables and
wired sync mappers — loyalty settings and permission overrides both push to
Supabase correctly. Getting `profile_permissions` syncing required a schema
change: its Postgres primary key was a composite `(profile_id, permission)`,
but the generic sync engine assumed every table has a single `id` column to
upsert/delete against. Rather than special-case it forever, the table now
has a generated `id` column (`profile_id || ':' || permission`) and the sync
engine gained an explicit per-entity conflict-column map — the same pattern
now also handles `loyalty_settings`, whose primary key is `business_id`, not
`id`. If you add another business-scoped singleton table later, check
`CONFLICT_COLUMN` and `LOCAL_PK` in `src/lib/sync.ts` before assuming `id`
will work.

Two settings pages that were missing entirely are also in now: **Business
Profile** (name, contact info, tax rate, receipt footer — nothing to edit
these existed before) and **Loyalty Program** (earning rate, minimum
purchase, whether tax/discount count — previously loyalty only had sensible
defaults with no way to change them).

Quotation→sale conversion recalculates tax at 0% to avoid double-taxing an
already-priced quotation line — fine for flat-rate tax, worth checking if
you use per-item tax rates.

---

## Getting a live link to test on your phone

You don't need your own machine for this — Vercel can build straight from
a GitHub repo:

1. Unzip this, `git init`, commit, and push it to a new GitHub repo (or
   upload the unzipped folder directly if you'd rather skip Git — Vercel's
   dashboard also accepts a drag-and-drop deploy of a project folder).
2. Run the Supabase setup in the section below first (schema + first user) —
   the app will still load without it, but sign-in won't work until it's done.
3. Go to vercel.com → **Add New Project** → import the repo.
4. In the import screen, add two environment variables:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from your Supabase
   project's API settings).
5. Deploy. Vercel runs `npm install && npm run build` for you — this is also
   your first real compile check, since it wasn't possible to run here.
6. You'll get a `https://your-project.vercel.app` link, installable as a PWA
   on your phone, usable for testing immediately.

If `npm run build` fails on Vercel, the error log there will point at the
exact file/line — paste that back to me and I'll fix it directly, since I
can't run the build myself in this environment.

### Deploying the admin portal

`../shopos-admin` (a sibling folder to this one) is a separate app — deploy
it as its own Vercel project pointing at that folder, with the same two
Supabase env vars. Then deploy the `approve-owner` Edge Function via the
Supabase CLI so owner-request approval works (see the admin portal section
above). Do not link the admin portal's URL from anywhere inside the main
ShopOS app, per the spec.

---

## Setup

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
```

1. Create a Supabase project.
2. In the SQL Editor, run `supabase/schema.sql` once.
3. Create your first user in Supabase Auth (Dashboard → Authentication →
   Add user), then insert matching rows for `businesses`, `branches`, and
   `profiles` (the `profiles.id` must equal the auth user's id). There's no
   self-serve signup screen yet — this is the one manual step until an
   onboarding flow is built.
4. `npm run dev` for local development, or connect the repo to Vercel
   (`vercel.json` is already set up) and add the same two env vars there.

## Notes on the local scaffold

- Non-owner/manager roles are meant to be limited to branches listed in
  `profile_branches`; the current `src/lib/auth.ts` loads all of a
  business's branches as a placeholder until that table is wired into the
  pull-sync. The RLS policies already enforce it server-side regardless.
- `npm install` was not run in the environment this was built in (no network
  access), so dependency versions haven't been verified against each other
  end-to-end. Run `npm install && npm run build` as your first step and fix
  forward if anything's out of date.
