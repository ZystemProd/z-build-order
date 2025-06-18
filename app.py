from flask import Flask, request, jsonify
"""Minimal StarCraft II replay parser producing build orders.

Changes made 2025‑06‑18
----------------------
* Force `load_level=4` so tracker events (PlayerStatsEvent, UpgradeCompleteEvent, …) are always loaded.
* Maintain a rolling snapshot of the player’s current supply (used/made) as we iterate through
  the event stream instead of doing an O(log N) bisect for every lookup.  We still keep
  `get_supply` as a fallback for events that may occur before the first snapshot.
* Use that snapshot for:
  – the **Research** ability start event (upgrade‑start)
  – the **UpgradeCompleteEvent** (upgrade‑finish)
  This guarantees that the “supply” column matches what the player actually saw on screen when
  they clicked the button or when the bar finished.
* No behaviour changes for units – they continue to use `get_supply()` so chrono‑boost / larva
  injection time‑warping is still handled just like before.
"""

from flask_cors import CORS
import sc2reader
import io
import bisect
import re
from collections import defaultdict
from sc2reader.constants import GAME_SPEED_FACTOR
from name_map import NAME_MAP
from typing import List, Dict, Any, Optional


def _supply_at(frame_list: List[int], supply_list: List[int], frame: int) -> Optional[int]:
    idx = bisect.bisect_right(frame_list, frame) - 1
    return supply_list[idx] if idx >= 0 else None

def _duration_map(replay) -> Dict[int, int]:
    BLIZZARD_FPS = 16
    gd = getattr(replay, "game_data", None)
    if gd and hasattr(gd, "upgrades"):
        return {u.id: u.research_time for u in gd.upgrades.values()}
    try:
        from sc2reader.resources import build_data
        data = build_data(replay.build)
        return {u["id"]: u["research_time"] for u in data["upgrades"].values()}
    except Exception:
        pass
    L = BLIZZARD_FPS
    return {
        55: 121 * L,
        56: 121 * L,
        57: 86 * L,
        58: 79 * L,
        59: 100 * L,
        60: 100 * L,
    }

# --- approximate build times (in seconds) for units --------------
BUILD_TIME = {
    "SCV": 12,
    "Probe": 12,
    "Drone": 12,
    "Mule": 0,
    "Marine": 18,
    "Reaper": 32,
    "Marauder": 21,
    "Hellion": 21,
    "Widow Mine": 21,
    "Siege Tank": 32,
    "Cyclone": 32,
    "Thor": 43,
    "Medivac": 30,
    "Viking": 30,
    "Liberator": 43,
    "Raven": 43,
    "Banshee": 43,
    "Battlecruiser": 64,

    "Zergling": 17,
    "Baneling": 14,
    "Roach": 19,
    "Ravager": 12,
    "Hydralisk": 24,
    "Lurker": 24,
    "Mutalisk": 33,
    "Corruptor": 29,
    "Brood Lord": 34,
    "Viper": 29,
    "Ultralisk": 55,
    "Queen": 36,
    "Overlord": 18,
    "Overseer": 12,
    "Infestor": 43,
    "Swarm Host": 43,

    "Zealot": 27,
    "Adept": 27,
    "Stalker": 30,
    "Sentry": 26,
    "Observer": 21,
    "Immortal": 39,
    "Colossus": 54,
    "Disruptor": 39,
    "Phoenix": 25,
    "Void Ray": 43,
    "Oracle": 37,
    "Tempest": 57,
    "Carrier": 64,
    "Mothership": 86,
    "Archon": 9,
    "Dark Templar": 39,
    "High Templar": 39,

    # Add more if needed...
}

# --- label normalisation / filter ---------------------------------
_DROP = {
    "k d8 charge",
    "spray terran",
    "spray zerg",
    "spray protoss",
    "interceptor",          # drop Carrier interceptor rows
}

