# Trip Lah! V1.0 — Stage A implementation status

Branch: `trip-lah-v1.0-stage-a`

## Delivered in this branch
- [x] A01 Multi-trip registry and trip switcher.
- [x] Create, edit, archive and restore individual trips.
- [x] Each trip stores its own snapshot of existing Travel Lah sections.
- [x] A02 Trip profile: name, destination, dates, base currency and budget.
- [x] A03 Traveller management: add, rename and remove non-owner members; owner is fixed as the account manager.
- [x] A04 Per-trip enabled currencies and one selected base currency.
- [x] Local-first persistence through the existing versioned localStorage record.
- [x] Workspace metadata is included in the existing user-level Cloud Sync payload; the old sync table and revision conflict logic are not modified.
- [x] Existing single-trip payloads and backups are normalized into a one-trip workspace on load/import.
- [x] Updated PWA identity and service-worker cache namespace to Trip Lah! V1.0.

## Important compatibility decisions
- The current app's existing travel sections (plans, tickets, stay, packing, places, expenses and go-home checklist) are stored in a per-trip snapshot.
- The existing `travel_lah_sync` table remains untouched. It still stores one JSON payload per authenticated owner, now containing the workspace and all trips.
- No shared traveller login or collaborative editing is introduced in Stage A.
- Legacy expense records are historically MYR-based. The UI blocks changing a trip's base currency once such records exist, avoiding accidental relabelling. New multi-currency expense and fund accounting is Stage B.
- The new relational schema is committed as a migration candidate but has not been applied to production.

## Pending before Stage A can be marked PASS
- [ ] Browser smoke test: create two trips, switch repeatedly, reload, and confirm no cross-trip data leakage.
- [ ] Test add/edit/remove members and base currency configuration.
- [ ] Test offline reload and local persistence.
- [ ] Test existing cloud account sync on iPhone, iPad and desktop.
- [ ] Test legacy backup import/export and restore.
- [ ] Confirm service-worker update from the deployed preview.
- [ ] Only after preview PASS, decide whether to apply the additive SQL migration and merge to main.

## Current status
Implementation committed to the feature branch. Browser/device acceptance testing is still required. Production main branch and production database have not been changed.
