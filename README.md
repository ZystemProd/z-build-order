

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
=======
 Build order program for primary Starcraft 2

* Run `npm install` to install dependencies.
* Install Firebase CLI (`npm install -g firebase-tools` or `npx firebase login`).
* Use `npm run build` followed by `firebase hosting:channel:deploy dev` for preview deployments.

