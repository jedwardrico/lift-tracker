# Claude Code Behavior Rules

## Subscription & 5-Hour Quota Constraints

- **Mandatory Usage Check**: You MUST run the `/usage` or `/context` command before starting a heavy multi-file refactor task to verify session health.
- **Quota Warnings**: If you detect that our chat history is nearing the auto-compact threshold, or if a single file read is going to ingest more than 30,000 tokens, you **MUST print a bold warning** to the terminal instructing the user to type `/compact` or `/clear` before proceeding.
- **Efficiency Rule**: Provide incredibly concise code fixes. Never output conversational pleasantries, essay-long architecture summaries, or line-by-line file readouts unless explicitly asked.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
lift-tracker/   # React Native (Expo) frontend
server/         # Express.js + SQLite backend
```

A workout tracker that runs hypertrophy programs (Gamma Bomb, Creeping Death II, Pure Bodybuilding Phase 2) and logs sets as the user goes. Multiple programs coexist — switching or restarting a program never deletes history, and a switch/restart is staged for the following Monday so the in-progress week isn't disrupted.

## Commands

### Server (`server/`)

```bash
npm install
npm run seed          # creates and populates the SQLite database (run once before first start)
npm start              # production
npm run dev            # auto-restart on file changes
npm run lint           # eslint src/
npm run format:check   # prettier --check src/
```

API runs on `http://localhost:3000`. There is no test suite for the server.

### App (`lift-tracker/`)

```bash
npm install
npm start           # Expo dev tools — scan QR to run on device
npm run ios         # run on iOS simulator
npm run android     # run on Android emulator
npm run web         # run in browser
npm run lint           # eslint .
npm run format:check   # prettier --check .
```

The app uses `expo-dev-client`, so `expo run:ios` / `expo run:android` must be run at least once to build the native shell before `npm start` will work. There is no test suite for the app.

Point the app at a non-default API host with `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3000`).

### Docker (from repo root)

```bash
docker compose up --build
```

The database seeds automatically on first boot into the named volume `db_data`. **Always run the container with `db_data` explicitly mounted.** The image declares `/app/db` as a `VOLUME`, so starting it without an explicit mount still works but Docker silently backs it with a fresh anonymous volume — an updater that recreates the container on every deploy (e.g. Watchtower on every merge to `main`) will then reset the database to defaults on every deploy.

### Pre-commit

A husky pre-commit hook runs `npm run lint && npm run format:check` inside `lift-tracker/` only — the server isn't checked at commit time (CI lints both, via `.github/workflows/lint.yml`).

## Architecture

### Server (`server/`)

- `src/index.js` — Express app wiring; routes mounted at `/weeks`, `/exercises`, `/logs`, `/program`.
- `src/db.js` — Owns the single `better-sqlite3` connection (`getDb()`). On first call it runs `db/schema.sql`, then applies a series of ad-hoc, idempotent migrations directly in code (column additions, table rebuilds) guarded by `PRAGMA table_info` checks — there is no migration framework or migration files directory. When changing the schema, add a new guarded migration here rather than editing `schema.sql` in a way that breaks existing databases.
- `src/seed_program.js` / `src/seed.js` — Load program definitions from `server/data/*.json` into the database. `seedAllPrograms` runs on every `getDb()` init so new/updated program JSON gets picked up without wiping existing history.
- `src/program_state.js` — The staged program switch/restart/completion logic: `effectiveMonday()` computes when a pending change takes effect, `isProgramComplete()` scopes "did they finish the last workout" to the current cycle via `cycle_started_at` so a same-day restart doesn't immediately complete against the previous cycle's log.
- `src/workout_data.js` — Static program metadata shared across modules (program keys, day ordering).
- `src/routes/*.js` — One file per resource (`weeks`, `exercises`, `logs`, `program`); route handlers talk to `better-sqlite3` directly with prepared statements, no ORM/query-builder layer.

Key domain concepts:

- **Program vs. week vs. day vs. exercise**: a program has many weeks, a week has many days (some `is_rest_day`), a day has many exercise slots. Exactly one program is "active"; switching stages a pending change rather than applying it immediately.
- **Exercise swaps carry forward**: `GET /weeks/:n` and `GET /weeks/:n/days/:day` annotate an exercise with `carried_exercise` when an earlier week logged a swap (`swapped_exercise_id`) at the same day/slot — the substitution persists until swapped again, not just for the week it was logged.
- **Exercise identity across weeks**: a program's exercise rows are per-week (a new `exercise_id` each week for "the same lift"), so matching "the same exercise last time" across weeks is done by `exercise_name`, not `exercise_id` (see `findPrevLog` in the app).

### App (`lift-tracker/`)

Expo Router file-based routing under `app/`. There is no shared component library or design-system layer — each top-level screen (`workout.js`, `(tabs)/index.js`, `(tabs)/history.js`, `(tabs)/settings.js`, `exercise/[name].js`, `session/[date].js`) is a large, mostly self-contained file that defines its own `COLORS` palette, `StyleSheet`, and data fetching inline. When editing one screen, check whether the same constant/logic (e.g. `COLORS`, date formatting, `BASE_URL`) is duplicated in sibling screens rather than assuming it's shared.

- `BASE_URL` (`process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`) is read independently in each screen that calls the API — there is no shared API client module.
- `workout.js` persists the in-progress workout to `AsyncStorage` (`WORKOUT_STORAGE_KEY = 'workout_in_progress'`) so an in-progress session survives app restarts/backgrounding; it reconciles against server state (e.g. `AppState` listener) rather than trusting local storage alone. Be careful with stale local state vs. fresh server data here — this has been the source of real bugs (see recent commit `b4ad4af`, workout totals starting non-zero from stale in-progress data).
- The display week runs Sunday–Saturday while server-side days are stored Monday–Sunday (`day_of_week`); `(tabs)/index.js` maps between the two via `API_DAYS`/`serverDayIdx()`-style helpers — watch for this off-by-mapping when touching week/day display logic.
- Server day/week/program shapes returned by the API (see `README.md` "Endpoints" and "Exercise fields" sections) are the source of truth for what fields exist; there are no shared TypeScript types between server and app (plain JS throughout, no TypeScript).

## Conventions

- No test suites in either package — verify server changes by running the server and hitting endpoints (`npm run seed` then `npm run dev`), and verify app changes by running the app against the local server.
- Both packages share the same lint/format setup: `@eslint/js` recommended + `eslint-config-prettier`, checked via `npm run lint` and `npm run format:check`. Run both before considering a change done, since CI enforces them on every PR.
