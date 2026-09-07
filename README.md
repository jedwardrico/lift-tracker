# Lift Tracker — Gamma Bomb

A workout tracker for the Gamma Bomb program by John Meadows. 14-week hypertrophy training split with a REST/DELOAD at weeks 7–8.

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

Override the host port with the `PORT` env var (default `3000`):

```bash
PORT=4000 docker compose up
```

### Endpoints

| Method   | Path                    | Description                                            |
| -------- | ----------------------- | ------------------------------------------------------ |
| `GET`    | `/weeks`                | All 14 weeks                                           |
| `GET`    | `/weeks/:n`             | Full week with every day and exercise                  |
| `GET`    | `/weeks/:n/days/:day`   | Single day (e.g. `/weeks/1/days/monday`)               |
| `GET`    | `/exercises`            | All exercises (filter with `?title=Back&subtitle=row`) |
| `GET`    | `/exercises/:id`        | Single exercise                                        |
| `GET`    | `/exercises/:id/logs`   | All workout logs for an exercise                       |
| `POST`   | `/logs`                 | Log a workout session with sets                        |
| `GET`    | `/logs/:id`             | Get a logged session with all its sets                 |
| `PUT`    | `/logs/:id`             | Replace sets on a log                                  |
| `PATCH`  | `/logs/:id/sets/:setId` | Update a single set                                    |
| `DELETE` | `/logs/:id`             | Delete a log                                           |

### Exercise fields

Each exercise includes:

- `title` — body part (e.g. `"Back"`)
- `subtitle` — exercise name (e.g. `"Meadows row"`)
- `body` — full description from the program
- `rpe` — rate of perceived exertion (e.g. `"10"` or `"8-10"`)
- `sets` — prescribed number of working sets
- `rep_range` — prescribed reps (e.g. `"8"` or `"8-10"`)

### Logging a session

```bash
POST /logs
{
  "exercise_id": 1,
  "sets": [
    { "set_number": 1, "reps": 8, "weight": 135, "weight_unit": "lbs" },
    { "set_number": 2, "reps": 8, "weight": 155 },
    { "set_number": 3, "reps": 6, "weight": 175 }
  ]
}
```

`logged_at` defaults to now (ISO 8601). `weight_unit` defaults to `"lbs"`.

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

---

## Day Schedule

The program runs Monday–Friday with Saturday and Sunday as rest days.

| Day       | Workout                              |
| --------- | ------------------------------------ |
| Monday    | Back, Abs, Calves                    |
| Tuesday   | Chest, Shoulders                     |
| Wednesday | Legs                                 |
| Thursday  | Arms (Triceps + Biceps), Abs, Calves |
| Friday    | Chest, Back, Shoulders (pump)        |
| Saturday  | Rest                                 |
| Sunday    | Rest                                 |

Weeks 7–8 are a deload with reduced volume and intensity.