_ALIAS = {
    "overlordspeed": "Overlord speed",
    "templar archive": "Templar Archives",
    "psi storm tech": "Psionic Storm",
    "medivac caduceus reactor": "Caduceus reactor",
    "shadow strides": "Shadow Stride",
    "resonatingglaives": "Resonating Glaives",
    "infernal pre igniter": "Infernal Pre-Igniter",
    "cyclone lock on damage": "Mag-Field Accelerator",
    "hi sec auto tracking":"Hi-Sec Auto Tracking",
    "banshee speed":"Hyperflight Rotors",
    "vehicle and ship armors":"Vehicle And Ship Plaiting",
    "adept piercing attack":"Resonating Glaives",
    "anion pulse crystals": "Anion Pulse-Crystals",
    "bosonic core": "Flux Vanes",
    "gravity sling": "Tectonic Destabilizers",
}



_RE_TERRAN = re.compile(r"^terran\s+", re.I)
_RE_EVOLVE = re.compile(r"^evolve\s+", re.I)
_RE_UPGRADE = re.compile(r"\s+upgrade$", re.I)
_RE_MP_TAG = re.compile(r"\s+m\s*p\s*$", re.I)


def tidy(label: str) -> str | None:
    """Clean a unit / upgrade label. Return None to drop it."""
    low = label.lower()

    if low in _DROP:
        return None

    if low in _ALIAS:
        return _ALIAS[low]

    label = _RE_TERRAN.sub("", label)
    label = _RE_EVOLVE.sub("", label)
    label = _RE_UPGRADE.sub("", label)
    label = _RE_MP_TAG.sub("", label)

    label = re.sub(r"\s{2,}", " ", label).strip()
    if not label or label.lower() in _DROP:
        return None

    return label[0].upper() + label[1:]

# -------------------------------------------------------------------

# --- Ability/Command events helper for any sc2reader version ---
from sc2reader.events import game as ge

_ABILITY_CLASSES = []
for _name in (
    "AbilityEvent",            # pre‑2.0
    "CommandEvent",            # 2.0 alpha
    "TargetPointCommandEvent", # 2.x stable
    "TargetUnitCommandEvent",
):
    _cls = getattr(ge, _name, None)
    if _cls:
        _ABILITY_CLASSES.append(_cls)

ABILITY_EVENTS = tuple(_ABILITY_CLASSES)

# Helper for parsing upgrade ability names
UPGRADE_PREFIX = re.compile(r'^(Research|Upgrade)_?')


def prettify_upgrade(ability_name: str) -> str:
    """Return a human‑friendly upgrade name from a raw ability string."""
    core = UPGRADE_PREFIX.sub('', ability_name)
    words = re.sub(r'([a-z])([A-Z])', r'\1 \2', core)
    return words.replace('_', ' ').strip().title()


def producer_tag(ev):
    """
    Return the tag of the structure that performs the research.
    For almost all Research orders, ev.unit is the producer.
    """
    if getattr(ev, "unit", None):      # AbilityEvent / TargetUnitCommandEvent
        return ev.unit.tag
    if getattr(ev, "target", None):    # very old replays
        return ev.target.tag
    return None

# ---- Flask setup --------------------------------------------------
app = Flask(__name__)
CORS(app)


# --- helper: pretty unit names -------------------------------------

def format_name(name: str) -> str:
    """Convert internal names like 'SpawningPool' to 'Spawning Pool'."""
    if not name:
        return name
    lower = name.lower()
    if lower in NAME_MAP:
        return NAME_MAP[lower]
    # Insert space before capital letters and capitalise words
    return re.sub(r"(?<!^)(?=[A-Z])", " ", name).title()

# ------------------------------------------------------------------

@app.route('/')
def index():
    return '🟢 SC2 build‑order parser is live!'


@app.route('/players', methods=['POST'])
def players():
    if 'replay' not in request.files:
        return 'No replay uploaded', 400

    file = request.files['replay']
    if file.filename == '':
        return 'No replay uploaded', 400

    replay_data = io.BytesIO(file.read())
    try:
        # load_level=4 ensures tracker events are parsed
        replay = sc2reader.load_replay(replay_data, load_map=False, load_level=4)
    except Exception as e:
        print('❌ Failed to load replay:', e)
        return f'Failed to load replay: {e}', 400

    players = [p for p in replay.players if not p.is_observer]
    info = [{'pid': p.pid, 'name': p.name, 'race': p.play_race} for p in players]
    matchup = None
    if len(players) >= 2:
        a = players[0].play_race[0].lower()
        b = players[1].play_race[0].lower()
        matchup = f"{a}v{b}"
    return jsonify({'players': info, 'matchup': matchup})


