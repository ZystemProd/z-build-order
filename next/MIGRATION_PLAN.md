# Next.js Migration Plan for Z-Build Order

This document maps the legacy Vite + vanilla JS project into the new Next.js 15 (App Router) codebase and illustrates how to incrementally migrate functionality.

## 1. Proposed Next.js Folder Structure

```
next/
└─ src/
   ├─ app/
   │  ├─ layout.js              # Global metadata + font setup
   │  ├─ page.js                # Landing page with migration checklist
   │  ├─ viewBuild/
   │  │  └─ page.js             # Example migration of viewBuild.html
   │  └─ api/
   │     └─ builds/[id]/route.js (future: REST endpoints for server data)
   ├─ components/
   │  ├─ BuildModal.jsx         # React version of src/js/modules/modal.js
   │  ├─ ViewBuildClient.jsx    # Client wrapper for interactivity & DOMPurify
   │  └─ BuildSummaryCard.jsx   # (future) reusable cards for build listings
   ├─ hooks/
   │  └─ useFirebaseAuth.js     # React hook encapsulating onAuthStateChanged
   └─ lib/
      ├─ firebase.js            # Single Firebase initialization point
      └─ builds.js              # Firestore query utilities shared by pages/components
```

### Legacy → Next.js Mapping Cheatsheet

| Legacy Asset | New Location | Notes |
|--------------|--------------|-------|
| `index.html` | `src/app/page.js` | Converted to React server component for SEO-friendly landing page.
| `viewBuild.html` | `src/app/viewBuild/page.js` | Uses server data fetching + client wrapper for DOMPurify.
| `css/style.css`, `css/template.css` | Tailwind utilities + `src/app/globals.css` | Shared tokens live in CSS variables, layout handled with Tailwind classes.
| `src/js/modules/*.js` | `src/components/*` or `src/lib/*` | UI modules become components; data helpers move under `lib/`.
| `app.js`, `clan.js`, Firebase config | `src/lib/firebase.js`, `src/hooks/useFirebaseAuth.js` | Ensures a single Firebase app instance across client components.
| Template storage, build services | `src/lib/builds.js` | Centralizes Firestore queries for reuse in server/client contexts.

## 2. Example Migration: `viewBuild.html → src/app/viewBuild/page.js`

See [`src/app/viewBuild/page.js`](./src/app/viewBuild/page.js) for a fully working example that:

* Uses an async server component to fetch build data and related community builds via `getPublishedBuild` and `getRecentCommunityBuilds`.
* Provides `generateMetadata` to hydrate the `<head>` for SEO and social embeds.
* Renders a client-side wrapper (`<ViewBuildClient />`) for dynamic features like copying steps, toggling supply/time displays, or showing map annotations.
* Demonstrates how query parameters (`?id=`) migrate to the App Router `searchParams` API.

Key points from the migration:

* Server code remains declarative—no `document.getElementById`. Instead, props flow into components, and derived UI state is handled with React hooks.
* The component remains statically optimizable because Firestore calls are wrapped in cached utilities.
* HTML content from Firestore is sanitized inside the client wrapper using `DOMPurify.sanitize` before injecting with `dangerouslySetInnerHTML`.

## 3. Example Conversion: `modal.js → <BuildModal />`

[`src/components/BuildModal.jsx`](./src/components/BuildModal.jsx) demonstrates how the imperative modal logic migrates to a React component:

* Maintains modal open/close state with `useState`.
* Replaces `document.getElementById` calls with controlled inputs and event handlers.
* Uses `useEffect` to trigger Firestore pagination (`loadMore`) when the modal scroll container nears the end.
* Preserves helper utilities (formatting matchups, relative dates) as pure functions inside the component module, making it easy to share across pages.
* Uses Tailwind classes for layout, while niche styling (e.g., scroll shadows) remains in `globals.css`.

This component can be imported anywhere via:

```jsx
<BuildModal
  isOpen={isBuildModalOpen}
  onClose={() => setBuildModalOpen(false)}
  onSelectBuild={handleSelectBuild}
  initialFilter="zvp"
/>
```

## 4. Suggested Migration Milestones

1. **Bootstrap shared libraries**
   * Move Firebase setup into `src/lib/firebase.js`.
   * Add supporting hooks (`useFirebaseAuth`) and Firestore helpers (`lib/builds.js`).

2. **Convert high-traffic pages first**
   * Start with `index.html` → `app/page.js` and `viewBuild.html` → `app/viewBuild/page.js`.
   * Keep legacy app running while verifying parity through manual QA.

3. **Modularize UI features**
   * Translate modal, toast, and header modules into React components one at a time.
   * Replace global `document` listeners with scoped component handlers.

4. **Gradually adopt Tailwind**
   * Reuse Tailwind utility classes for layout and spacing.
   * Migrate any bespoke gradients or animations into `globals.css`.

5. **Enable server-rendered SEO**
   * Introduce dynamic route `app/viewBuild/[id]/page.js` once data layer is ready.
   * Render comment threads on the server using cached Firestore queries for crawlability.

6. **Parallel testing strategy**
   * For each migrated feature, expose a flag (e.g., `NEXT_PUBLIC_USE_NEXT=1`) to switch between legacy and Next.js frontends until parity is confirmed.
   * Write Playwright smoke tests targeting the Next.js pages to ensure interactive pieces (map annotations, build parsing) behave as expected.

Following this roadmap lets you migrate feature-by-feature without losing production coverage or SEO.
