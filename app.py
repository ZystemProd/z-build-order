# ──────────────────────────────────────────────────────────────────────
#  StarCraft II replay parser – game-time-accurate build order
# ──────────────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io, bisect, re, os

# Optional prettified names — omit the file and we fall back gracefully
try:
    from name_map import NAME_MAP        # {'spawningpool': 'Spawning Pool', …}
except ImportError:
    NAME_MAP = {}

# ───────────────────────── helpers ───────────────────────────────────
def format_name(raw: str) -> str:
    """'SpawningPool' → 'Spawning Pool' (or custom NAME_MAP entry)."""
    if not raw:
        return raw
    lower = raw.lower()
    if lower in NAME_MAP:
        return NAME_MAP[lower]
    return re.sub(r"(?<!^)(?=[A-Z])", " ", raw).title()


def sec2clock(sec: int) -> str:
    return f"{sec // 60:02d}:{sec % 60:02d}"


# ───────────────────────── Flask app ─────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route("/")
def root():
    return "🟢 SC2 replay parser running"


# ---------------------------------------------------------------------
#   /players  – quick endpoint to list players & matchup
# ---------------------------------------------------------------------
@app.route("/players", methods=["POST"])
def players():
    if "replay" not in request.files or not request.files["replay"].filename:
        return "No replay uploaded", 400

    replay = sc2reader.load_replay(io.BytesIO(request.files["replay"].read()),
                                   load_map=False)
    roster = [p for p in replay.players if not p.is_observer]
    info = [{"pid": p.pid, "name": p.name, "race": p.play_race} for p in roster]

    matchup = None
    if len(roster) >= 2:
        a, b = roster[0].play_race[0].lower(), roster[1].play_race[0].lower()
        matchup = f"{a}v{b}"

    return jsonify({"players": info, "matchup": matchup})


# ---------------------------------------------------------------------
#   /upload  – main build-order extraction
# ---------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload():
    if "replay" not in request.files or not request.files["replay"].filename:
        return "No replay uploaded", 400

    try:
        replay = sc2reader.load_replay(
            io.BytesIO(request.files["replay"].read()), load_map=False
        )
    except Exception as e:
        return f"Failed to load replay: {e}", 400

    # ───── select player (default: first non-observer) ───────────────
    contenders = [p for p in replay.players if not p.is_observer]
    if not contenders:
        return "No active players", 400

    req = request.form.get("player") or request.args.get("player")
    player = next((p for p in contenders if str(p.pid) == req or p.name == req),
                  contenders[0])

    # ───── optional query-string / form toggles ──────────────────────
    def truthy(val): return (val or "").lower() in {"1", "true", "yes", "on"}

    exclude_workers = truthy(request.values.get("exclude_workers"))
    exclude_supply  = truthy(request.values.get("exclude_supply"))
    exclude_time    = truthy(request.values.get("exclude_time"))
    compact         = truthy(request.values.get("compact"))

    stop_limit = int(request.values.get("stop_supply", 0) or 0) or None
    time_limit = int(request.values.get("stop_time", 0) or 0) * 60 or None

    # ───── supply lookup (PlayerStatsEvent) ──────────────────────────
    supply_events, order = {}, []
    for ev in replay.tracker_events:
        if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent) and ev.pid == player.pid:
            supply_events[ev.second] = (int(ev.food_used), int(ev.food_made))
    supply_times = sorted(supply_events)

    def supply_at(sec: int):
        if not supply_times:
            return 0, 0
        idx = bisect.bisect_right(supply_times, sec) - 1
        return supply_events[supply_times[idx]] if idx >= 0 else (0, 0)

    # ───── filters ───────────────────────────────────────────────────
    skip_units = {
        "Egg", "Larva", "Overlord Cocoon", "Broodling", "Changeling",
        "Mule", "M U L E", "Scanner Sweep", "Kd8Charge", "KD8Charge"
    }
    if exclude_workers:
        skip_units |= {"Probe", "SCV", "Drone"}
    skip_kw = {"creep tumor", "chronoboost", "phase shift", "reward", "dance"}

    # ───── build-order extraction ────────────────────────────────────
    for ev in replay.tracker_events:
        # ignore pre-game countdown (-3 … -1)
        if ev.second < 0:
            continue

        # drop starting assets logged at 0:00
        if ev.second == 0 and isinstance(
            ev,
            (
                sc2reader.events.tracker.UnitBornEvent,
                sc2reader.events.tracker.UnitInitEvent,
                sc2reader.events.tracker.UpgradeCompleteEvent,
            ),
        ):
            continue

        etype = raw = None

        # units finish on UnitBornEvent
        if isinstance(ev, sc2reader.events.tracker.UnitBornEvent):
            ctrl = getattr(ev, "unit_controller", None)
            if not ctrl or ctrl.pid != player.pid:
                continue
            etype, raw = "unit", ev.unit_type_name

        # buildings finish on UnitDoneEvent
        elif isinstance(ev, sc2reader.events.tracker.UnitDoneEvent):
            ctrl = getattr(ev, "unit_controller", None)
            if not ctrl or ctrl.pid != player.pid:
                continue
            etype, raw = "building", ev.unit_type_name

        # upgrades finish on UpgradeCompleteEvent
        elif isinstance(ev, sc2reader.events.tracker.UpgradeCompleteEvent):
            if ev.pid != player.pid:
                continue
            etype, raw = "upgrade", ev.upgrade_type_name

        else:
            continue  # skip all other events

        # universal skips
        if (
            not raw
            or raw in skip_units
            or raw.lower() in skip_kw
            or any(k in raw for k in ("Beacon", "Spray"))
        ):
            continue

        name = format_name(raw)
        used, cap = supply_at(ev.second)

        if stop_limit and used > stop_limit:
            break
        if time_limit and ev.second > time_limit:
            break

        order.append(
            {
                "secs":   ev.second,
                "time":   sec2clock(ev.second),
                "supply": used,
                "cap":    cap,
                "unit":   name,
            }
        )

    # ───── output formatting ─────────────────────────────────────────
    lines = []
    if compact:
        i, n = 0, len(order)
        while i < n:
            first = order[i]
            sup, t0 = first["supply"], first["secs"]
            units, j = [], i
            while j < n and order[j]["supply"] == sup and order[j]["secs"] - t0 <= 5:
                units.append(order[j]["unit"])
                j += 1
            prefix = ""
            if not exclude_supply:
                prefix += f"[{sup}/{first['cap'] if sup > first['cap'] else sup}] "
            if not exclude_time:
                prefix += f"[{sec2clock(t0)}] "
            lines.append(prefix + " + ".join(units))
            i = j
    else:
        for e in order:
            pieces = []
            if not exclude_supply:
                pieces.append(
                    f"{e['supply']}/{e['cap']}" if e["supply"] > e["cap"] else str(e["supply"])
                )
            if not exclude_time:
                pieces.append(e["time"])
            prefix = f"[{' '.join(pieces)}] " if pieces else ""
            lines.append(prefix + e["unit"])

    return "\n".join(lines), 200


# ───────────────────────── production entrypoint ─────────────────────
if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))  # Render sets $PORT

    try:
        from waitress import serve
        serve(app, host="0.0.0.0", port=PORT)
    except ImportError:
        app.run(host="0.0.0.0", port=PORT, debug=True)
