"use client";

import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import Link from "next/link";

function sanitizeMarkup(markup) {
  if (!markup) return "";
  return DOMPurify.sanitize(markup, { USE_PROFILES: { html: true } });
}

export default function ViewBuildClient({ build, recentBuilds }) {
  const [showSupply, setShowSupply] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");

  const safeSummary = useMemo(() => sanitizeMarkup(build?.summaryHtml), [build?.summaryHtml]);
  const safeSteps = useMemo(() => sanitizeMarkup(build?.stepsHtml), [build?.stepsHtml]);

  if (!build) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-100">
        <h1 className="text-3xl font-semibold">Choose a build to preview</h1>
        <p className="text-sm text-slate-300">
          Pass a build ID via <code className="rounded bg-black/60 px-1 py-0.5">?id=</code> in the URL to load data from Firestore. This page
          demonstrates how to hydrate server-fetched data inside a client component using React hooks.
        </p>
        <Link
          href="/"
          className="w-fit rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Back to migration overview
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 py-10 text-slate-100">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900 to-slate-800/60 p-8 shadow-xl">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">{build.matchup || "Custom"}</p>
          <h1 className="text-balance text-4xl font-semibold text-white">{build.title}</h1>
          <p className="text-sm text-slate-300">
            Created by <span className="font-medium text-slate-100">{build.author || "Anonymous"}</span> on {build.createdAtFormatted}.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200/80">
          <button
            type="button"
            onClick={() => setShowSupply(true)}
            className={`rounded-full border px-4 py-1 transition ${
              showSupply
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-50"
            }`}
          >
            Supply timings
          </button>
          <button
            type="button"
            onClick={() => setShowSupply(false)}
            className={`rounded-full border px-4 py-1 transition ${
              !showSupply
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-50"
            }`}
          >
            Game time
          </button>
        </div>
      </header>

      <nav className="flex gap-3">
        {[
          { id: "overview", label: "Overview" },
          { id: "steps", label: "Build Steps" },
          { id: "analysis", label: "Analysis" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedTab(tab.id)}
            className={`rounded-full border px-4 py-1 text-sm transition ${
              selectedTab === tab.id
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
          {selectedTab === "overview" && (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeSummary }} />
          )}
          {selectedTab === "steps" && (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeSteps }} />
          )}
          {selectedTab === "analysis" && (
            <div className="space-y-4 text-sm text-slate-300">
              <p>
                Use this tab to migrate replay analysis output. Hook in your existing parsing utilities by calling them inside a
                `useEffect` once the build data is available.
              </p>
              <p>
                The <span className="font-semibold text-slate-100">showSupply</span> state toggles whether timestamps or supply counts
                should be highlighted—just adjust your rendered markup accordingly.
              </p>
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-cyan-400/40 bg-cyan-500/10 p-5 text-sm text-cyan-50">
            <h2 className="text-lg font-semibold text-cyan-100">Recent community builds</h2>
            <ul className="mt-3 space-y-2">
              {recentBuilds?.map((item) => (
                <li key={item.id} className="flex flex-col rounded-lg bg-white/5 p-3">
                  <span className="text-sm font-semibold text-white">{item.title}</span>
                  <span className="text-xs text-slate-300">{item.matchup} • {item.createdAtFormatted}</span>
                  <Link
                    href={`/viewBuild?id=${item.id}`}
                    className="mt-2 inline-flex w-fit items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100"
                  >
                    View build
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <h2 className="text-base font-semibold text-white">Map annotations</h2>
            <p className="mt-2">
              This area is ready for the interactive map React component. Pass the build&apos;s map notes in via props and reuse the
              canvas logic from <code className="rounded bg-black/60 px-1 py-0.5">interactive_map.js</code> after wrapping it with hooks.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
