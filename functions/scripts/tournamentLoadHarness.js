#!/usr/bin/env node
"use strict";

const fs = require("fs/promises");
const path = require("path");
const admin = require("firebase-admin");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.slice(2);
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx >= 0) {
      const key = trimmed.slice(0, eqIdx);
      const value = trimmed.slice(eqIdx + 1);
      out[key] = value;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[trimmed] = next;
      i += 1;
    } else {
      out[trimmed] = "true";
    }
  }
  return out;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function summarize(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      count: 0,
      avg: null,
      p50: null,
      p95: null,
      p99: null,
      max: null,
    };
  }
  let sum = 0;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    sum += value;
    if (value > max) max = value;
  }
  return {
    count: values.length,
    avg: Number((sum / values.length).toFixed(2)),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max,
  };
}

function buildSeedState(slug, payloadBytes) {
  const players = Array.from({ length: 32 }, (_, idx) => ({
    id: `p${idx + 1}`,
    uid: `load-user-${idx + 1}`,
    name: `Load Player ${idx + 1}`,
    seed: idx + 1,
  }));
  const matches = Array.from({ length: 16 }, (_, idx) => ({
    id: `w1m${idx + 1}`,
    status: "pending",
    scores: [0, 0],
    sources: [
      { type: "player", playerId: `p${idx * 2 + 1}` },
      { type: "player", playerId: `p${idx * 2 + 2}` },
    ],
  }));
  const largePayload = payloadBytes > 0 ? "x".repeat(payloadBytes) : "";

  return {
    players,
    bracket: {
      winners: { 0: matches },
      losers: {},
      groups: [],
      finals: null,
      winnersRoundCount: 1,
      losersRoundCount: 0,
    },
    pointsLedger: {},
    activity: [],
    matchVetoes: {},
    scoreReports: {},
    matchReadySince: {},
    casters: [],
    casterRequests: [],
    matchCasts: {},
    mmrSeedingMode: "current",
    isLive: true,
    hasBeenLive: true,
    needsReseed: false,
    manualSeedingEnabled: false,
    manualSeedingOrder: [],
    bracketLayoutVersion: 55,
    bracketRepairVersion: 55,
    lastUpdated: Date.now(),
    lhMeta: {
      seededAt: Date.now(),
      seededBy: "tournamentLoadHarness",
      slug,
      payloadBytes,
    },
    lhPayload: largePayload,
    lhCounters: {},
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const projectId =
    args.projectId ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    "demo-z-build-order";
  const slug = String(args.slug || `load-harness-${now}`).trim();
  const viewers = Math.max(1, toInt(args.viewers, 25));
  const writers = Math.max(1, toInt(args.writers, 6));
  const durationSec = Math.max(5, toInt(args.durationSec, 120));
  const writeIntervalMs = Math.max(50, toInt(args.writeIntervalMs, 800));
  const jitterMs = Math.max(0, toInt(args.jitterMs, 300));
  const payloadKb = Math.max(0, toInt(args.payloadKb, 8));
  const summaryEveryMs = Math.max(1000, toInt(args.summaryEveryMs, 5000));
  const seed = toBool(args.seed, true);
  const transactions = toBool(args.transactions, true);
  const burstEveryMs = Math.max(0, toInt(args.burstEveryMs, 0));

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  const ref = db.collection("tournamentStates").doc(slug);

  if (seed) {
    const seedData = buildSeedState(slug, payloadKb * 1024);
    await ref.set(seedData, { merge: true });
  }

  const metrics = {
    snapshots: 0,
    snapshotErrors: 0,
    writesAttempted: 0,
    writesSucceeded: 0,
    writesFailed: 0,
    abortedConflicts: 0,
  };
  const latencySamplesMs = [];
  const payloadSamplesBytes = [];
  const unsubs = [];
  let stopping = false;
  let tickSequence = 0;
  const runStartedAt = Date.now();

  const writeTick = async (writerId, reason = "steady") => {
    const tickId = `${runStartedAt}-${writerId}-${tickSequence++}`;
    const sentAt = Date.now();
    metrics.writesAttempted += 1;

    try {
      if (transactions) {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const data = snap.exists ? snap.data() || {} : {};
          const counters = { ...(data.lhCounters || {}) };
          const key = `w${writerId}`;
          counters[key] = (Number(counters[key]) || 0) + 1;
          tx.set(
            ref,
            {
              lhTick: {
                id: tickId,
                sentAt,
                writerId,
                reason,
              },
              lhCounters: counters,
              lastUpdated: sentAt,
            },
            { merge: true },
          );
        });
      } else {
        await ref.set(
          {
            lhTick: {
              id: tickId,
              sentAt,
              writerId,
              reason,
            },
            lastUpdated: sentAt,
          },
          { merge: true },
        );
      }
      metrics.writesSucceeded += 1;
    } catch (err) {
      metrics.writesFailed += 1;
      const code = String(err?.code || "").toLowerCase();
      const msg = String(err?.message || "").toLowerCase();
      if (
        code.includes("aborted") ||
        code === "10" ||
        msg.includes("aborted")
      ) {
        metrics.abortedConflicts += 1;
      }
    }
  };

  for (let i = 0; i < viewers; i += 1) {
    const unsub = ref.onSnapshot(
      (snap) => {
        metrics.snapshots += 1;
        if (!snap.exists) return;
        const data = snap.data() || {};
        const tick = data.lhTick || {};
        const sentAt = Number(tick.sentAt) || 0;
        if (sentAt > 0) {
          latencySamplesMs.push(Math.max(0, Date.now() - sentAt));
        }
        try {
          payloadSamplesBytes.push(
            Buffer.byteLength(JSON.stringify(data), "utf8"),
          );
        } catch (_) {
          // ignore serialization errors
        }
      },
      () => {
        metrics.snapshotErrors += 1;
      },
    );
    unsubs.push(unsub);
  }

  const writerJobs = Array.from({ length: writers }, (_, idx) => idx + 1).map(
    async (writerId) => {
      while (!stopping) {
        await writeTick(writerId);
        const jitter = jitterMs
          ? Math.floor(Math.random() * (jitterMs * 2 + 1)) - jitterMs
          : 0;
        await sleep(writeIntervalMs + jitter);
      }
    },
  );

  let burstTimer = null;
  if (burstEveryMs > 0) {
    burstTimer = setInterval(() => {
      for (let i = 1; i <= writers; i += 1) {
        void writeTick(i, "burst");
      }
    }, burstEveryMs);
  }

  const summaryTimer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - runStartedAt) / 1000);
    const latency = summarize(latencySamplesMs);
    const payload = summarize(payloadSamplesBytes);
    const successRate = metrics.writesAttempted
      ? Number(
          ((metrics.writesSucceeded / metrics.writesAttempted) * 100).toFixed(2),
        )
      : 0;
    console.log(
      [
        `[${elapsedSec}s]`,
        `writes ${metrics.writesSucceeded}/${metrics.writesAttempted} (${successRate}%)`,
        `snapshots ${metrics.snapshots}`,
        `lat p95 ${latency.p95 ?? "n/a"}ms`,
        `payload p95 ${payload.p95 ?? "n/a"} bytes`,
      ].join(" | "),
    );
  }, summaryEveryMs);

  await sleep(durationSec * 1000);
  stopping = true;
  clearInterval(summaryTimer);
  if (burstTimer) clearInterval(burstTimer);
  await Promise.race([
    Promise.all(writerJobs),
    sleep(Math.max(2000, writeIntervalMs + jitterMs + 500)),
  ]);
  unsubs.forEach((unsub) => {
    try {
      unsub();
    } catch (_) {
      // ignore unsubscribe errors
    }
  });

  const endedAt = Date.now();
  const finalLatency = summarize(latencySamplesMs);
  const finalPayload = summarize(payloadSamplesBytes);
  const finalReport = {
    config: {
      projectId,
      firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || null,
      slug,
      viewers,
      writers,
      durationSec,
      writeIntervalMs,
      jitterMs,
      payloadKb,
      seed,
      transactions,
      burstEveryMs,
      summaryEveryMs,
    },
    timing: {
      startedAt: new Date(runStartedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - runStartedAt,
    },
    metrics: {
      ...metrics,
      writeSuccessRatePct: metrics.writesAttempted
        ? Number(
            ((metrics.writesSucceeded / metrics.writesAttempted) * 100).toFixed(
              2,
            ),
          )
        : 0,
      latencyMs: finalLatency,
      payloadBytes: finalPayload,
    },
  };

  const outDir = path.resolve(process.cwd(), "test-results", "tournament-load");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${runStartedAt}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(finalReport, null, 2)}\n`, "utf8");

  console.log("\n=== Tournament Load Harness Summary ===");
  console.log(`Slug: ${slug}`);
  console.log(
    `Writes: ${metrics.writesSucceeded}/${metrics.writesAttempted} succeeded`,
  );
  console.log(
    `Conflicts (aborted): ${metrics.abortedConflicts} | Snapshot errors: ${metrics.snapshotErrors}`,
  );
  console.log(
    `Latency p50/p95/p99: ${finalLatency.p50 ?? "n/a"} / ${finalLatency.p95 ?? "n/a"} / ${finalLatency.p99 ?? "n/a"} ms`,
  );
  console.log(
    `Payload p95: ${finalPayload.p95 ?? "n/a"} bytes | snapshots: ${metrics.snapshots}`,
  );
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error("Tournament load harness failed:", err);
  process.exitCode = 1;
});
