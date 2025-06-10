
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