@app.route('/upload', methods=['POST'])
def upload():
    if 'replay' not in request.files:
        return 'No replay uploaded', 400

    file = request.files['replay']
    if file.filename == '':
        return 'No replay uploaded', 400

    replay_data = io.BytesIO(file.read())
    try:
        # full load so that tracker events are available
        replay = sc2reader.load_replay(replay_data, load_map=False, load_level=4)
    except Exception as e:
        print("❌ Failed to load replay:", e)
        return f'Failed to load replay: {e}', 400

    try:
        players = [p for p in replay.players if not p.is_observer]
        if not players:
            return 'No player found in replay', 400

        # ----- player selection ------------------------------------
        requested = request.form.get('player') or request.args.get('player')
        player = next((p for p in players if requested and (str(p.pid) == requested or p.name == requested)), None)
        if player is None:
            player = players[0]

        # ----- flags ------------------------------------------------
        exclude_flag = request.form.get('exclude_workers', '')
        exclude_workers = str(exclude_flag).lower() in {'1', 'true', 'yes', 'on'}
        exclude_supply_flag = request.form.get('exclude_supply', '')
        exclude_supply = str(exclude_supply_flag).lower() in {'1', 'true', 'yes', 'on'}
        exclude_time_flag = request.form.get('exclude_time', '')
        exclude_time = str(exclude_time_flag).lower() in {'1', 'true', 'yes', 'on'}
        compact_flag = request.form.get('compact', '')
        compact = str(compact_flag).lower() in {'1', 'true', 'yes', 'on'}
        if compact:
            exclude_time = True
        stop_supply_raw = request.form.get('stop_supply')
        stop_time_raw = request.form.get('stop_time')
        stop_limit = int(stop_supply_raw) if stop_supply_raw and stop_supply_raw.isdigit() else None
        time_limit = int(stop_time_raw) * 60 if stop_time_raw and stop_time_raw.isdigit() else None

        # ----- pre‑build supply → time map (fallback look‑up) --------
        supply_events = {}
        for ev in replay.events:
            if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent) and ev.pid == player.pid:
                used = int(getattr(ev, 'food_used', 0))
                made = int(getattr(ev, 'food_made', 0))
                supply_events[ev.second] = (used, made)
        supply_times = sorted(supply_events)

        def get_supply(sec: int):
            """Return (food_used, food_made) for the closest snapshot ≤ sec."""
            if not supply_times:
                return 0, 0
            idx = bisect.bisect_right(supply_times, sec) - 1
            return supply_events[supply_times[idx]] if idx >= 0 else (0, 0)

        # ----- event filters ---------------------------------------
        skip_units = {
            "Egg", "Larva", "Overlord Cocoon", "Mule", "M U L E", "Scanner Sweep",
            "Kd8Charge", "KD8Charge", "Broodling", "Changeling",
        }
        skip_units_lower = {s.lower() for s in skip_units}
        skip_keywords = ["Creep Tumor", "CreepTumor", "Phase Shift", "PhaseShift"]
        if exclude_workers:
            skip_units.update({"Drone", "Probe", "SCV"})

        # ----- speed factor for in‑game clock -----------------------
        speed_factor = GAME_SPEED_FACTOR.get(replay.expansion, {}).get(replay.speed, 1.0)
        if replay.expansion == "LotV" and replay.speed == "Faster" and speed_factor == 1.0:
            speed_factor = 1.4

        # ---- containers -------------------------------------------
        entries = []
        init_map = {}                                          # unit_id → unit name
        chrono_until = {p.pid: 0 for p in players}
        upgrade_starts = {}

        # NEW: running supply snapshot (O(1) look‑ups) --------------
        current_used = 0
        current_made = 0
        have_stats = False

        # Pre-compute supply snapshots
        frames_by_pid: Dict[int, List[int]] = defaultdict(list)
        supply_by_pid: Dict[int, List[int]] = defaultdict(list)
        for ev in replay.tracker_events:
            if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent):
                frames_by_pid[ev.pid].append(ev.frame)
                supply_by_pid[ev.pid].append(int(ev.food_used))

        # Pre-compute upgrade durations
        durations = _duration_map(replay)


        # ---- iterate event stream --------------------------------
        for event in replay.events:
            if event.second == 0:
                continue

            # ------ capture live supply snapshot -------------------
            if isinstance(event, sc2reader.events.tracker.PlayerStatsEvent) and event.pid == player.pid:
                current_used = int(getattr(event, 'food_used', 0))
                current_made = int(getattr(event, 'food_made', 0))
                have_stats = True
                # no continue – we still want to process other events on this frame

            # ----- global stop limits ------------------------------
            game_time = int(event.second / speed_factor)  # in‑game seconds
            if time_limit is not None and game_time > time_limit:
                break
            if stop_limit is not None and current_used > stop_limit:  # uses live snapshot
                break

            # ----- Ability / command events ------------------------
            ability_raw = (
                getattr(event, "ability_name", None)
                or getattr(event, "ability_link", None)
                or getattr(event, "ability", None)
            )
            ability = str(ability_raw) if not isinstance(ability_raw, str) else ability_raw

            # Chrono Boost detection
            if ability and ability.endswith(("ChronoBoostEnergyCost", "ChronoBoost")):
                chrono_until[event.pid] = max(chrono_until.get(event.pid, 0), event.second) + 9.6 * speed_factor
                continue

            # ---- Upgrade start (Research ability) -----------------
            if ability.startswith("Research") and getattr(event, 'pid', None) == player.pid:
                name = tidy(prettify_upgrade(ability))
                if name:
                    supply_at_start = _supply_at(frames_by_pid[player.pid], supply_by_pid[player.pid], event.frame)
                    upgrade_starts[name] = {
                        'clock_sec': int(event.frame / replay.game_fps),
                        'supply': supply_at_start if supply_at_start is not None else current_used,
                        'made': current_made,
                        'unit': name,
                        'kind': 'upgrade'
                    }
                continue


            # ---- UnitBornEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitBornEvent):
                if getattr(event, "control_pid", None) != player.pid:
                    continue
                unit = event.unit
                if getattr(unit, "is_building", False):
                    continue
                name = format_name(event.unit_type_name)
                name = tidy(name)
                if name is None:
                    continue
                lower_name = name.lower()
                if (not name or "Beacon" in name or name in skip_units or lower_name in skip_units_lower or any(k.lower() in lower_name for k in skip_keywords)):
                    continue
                build_time = BUILD_TIME.get(event.unit_type_name, 0)
                start_real = event.second - build_time * speed_factor
                if player.play_race.lower() == "protoss" and start_real < chrono_until.get(player.pid, 0):
                    if start_real >= chrono_until[player.pid] - 9.6 * speed_factor:
                        start_real = event.second - build_time * 0.65 * speed_factor
                used_s, made_s = get_supply(start_real)
                if stop_limit is not None and used_s > stop_limit:
                    break
                if time_limit is not None and int(start_real / speed_factor) > time_limit:
                    break
                entries.append({'clock_sec': int(start_real / speed_factor), 'supply': used_s, 'made': made_s, 'unit': name, 'kind': 'start'})
                used_f, made_f = get_supply(event.second)
                entries.append({'clock_sec': int(event.second / speed_factor), 'supply': used_f, 'made': made_f, 'unit': name, 'kind': 'finish'})
                continue

            # ---- UnitInitEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitInitEvent):
                if event.control_pid != player.pid:
                    continue
                name = format_name(event.unit_type_name)
                name = tidy(name)
                if name is None:
                    continue
                lower_name = name.lower()
                if (not name or "Beacon" in name or name in skip_units or lower_name in skip_units_lower or any(k.lower() in lower_name for k in skip_keywords)):
                    continue
                init_map[event.unit_id] = name
                entries.append({'clock_sec': int(event.second / speed_factor), 'supply': current_used if have_stats else get_supply(event.second)[0], 'made': current_made if have_stats else get_supply(event.second)[1], 'unit': name, 'kind': 'start'})
                continue

            # ---- UnitDoneEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitDoneEvent):
                if event.unit_id in init_map:
                    name = init_map[event.unit_id]
                    entries.append({'clock_sec': int(event.second / speed_factor), 'supply': current_used if have_stats else get_supply(event.second)[0], 'made': current_made if have_stats else get_supply(event.second)[1], 'unit': name, 'kind': 'finish'})
                continue

            # ---- UpgradeCompleteEvent (corrected) -----------------------------
            if isinstance(event, sc2reader.events.tracker.UpgradeCompleteEvent):
                if event.pid != player.pid:
                    continue

                name = tidy(event.upgrade_type_name)
                if name is None:
                    continue

                entries.append({
                    "time": int(event.second / speed_factor),  # just current in-game time
                    "label": name,
                    "type": "upgrade"
                })

        # add any unmatched upgrade starts ---------------------------
        entries.extend(upgrade_starts.values())

        # keep only start rows --------------------------------------
        entries = [e for e in entries if e['kind'] in {'start', 'upgrade'}]

        # collapse identical supply+unit rows (units only) ----------
        tmp = []
        for e in sorted(entries, key=lambda x: (x['clock_sec'], x['supply'], x['unit'])):
            if (
                tmp
                and e['kind'] == 'start'
                and tmp[-1]['kind'] == 'start'
                and e['unit'] == tmp[-1]['unit']
                and e['supply'] == tmp[-1]['supply']
            ):
                tmp[-1]['count'] = tmp[-1].get('count', 1) + 1
            else:
                e['count'] = 1
                tmp.append(e)
        entries = tmp

        # final sort ------------------------------------------------
        entries.sort(key=lambda e: e['clock_sec'])

        # ----- stringify build lines -------------------------------
        build_lines = []
        if compact:
            i = 0
            n = len(entries)
            while i < n:
                first = entries[i]
                if first['kind'] == 'upgrade':
                    parts = []
                    if not exclude_supply:
                        supply_str = (
                            f"{first['supply']}/{first['made']}"
                            if first['supply'] > first['made'] and first['made'] > 0
                            else str(first['supply'])
                        )
                        parts.append(supply_str)
                    prefix = f"[{' '.join(parts)}] " if parts else ""
                    build_lines.append(prefix + first['unit'])
                    i += 1
                    continue

                supply = first['supply']
                made = first['made']
                start_time = first['clock_sec']
                units = []
                while (
                    i < n
                    and entries[i]['kind'] == 'start'
                    and entries[i]['supply'] == supply
                    and abs(entries[i]['clock_sec'] - start_time) <= 5
                ):
                    e = entries[i]
                    qty = e.get('count', 1)
                    label = f"{qty} {e['unit']}" if qty > 1 else e['unit']
                    units.append(label)
                    i += 1
                parts = []
                if not exclude_supply:
                    supply_str = (
                        f"{supply}/{made}" if supply > made and made > 0 else str(supply)
                    )
                    parts.append(supply_str)
                prefix = f"[{' '.join(parts)}] " if parts else ""
                build_lines.append(prefix + " + ".join(units))
        else:
            for item in entries:
                parts = []
                if not exclude_supply:
                    supply_str = f"{item['supply']}/{item['made']}" if item['supply'] > item['made'] and item['made'] > 0 else str(item['supply'])
                    parts.append(supply_str)
                if not exclude_time:
                    minutes, seconds = divmod(item['clock_sec'], 60)
                    parts.append(f"{minutes:02d}:{seconds:02d}")
                prefix = f"[{' '.join(parts)}] " if parts else ""
                qty = item.get('count', 1)
                label = f"{qty} {item['unit']}" if qty > 1 else item['unit']
                build_lines.append(prefix + label)

        return '\n'.join(build_lines)

    except Exception as e:
        print("❌ Error while processing events:", e)
        return f'Failed to parse replay: {e}', 500


if __name__ == '__main__':
    from waitress import serve
    serve(app, host='0.0.0.0', port=5000)
