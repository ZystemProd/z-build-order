# ────────────────────────────────────────────────────────────────────
#  StarCraft II replay parser – shows the exact build-order times
#  you see in the SC2 match-history panel (command start times).
# ────────────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io, bisect, re, os

# Optional pretty names — if name_map.py is missing we fall back safely
try:
    from name_map import NAME_MAP          # {"spawningpool": "Spawning Pool", ...}
except ImportError:
    NAME_MAP = {}

# ── helpers ─────────────────────────────────────────────────────────
def pretty(raw: str) -> str:
    """'SpawningPool' → 'Spawning Pool' (or NAME_MAP entry)."""
    if not raw:
        return raw
    lower = raw.lower()
    if lower in NAME_MAP:
        return NAME_MAP[lower]
    return re.sub(r"(?<!^)(?=[A-Z])", " ", raw).title()


def clock(sec: int) -> str:                # 42 → "00:42"
    return f"{sec // 60:02d}:{sec % 60:02d}"


def truthy(val) -> bool:                   # "1", "true", "Yes" → True
    return (val or "").lower() in {"1", "true", "yes", "on"}


# ── Flask app ───────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route("/")
def root():
    return "🟢 SC2 replay parser running"


# -------------------------------------------------------------------
#  /players  – quick list of players & matchup
# -------------------------------------------------------------------
@app.route("/players", methods=["POST"])
def players():
    f = request.files.get("replay")
    if not f or not f.filename:
        return "No replay uploaded", 400

    replay = sc2reader.load_replay(io.BytesIO(f.read()), load_map=False)
    roster = [p for p in replay.players if not p.is_observer]
    info   = [{"pid": p.pid, "name": p.name, "race": p.play_race} for p in roster]

    matchup = None
    if len(roster) >= 2:
        a, b = roster[0].play_race[0].lower(), roster[1].play_race[0].lower()
        matchup = f"{a}v{b}"
    return jsonify({"players": info, "matchup": matchup})


# -------------------------------------------------------------------
#  /upload  – the main build-order endpoint
# -------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload():
    f = request.files.get("replay")
    if not f or not f.filename:
        return "No replay uploaded", 400

    try:
        replay = sc2reader.load_replay(io.BytesIO(f.read()), load_map=False)
    except Exception as e:
        return f"Failed to load replay: {e}", 400

    # ── choose player ───────────────────────────────────────────────
    contenders = [p for p in replay.players if not p.is_observer]
    if not contenders:
        return "No active players", 400

    req   = request.values.get("player")
    player = next((p for p in contenders if str(p.pid) == req or p.name == req),
                  contenders[0])

    # ── optional flags / limits ─────────────────────────────────────
    excl_workers = truthy(request.values.get("exclude_workers"))
    excl_supply  = truthy(request.values.get("exclude_supply"))
    excl_time    = truthy(request.values.get("exclude_time"))
    compact      = truthy(request.values.get("compact"))
    stop_supply  = int(request.values.get("stop_supply", 0) or 0) or None
    stop_time    = int(request.values.get("stop_time" , 0) or 0) * 60 or None

    # ── supply lookup from PlayerStatsEvent ─────────────────────────
    supply_events = {}
    for ev in replay.tracker_events:
        if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent) and ev.pid == player.pid:
            supply_events[ev.second] = (int(ev.food_used), int(ev.food_made))
    supply_times = sorted(supply_events)

    def supply_at(sec: int):
        if not supply_times:
            return 0, 0
        idx = bisect.bisect_right(supply_times, sec) - 1
        return supply_events[supply_times[idx]] if idx >= 0 else (0, 0)

    # ── skip lists ──────────────────────────────────────────────────
    skip_units = {
        "Egg", "Larva", "Overlord Cocoon", "Broodling", "Changeling",
        "Mule", "M U L E", "Scanner Sweep", "Kd8Charge", "KD8Charge"
    }
    if excl_workers:
        skip_units |= {"Probe", "SCV", "Drone"}

    skip_keywords = {"creep tumor", "chronoboost", "phase shift",
                     "reward", "dance"}

    def clean_ability(name: str) -> str:
        """Strip 'Train ', 'Build Protoss ', 'WarpIn ', etc."""
        prefixes = (
            "Train ", "WarpIn ", "Warp In ", "Build Protoss ",
            "Build Terran ", "Build Zerg ", "Build ", "Research ", "Morph ",
            "Upgrade to "
        )
        for p in prefixes:
            if name.startswith(p):
                return name[len(p):]
        return name

    # ── build-order extraction (command start times) ────────────────
    order = []
    for ev in replay.game_events:          # DataCommand / TargetUnitCommand live here
        # ignore pre-game countdown (-3 .. -1)
        if ev.second < 0:
            continue
        # we only want the player's commands
        if ev.pid != player.pid:
            continue
        if not isinstance(ev, (sc2reader.events.game.DataCommandEvent,
                               sc2reader.events.game.TargetUnitCommandEvent)):
            continue

        ability = getattr(ev, "ability", None)
        ab_name = (ability.name if ability and ability.name else
                   getattr(ev, "ability_name", ""))

        if not ab_name or ab_name.startswith("Cancel"):
            continue
        lb = ab_name.lower()
        if any(kw in lb for kw in skip_keywords):
            continue

        unit_name = clean_ability(ab_name)
        if unit_name in skip_units or unit_name.lower() in skip_units:
            continue

        used, cap = supply_at(ev.second)

        if stop_supply and used > stop_supply:
            break
        if stop_time and ev.second > stop_time:
            break

        order.append({
            "secs":   ev.second,
            "time":   clock(ev.second),
            "supply": used,
            "cap":    cap,
            "unit":   pretty(unit_name),
        })

    # ── format output ───────────────────────────────────────────────
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
            if not excl_supply:
                prefix += f"[{sup}/{first['cap'] if sup > first['cap'] else sup}] "
            if not excl_time:
                prefix += f"[{clock(t0)}] "
            lines.append(prefix + " + ".join(units))
            i = j
    else:
        for e in order:
            parts = []
            if not excl_supply:
                parts.append(f"{e['supply']}/{e['cap']}" if e['supply'] > e['cap'] else str(e['supply']))
            if not excl_time:
                parts.append(e["time"])
            prefix = f"[{' '.join(parts)}] " if parts else ""
            lines.append(prefix + e["unit"])

    return "\n".join(lines), 200


# ───────────────────────── production entrypoint ────────────────────
if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))      # Render passes $PORT

    try:
        from waitress import serve                # Production WSGI
        serve(app, host="0.0.0.0", port=PORT)
    except ImportError:                           # Local dev fallback
        app.run(host="0.0.0.0", port=PORT, debug=True)
