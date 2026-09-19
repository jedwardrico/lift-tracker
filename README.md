# Lift Tracker

A workout tracker that runs hypertrophy programs and logs your sets as you go. Multiple programs are supported and can be switched between without losing history — Gamma Bomb, Creeping Death II (John Meadows), and Pure Bodybuilding Phase 2 ship out of the box.

## Project Structure

```
app/      # React Native (Expo) frontend
server/   # Express.js + SQLite backend
```

---

## Server

### Requirements

- Node.js 18+

### Setup

```bash
cd server
npm install
npm run seed      # creates and populates the SQLite database
```

### Run

```bash
npm start         # production
npm run dev       # development (auto-restarts on file changes)
```

The API runs on **http://localhost:3000**.

### Docker

From the repo root:

```bash
docker compose up --build
```

The database is seeded automatically on first boot and persisted in a named volume (`db_data`). To reset it:

```bash
docker compose down -v
docker compose up --build
```

**In production, always run the container with `db_data` explicitly mounted** (via `docker compose up`, or `docker run -v db_data:/app/db ...` if not using Compose). The image declares `/app/db` as a `VOLUME`, so starting it *without* an explicit mount still runs — but Docker silently backs it with a fresh anonymous volume instead. An updater like Watchtower that recreates the container on every new image (e.g. on every merge to `main`) will then mint a brand-new empty anonymous volume each time, silently resetting the database — active program, any scheduled switch, and all logged history — back to defaults on every deploy.

Override the host port with the `PORT` env var (default `3000`):

```bash
PORT=4000 docker compose up
```

### Programs

The server ships with several programs (see `server/data/*.json`), each with its own number of weeks and day layout. Exactly one program is "active" at a time; switching programs (or restarting the active one) stages the change for the coming Monday so the in-progress week isn't disrupted, and history from every program is kept so switching back and forth never loses past logs.

| Method | Path              | Description                                                  |
| ------ | ----------------- | -------------------------------------------------------------- |
| `GET`  | `/program`        | Current program state (active/pending program, start dates)    |
| `GET`  | `/program/:key/preview` | A program's description and week 1 day-by-day split, for previewing before a switch |
| `POST` | `/program/switch`  | Stage a switch to a different program. Body: `{ program }`     |
| `POST` | `/program/restart` | Stage a restart of the active program back to week 1           |
| `POST` | `/program/cancel`  | Cancel a staged switch/restart; the active program keeps running |

### Endpoints

| Method   | Path                    | Description                                                        |
| -------- | ----------------------- | ------------------------------------------------------------------- |
| `GET`    | `/weeks`                | All weeks in the active program                                     |
| `GET`    | `/weeks/:n`             | Full week with every day and exercise                               |
| `GET`    | `/weeks/:n/days/:day`   | Single day (e.g. `/weeks/1/days/monday`)                            |
| `GET`    | `/exercises`            | All exercises (filter with `?body_part=Back&exercise_name=row`)     |
| `GET`    | `/exercises?distinct=1` | Unique exercise catalog for the active program, for swap pickers    |
| `POST`   | `/exercises`            | Create a custom exercise not tied to a program slot                 |
| `GET`    | `/exercises/:id`        | Single exercise                                                     |
| `GET`    | `/exercises/:id/logs`   | All workout logs for an exercise                                    |
| `POST`   | `/logs`                 | Log a workout session with sets                                     |
| `GET`    | `/logs`                 | All completed logs (filter with `?date=YYYY-MM-DD` or `?session_id=`) |
| `GET`    | `/logs/:id`             | Get a logged session with all its sets                              |
| `PUT`    | `/logs/:id`             | Update a log's timestamp/completion or replace its sets             |
| `PATCH`  | `/logs/:id/sets/:setId` | Update a single set                                                  |
| `DELETE` | `/logs/:id`             | Delete a log                                                         |

### Exercise fields

Each exercise includes:

- `body_part` — body part (e.g. `"Back"`)
- `exercise_name` — exercise name (e.g. `"Meadows row"`)
- `exercise_description` — full description from the program
- `rpe` — rate of perceived exertion (e.g. `"10"` or `"8-10"`)
- `sets` — prescribed number of working sets
- `rep_range` — prescribed reps (e.g. `"8"` or `"8-10"`)

A program exercise can be swapped out for a session; `GET /weeks/:n` and `GET /weeks/:n/days/:day` annotate each exercise with `carried_exercise` when an earlier week logged a swap at that same day/slot, so the substitution carries forward until swapped again.

### Day fields

Each day (in a week's `days` array, or from `GET /weeks/:n/days/:day`) includes:

- `is_rest_day` — whether the day is a rest day
- `focus_summary` — generated from the day's exercises' body parts, e.g. `"Back, Biceps & Abs Day"`, or `"Rest Day"` for a rest day
- `exercises` — the day's exercises (empty on a rest day)

### Logging a session

```bash
POST /logs
{
  "exercise_id": 1,
  "completed": true,
  "sets": [
    { "set_number": 1, "reps": 8, "weight": 135, "weight_unit": "lbs" },
    { "set_number": 2, "reps": 8, "weight": 155 },
    { "set_number": 3, "reps": 6, "weight": 175 }
  ]
}
```

`logged_at` defaults to now (ISO 8601). `weight_unit` defaults to `"lbs"`. Pass `swapped_exercise_id` instead of logging against the programmed `exercise_id` directly to record a swap. `duration_seconds` and `difficulty` (perceived effort, 1-10) describe the whole session and are only set on one log per workout — the app sets both on the final log after the user edits them on the completion screen. `session_id` is a client-generated string shared by every log from one workout, so history can tell two workouts logged on the same calendar day apart instead of bunching them into one entry; filter `GET /logs` by it with `?session_id=`.

---

## App (React Native / Expo)

### Requirements

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- For iOS: Xcode and an iOS simulator or device
- For Android: Android Studio and an emulator or device

### Setup

```bash
cd lift-tracker
npm install
```

### Run

```bash
npm start           # opens Expo dev tools — scan QR to run on device
npm run ios         # run on iOS simulator
npm run android     # run on Android emulator
npm run web         # run in browser
```

> The app uses `expo-dev-client`. You must run `expo run:ios` or `expo run:android` at least once to build the native shell before using `npm start`.
