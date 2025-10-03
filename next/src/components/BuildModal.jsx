"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { getUserBuilds } from "@/lib/builds";

function formatRelativeDate(date) {
  if (!date) return "Unknown";
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return formatter.format(new Date(date));
}

function sanitizePreview(text) {
  if (!text) return "";
  return DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });
}

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "zvp", label: "ZvP" },
  { id: "zvt", label: "ZvT" },
  { id: "zvz", label: "ZvZ" },
  { id: "pvt", label: "PvT" },
  { id: "pvz", label: "PvZ" },
  { id: "pvp", label: "PvP" },
  { id: "tvp", label: "TvP" },
  { id: "tvt", label: "TvT" },
  { id: "tvz", label: "TvZ" },
];

export default function BuildModal({
  isOpen,
  onClose,
  onSelectBuild,
  initialFilter = "all",
}) {
  const { user, loading: authLoading } = useFirebaseAuth();
  const [filter, setFilter] = useState(initialFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);

  const listRef = useRef(null);

  const loadBuilds = useCallback(
    async ({ reset = false } = {}) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await getUserBuilds({
          userId: user.uid,
          filter,
          limit: 20,
          cursor: reset ? null : cursor,
        });

        setCursor(response.cursor ?? null);
        setItems((prev) => (reset ? response.items : [...prev, ...response.items]));
      } catch (err) {
        console.error("Failed to load builds", err);
        setError(err instanceof Error ? err.message : "Unable to load builds");
      } finally {
        setIsLoading(false);
      }
    },
    [cursor, filter, user],
  );

  useEffect(() => {
    if (!isOpen) return;
    setFilter(initialFilter);
  }, [initialFilter, isOpen]);

  useEffect(() => {
    if (!isOpen || !user) return;
    loadBuilds({ reset: true });
  }, [filter, isOpen, loadBuilds, user]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current;
    if (!node) return;

    function handleScroll() {
      if (!node || isLoading || !cursor) return;
      const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (distanceToBottom < 120) {
        loadBuilds();
      }
    }

    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [cursor, isLoading, isOpen, loadBuilds]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const emptyStateMessage = useMemo(() => {
    if (authLoading) return "Checking auth status...";
    if (!user) return "Sign in to access your saved builds.";
    if (isLoading) return "Loading builds...";
    if (items.length === 0) return "No builds found for this filter.";
    return null;
  }, [authLoading, isLoading, items.length, user]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <header className="modal-header">
          <div>
            <h2 className="text-lg font-semibold text-white">My Build Orders</h2>
            <p className="text-xs text-slate-300">
              Filter and reuse builds pulled from Firestore via <code className="rounded bg-black/50 px-1 py-0.5">lib/builds.js</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-50"
          >
            Close
          </button>
        </header>

        <div className="modal-filter-bar">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`filter-chip ${filter === option.id ? "filter-chip--active" : ""}`}
              onClick={() => {
                setCursor(null);
                setItems([]);
                setFilter(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div ref={listRef} className="modal-scroll">
          {emptyStateMessage ? (
            <div className="modal-empty">{emptyStateMessage}</div>
          ) : (
            <ul className="modal-list">
              {items.map((item) => (
                <li key={item.id} className="modal-item">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-300">{item.matchup} • {formatRelativeDate(item.createdAt)}</p>
                    {item.summaryHtml && (
                      <div
                        className="modal-item-preview"
                        dangerouslySetInnerHTML={{ __html: sanitizePreview(item.summaryHtml) }}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectBuild?.(item)}
                    className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Load build
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && !isLoading && <p className="modal-error">{error}</p>}
        {isLoading && items.length > 0 && (
          <p className="modal-loading">Fetching more builds…</p>
        )}
      </div>
    </div>
  );
}
