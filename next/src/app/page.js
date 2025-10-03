import Link from "next/link";

const checklist = [
  {
    title: "Set up shared Firebase utilities",
    description:
      "Move initialization logic into src/lib/firebase.js and swap legacy module imports to use the shared instance.",
  },
  {
    title: "Port priority pages",
    description:
      "Translate index.html and viewBuild.html into server components for SEO, then hydrate interactivity with client wrappers.",
  },
  {
    title: "Componentize legacy modules",
    description:
      "Replace imperative DOM manipulation with React hooks (see BuildModal.jsx for the modal migration).",
  },
  {
    title: "Adopt Tailwind incrementally",
    description:
      "Use utility classes for layout while keeping unique effects in globals.css until equivalents exist.",
  },
];

const resources = [
  {
    name: "Migration Plan",
    href: "https://github.com/zystemprod/z-build-order/blob/main/next/MIGRATION_PLAN.md",
    description: "Project-wide mapping and milestone tracker for the move to Next.js.",
  },
  {
    name: "Example Build Page",
    href: "/viewBuild",
    description: "Preview the React-powered build viewer backed by Firestore helpers.",
  },
  {
    name: "Build Modal Component",
    href: "https://github.com/zystemprod/z-build-order/blob/main/next/src/components/BuildModal.jsx",
    description: "Direct link to the converted modal implementation for comparison with legacy modal.js.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 py-16 lg:px-12">
      <header className="flex flex-col gap-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Next.js Migration</p>
        <h1 className="text-balance text-4xl font-semibold text-white sm:text-5xl">
          Bring Z-Build Order to the App Router without losing Firebase features.
        </h1>
        <p className="max-w-2xl text-pretty text-base text-slate-300 sm:text-lg">
          Use this workspace to port modules, pages, and Firestore logic into reusable React components. Each section below
          highlights what to tackle next so the legacy Vite experience can coexist while you iterate.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        {checklist.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_1px_0_theme(colors.white/0.05)] backdrop-blur"
          >
            <h2 className="text-lg font-medium text-white">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-8">
        <h2 className="text-xl font-semibold text-cyan-200">Suggested Order of Operations</h2>
        <ol className="mt-4 space-y-3 text-sm text-cyan-50/90">
          <li>
            <span className="font-semibold text-cyan-100">1.</span> Wire up Firebase auth and Firestore in <code className="rounded bg-black/50 px-1 py-0.5">src/lib</code>.
          </li>
          <li>
            <span className="font-semibold text-cyan-100">2.</span> Migrate page shells (navigation, footer, modals) into React components that accept props.
          </li>
          <li>
            <span className="font-semibold text-cyan-100">3.</span> Recreate build parsing and interactive map logic inside client components that consume shared hooks.
          </li>
          <li>
            <span className="font-semibold text-cyan-100">4.</span> Enable server-rendered SEO by introducing cached Firestore queries for community and comment content.
          </li>
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {resources.map((resource) => (
          <Link
            key={resource.name}
            href={resource.href}
            className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/60 hover:bg-cyan-500/10"
          >
            <h3 className="text-base font-semibold text-white group-hover:text-cyan-100">{resource.name}</h3>
            <p className="mt-2 text-sm text-slate-300">{resource.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
