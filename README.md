# z-build-order
Build order program for primary Starcraft 2

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the dev server:
   ```bash
   npm run dev
   ```
   The application will start on <http://localhost:5173> by default.

## Building

To create a production build run:

```bash
npm run build
```

## Preview Deployment

Deploy the latest build to a Firebase preview channel with:

```bash
npm run preview-deploy
```

This command bundles the app and uploads it to the `dev` preview channel.

## Bracket Input Setting

Bracket input inserts `[ ]` automatically for supply or time values. You can
enable or disable this behaviour from the **Settings** modal:

1. Open the settings modal from the main page.
2. Toggle **Enable Bracket Input** to turn bracket insertion on or off.
