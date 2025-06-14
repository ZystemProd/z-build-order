# ──────────────────────────────────────────────────────────────────────
#  SC2 Replay Parser – correct game-time build-order extraction
#  👉 drop this file in place of the old app.py and restart
# ──────────────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io
import bisect
import re

# Optional: human-friendly renames (“SpawningPool” ➜ “Spawning Pool”, …)
from name_map import NAME_MAP

app = Flask(__name__)
CORS(app)

# ─────────────────────────── helpers ─────────────────────────────────
def format_name(name: str) -> str:
    """Convert internal names (SpawningPool) ➜ Spawning Pool."""
    if not name:
        return name
    lower = name.lower()
    if lower in NAME_MAP:
        return NAME_MAP[lower]
    # insert space before capitals and title-case
    return re.sub(r"(?<!^)(?=[A-Z])", " ", name).title()


def sec2clock(sec: int) -> str:
    """42 → '00:42' ( game seconds )."""
    return f"{sec // 60:02d}:{sec % 60:02d}"


# ─────────────────────────── routes ──────────────────────────────────
@app.route("/")
def index():
    return "🟢 SC2 Replay Parser is live!"


@app.route("/players", methods=["POST"])
def players():
    if "replay" not in request.files or request.files["replay"].filename == "":
        return "No replay uploaded", 400

    replay = sc2reader.load_replay(io.BytesIO(request.files["replay"].read()), load_map=False)
    players = [p for p in replay.players if not p.is_observer]

    info = [{"pid": p.pid, "name": p.name, "race": p.play_race} for p in players]
    matchup = None
    if len(players) >= 2:
        a, b = players[0].play_race[0].lower(), players[1].play_race[0].lower()
        matchup = f"{a}v{b}"
    return jsonify({"players": info, "matchup": matchup})


@app.route("/upload", methods=["POST"])
def upload():
    if "replay" not in request.files or request.files["replay"].filename == "":
        return "No replay uploaded", 400

    # ── load replay ──────────────────────────────────────────────────
    try:
        replay = sc2reader.load_replay(io.BytesIO(request.files["replay"].read()), load_map=False)
    except Exception as e:
        return f"Failed to load replay: {e}", 400

    # choose player (first by default or ?player= / form field)
    players = [p for p in replay.players if not p.is_observer]
    if not players:
        return "No players in replay", 400
    requested = request.form.get("player") or request.args.get("player")
    player = next((p for p in players if str(p.pid) == requested or p.name == requested), players[0])

    # optional filters
    exclude_workers   = (request.form.get("exclude_workers", "") or "").lower() in {"1", "true", "yes", "on"}
    exclude_supply    = (request.form.get("exclude_supply", "")  or "").lower() in {"1", "true", "yes", "on"}
    exclude_time      = (request.form.get("exclude_time", "")    or "").lower() in {"1", "true", "yes", "on"}
    compact           = (request.form.get("compact", "")         or "").lower() in {"1", "true", "yes", "on"}
    stop_limit        = int(request.form.get("stop_supply", 0) or 0) or None
    time_limit        = int(request.form.get("stop_time",   0) or 0) * 60 or None

    # ── supply lookup table from PlayerStatsEvents ───────────────────
    supply_events = {}
    for ev in replay.tracker_events:
        if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent) and ev.pid == player.pid:
            supply_events[ev.second] = (int(ev.food_used), int(ev.food_made))
    supply_times = sorted(supply_events)

    def get_supply(sec: int):
        if not supply_times:
            return (0, 0)
        idx = bisect.bisect_right(supply_times, sec) - 1
        return supply_events[supply_times[idx]] if idx >= 0 else (0, 0)

    # ── filters ──────────────────────────────────────────────────────
    skip_units = {
        "Egg", "Larva", "Overlord Cocoon", "Mule", "M U L E", "Scanner Sweep",
        "Kd8Charge", "KD8Charge", "Broodling", "Changeling",
    }
    if exclude_workers:
        skip_units.update({"Drone", "Probe", "SCV"})
    skip_keywords = {"creep tumor", "chronoboost", "phase shift", "reward", "dance"}

    # ── build-order extraction ───────────────────────────────────────
    entries = []
    for ev in replay.tracker_events:

        # skip the countdown – keep the 0-second “Train Probe” order
        if ev.second < 0:
            continue

        # ignore pre-placed starting buildings & units at 0 : 00
        if ev.second == 0 and isinstance(
            ev,
            (sc2reader.events.tracker.UnitBornEvent,
             sc2reader.events.tracker.UnitInitEvent,
             sc2reader.events.tracker.UpgradeCompleteEvent),
        ):
            continue

        etype, name = None, None

        # ── units finish on UnitBornEvent ────────────────────────────
        if isinstance(ev, sc2reader.events.tracker.UnitBornEvent):
            if ev.unit_controller.pid != player.pid:
                continue
            etype, name = "unit", ev.unit_type_name

        # ── buildings finish on UnitDoneEvent ────────────────────────
        elif isinstance(ev, sc2reader.events.tracker.UnitDoneEvent):
            if ev.unit_controller.pid != player.pid:
                continue
            etype, name = "building", ev.unit_type_name

        # ── upgrades finish on UpgradeCompleteEvent ──────────────────
        elif isinstance(ev, sc2reader.events.tracker.UpgradeCompleteEvent):
            if ev.pid != player.pid:
                continue
            etype, name = "upgrade", ev.upgrade_type_name

        # ignore everything else (commands, cancels, morphs, etc.)
        else:
            continue

        # universal skips
        lower = name.lower()
        if (
            not name
            or any(k in name for k in ("Beacon", "Spray"))
            or name in skip_units
            or lower in (s.lower() for s in skip_units)
            or any(k in lower for k in skip_keywords)
        ):
            continue

        # human-readable name
        name = format_name(name)

        # supply at this second
        used, cap = get_supply(ev.second)

        # stop limits
        if stop_limit is not None and used > stop_limit:
            break
        if time_limit is not None and ev.second > time_limit:
            break

        # record
        entries.append(
            {
                "secs":   ev.second,
                "time":   sec2clock(ev.second),
                "supply": used,
                "cap":    cap,
                "unit":   name,
            }
        )

    # ── format output (compact vs full) ──────────────────────────────
    lines = []
    if compact:
        # group lines that share the same supply & happen ≤ 5 s apart
        i, n = 0, len(entries)
        while i < n:
            first = entries[i]
            supply, start = first["supply"], first["secs"]
            units, j = [], i
            while j < n and entries[j]["supply"] == supply and entries[j]["secs"] - start <= 5:
                units.append(entries[j]["unit"])
                j += 1
            prefix = ""
            if not exclude_supply:
                supply_str = f"{supply}/{first['cap']}" if supply > first["cap"] else str(supply)
                prefix += f"[{supply_str}] "
            if not exclude_time:
                prefix += f"[{sec2clock(start)}] "
            lines.append(prefix + " + ".join(units))
            i = j
    else:
        for e in entries:
            parts = []
            if not exclude_supply:
                supply_str = f"{e['supply']}/{e['cap']}" if e['supply'] > e['cap'] else str(e['supply'])
                parts.append(supply_str)
            if not exclude_time:
                parts.append(e["time"])
            prefix = f"[{' '.join(parts)}] " if parts else ""
            lines.append(prefix + e["unit"])

    return "\n".join(lines), 200


# ─────────────────────────── main ────────────────────────────────────
if __name__ == "__main__":
    from waitress import serve

    serve(app, host="0.0.0.0", port=5000)
