# Trip Lah! V1.0 — Stage A.5 Preview & Acceptance

Branch: `trip-lah-v1.0-stage-a`
PR: #1 (Draft)

## Product decision
- Default landing screen: **All Trips**.
- On every fresh page load, the app opens the All Trips manager first.
- Selecting a trip opens that trip's existing dashboard.
- The All Trips manager provides create, switch, edit, archive/restore, member and currency entry points.

## Implemented for Stage A.5
- [x] Set All Trips as the default landing screen.
- [x] Preserve the existing trip dashboard after a trip is selected.
- [x] Keep the feature isolated on the Stage A branch; do not merge to `main`.
- [x] Keep the production Pages deployment untouched.

## Automated checks performed
- [x] Main app JavaScript syntax parse.
- [x] Service worker syntax parse.
- [x] Static HTML IDs referenced by app code are present (dynamic form fields excluded).
- [x] Legacy single-trip payload normalizes into a one-trip workspace.
- [x] Two-trip workspace restores the selected trip and its own member/currency metadata.

## Manual acceptance checklist — still required
- [ ] Desktop: first load shows All Trips.
- [ ] Desktop: create two trips and switch between them.
- [ ] Desktop: each trip retains separate dates, members, currencies and records after refresh.
- [ ] iPad Safari: layout, modal controls, scrolling and keyboard input.
- [ ] iPhone Safari: layout, modal controls, scrolling and keyboard input.
- [ ] Offline: load once online, disconnect, reopen and verify local data.
- [ ] Cloud Sync: sign in and verify the workspace payload syncs without changing the existing cloud schema or conflict logic.
- [ ] Backup: export, import and recovery restore with multiple trips.
- [ ] Verify install prompt and service-worker update on HTTPS deployment.

## Preview/deployment note
The branch is not deployed. Do not change the repository's production GitHub Pages source to this feature branch. A separate preview host or isolated preview deployment must be configured before device acceptance. The existing production site and database remain untouched.

## Release gate
Do not mark PR #1 ready for review or merge until the manual acceptance checklist passes and the additive relational migration has been separately reviewed.
