
Build order program for primary Starcraft 2

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   Visit <http://localhost:5173> in your browser.

## Building

Create a production build with:

```bash
npm run build
```


After building, run the helper script to further compress the Firebase vendor
bundle:

```bash
npm run minify-firebase
```


The build configuration uses Vite's `splitVendorChunkPlugin` to automatically
separate vendor dependencies into smaller chunks. Scripts for the main pages are
now loaded dynamically after the DOM finishes loading to further reduce unused
JavaScript on initial page load.

## Preview Deployment

Deploy the current build to the `dev` preview channel:

```bash
npm run preview-deploy
```

Ensure you are authenticated with the Firebase CLI (`firebase login`).

## Tournament Load Testing

Use the local harness to reproduce traffic pressure on `tournamentStates/{slug}`
with many listeners and concurrent writers.

1. Run against Firestore emulator:
   ```bash
   npm run test:load:emulator
   ```
2. Run with custom traffic profile:
   ```bash
   npm run test:load -- --slug=my-tournament --viewers=80 --writers=16 --durationSec=180 --writeIntervalMs=500 --jitterMs=250 --payloadKb=12 --burstEveryMs=4000
   ```
3. Run emulator with custom profile:
   ```bash
   LOAD_ARGS="--slug=my-tournament --viewers=80 --writers=16 --durationSec=180 --writeIntervalMs=500 --jitterMs=250 --payloadKb=12 --burstEveryMs=4000" npm run test:load:emulator
   ```

Useful flags:
- `--viewers`: number of concurrent snapshot listeners.
- `--writers`: number of concurrent writers (transaction mode by default).
- `--durationSec`: total test time.
- `--writeIntervalMs`: base write interval per writer.
- `--jitterMs`: random +/- jitter added per write interval.
- `--payloadKb`: additional payload size on the state document.
- `--transactions=true|false`: use `runTransaction` for contention testing.
- `--burstEveryMs`: optional burst cadence (0 disables bursts).

Reports are written to `test-results/tournament-load/*.json` with:
- write success/fail rates
- aborted conflict count
- snapshot latency p50/p95/p99
- snapshot payload size p95

Optional browser-side instrumentation:
- Enable in DevTools: `localStorage.setItem('zboTournamentPerf', '1')`
- Reload tournament page and inspect `window.__zboTournamentPerf.events`
- Disable with: `localStorage.removeItem('zboTournamentPerf')`

## Bracket Input Setting

The editor can insert `[` `]` automatically around supply and time values. You
can toggle this in **Settings**:

1. Open the user menu and click **Settings**.
2. Enable or disable **Bracket Input** in the modal.

* Run `npm install` to install dependencies.
* Install Firebase CLI (`npm install -g firebase-tools` or `npx firebase login`).
* Use `npm run build` followed by `firebase hosting:channel:deploy dev` for preview deployments.

## Replay Parsing Backend

To parse StarCraft II replays locally you must run the Python service:

```bash
pip install flask flask-cors sc2reader
python app.py
```

The server listens on http://localhost:5000. The frontend will send uploaded
replays to `/upload` on that server and populate the **Build Order** text area
with the parsed results.
