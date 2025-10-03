export default function BuildSummaryCard({ title, matchup, author, href }) {
  return (
    <a
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/60 hover:bg-cyan-500/10"
    >
      <span className="text-xs uppercase tracking-[0.3em] text-slate-400 group-hover:text-cyan-200">{matchup}</span>
      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-50">{title}</h3>
      <p className="text-xs text-slate-300">By {author}</p>
    </a>
  );
}
