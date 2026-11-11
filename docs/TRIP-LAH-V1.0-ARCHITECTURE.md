# Trip Lah! V1.0 — Final Architecture & Stage A Plan

## Product decisions
- One owner/admin manages each trip in V1.0.
- Other travellers are member records only; no accounts or direct access yet.
- Multiple trips are supported. Every record belongs to exactly one trip.
- Shared-fund expenses reduce the fund balance and are not charged again to members.
- Personal payments may be split equally, assigned to selected members, by percentage, or by exact custom amounts.
- Multi-currency trips preserve original amounts and a locked conversion snapshot into the trip's base currency.
- Local-first UX with the existing Supabase Auth and revision/conflict-aware cloud sync retained.

## Existing application baseline
- Repository: moriandchen/forest-studio-travel-lah-pages
- Existing production branch: main
- Existing app is Travel Lah! V1.2 (README says V1.2), single-trip local-first PWA.
- Existing Supabase project: forest-studio-desk-lah (project ref kxehariqixdqmtyeezrb).
- Existing legacy table: public.travel_lah_sync (one JSONB payload per auth user, revision guarded).
- Existing local data model has one `trip` object plus `plans`, `tickets`, `packing`, and `expenses`.
- Do not alter or delete `travel_lah_sync` or its existing policies in Stage A.

## Relational model
1. `trip_lah_trips`: one row per trip, owner, dates, destination, base currency, budget and status.
2. `trip_lah_members`: non-auth traveller profiles scoped to a trip; the owner is also represented as a member.
3. `trip_lah_currencies`: currencies enabled for a trip and their minor-unit precision; exactly one base currency.
4. `trip_lah_exchange_rates`: dated conversion rates. Each expense stores its own locked rate snapshot.
5. `trip_lah_funds`: named shared or personal funds, each in one currency.
6. `trip_lah_fund_transactions`: append-only contributions, expenses, refunds and adjustments. A fund balance is opening balance plus inflows minus outflows; do not calculate personal debt from fund-paid expenses.
7. `trip_lah_expenses`: actual expenses, payer source, original currency amount, base-currency amount and rate snapshot.
8. `trip_lah_expense_splits`: each member's exact share for personal-paid expenses. The sum of share_minor must equal expense.amount_minor; implement writes atomically in a database RPC in Stage B.
9. `trip_lah_bookings`: flight, hotel, ticket and reservation metadata. Link a booking to its payment expense to avoid duplicate money records.
10. `trip_lah_itinerary_items`: date/time ordered itinerary entries, optionally linked to a booking.
11. `trip_lah_settlements`: who paid whom, amount, currency and settlement status.
12. `trip_lah_audit_logs`: immutable audit events for inserts, updates and deletes on trip, member, fund, expense, booking, itinerary and settlement records. Clients can read only their own trip logs; trigger-only writes prevent client edits.

## Financial invariants
- Money is stored as integer minor units, never binary floating point.
- Original currency amount is immutable history; base amount and exchange_rate_snapshot are stored at expense creation.
- A fund-paid expense must have payer_type='fund', a fund_id, no paid_by_member_id and split_mode='fund'.
- A personally-paid expense must have payer_type='personal', a paid_by_member_id, no fund_id and a personal split mode.
- Fund transactions are append-only. Correct errors with refund/adjustment entries.
- A fund contribution is not an expense. A fund expense is not an individual member's personal advance.
- Personal balances are derived from personal payments minus personal expense shares and recorded settlements.
- Shared-fund spending never creates a second member liability.
- Expense split rows must be saved atomically with their expense and validated so the shares add up exactly to the expense amount.
- Deleting a booking must not delete its expense; deleting an expense unlinks its booking rather than deleting the booking.

## Access and security
- All Trip Lah tables are in public schema with RLS enabled.
- V1.0 policies restrict every row to owner_id = auth.uid().
- Traveller records are not Supabase Auth users.
- Never place service-role or secret keys in the PWA.
- The existing publishable key is public-client safe only because access is controlled by RLS.
- Future multi-user collaboration needs a separate trip-membership authorization model and policy review; do not simply relax current owner policies.

## Stage A scope — Foundation
- Multi-trip list, create, edit, archive and select active trip.
- Trip profile: name, destination, dates, base currency and budget.
- Trip member CRUD, including owner member record.
- Per-trip currency setup with base-currency validation.
- Local-first persistence and sync integration without replacing the existing legacy sync flow until compatibility is proven.
- One-time, user-confirmed importer for the existing single-trip Travel Lah! payload; no automatic destructive migration.
- Empty-state dashboard for each newly created trip.
- Backup/export must include all trips and members.

## Deferred
- Stage B: funds, contributions, expense ledger, splits, settlements and atomic save RPC.
- Stage C: bookings and itinerary.
- Stage D: reports, exports and polish.
- Multi-user editing is later than V1.0.

## Stage A acceptance tests
1. Create at least two trips and switch between them without data leakage.
2. Edit/archive one trip without changing another.
3. Add, reorder, rename and remove non-owner traveller records.
4. Exactly one base currency per trip; changing base currency requires explicit confirmation and must not rewrite historical expenses.
5. Local edits survive reload and offline use.
6. Cloud sync on iPhone/iPad/desktop preserves all trips and member records.
7. Conflict resolution never silently overwrites newer cloud data.
8. Legacy Travel Lah backup export/import remains functional.
9. Importing the legacy single trip is opt-in, idempotent and preserves source backup.
