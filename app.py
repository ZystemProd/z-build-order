from flask import Flask, request, jsonify
"""Minimal StarCraft II replay parser producing build orders."""

from flask_cors import CORS
import sc2reader
import io
import bisect
import re

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

import collections
from sc2reader.constants import GAME_SPEED_FACTOR
from name_map import NAME_MAP


# --- Ability/Command events helper for any sc2reader version ---
from sc2reader.events import game as ge

_ABILITY_CLASSES = []
for _name in (
    "AbilityEvent",            # pre-2.0
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
    """Return a human-friendly upgrade name from a raw ability string."""
    core = UPGRADE_PREFIX.sub('', ability_name)
    words = re.sub(r'([a-z])([A-Z])', r'\1 \2', core)
    return words.replace('_', ' ').strip().title()


def producer_tag(ev):
    """
    Return the tag of the structure that will perform this research.
    For TargetUnitCommandEvent / AbilityEvent the *unit* is the producer;
    .target is usually None.
    """
    if getattr(ev, "unit", None):        # primary
        return ev.unit.tag
    if getattr(ev, "target", None):      # fallback
        return ev.target.tag
    return None

# Build times in game seconds for LotV 5.x. Values are approximate. See

# Build times in game seconds for LotV 5.x. Values are approximate. See
# https://liquipedia.net/starcraft2/ for updates.
BUILD_TIME = {
    # Terran
    "SCV": 12,
    "Marine": 18,
    "Marauder": 21,
    "Reaper": 32,
    "Ghost": 29,
    "Hellion": 30,
    "Hellbat": 30,
    "Widow Mine": 28,
    "Cyclone": 32,
    "Siege Tank": 32,
    "Thor": 43,
    "Viking": 30,
    "Medivac": 30,
    "Liberator": 43,
    "Banshee": 46,
    "Raven": 43,
    "Battlecruiser": 64,

    # Protoss
    "Probe": 12,
    "Zealot": 27,
    "Stalker": 30,
    "Sentry": 26,
    "Adept": 27,
    "High Templar": 39,
    "Dark Templar": 39,
    "Immortal": 39,
    "Colossus": 54,
    "Disruptor": 39,
    "Observer": 21,
    "Warp Prism": 36,
    "Phoenix": 25,
    "Void Ray": 37,
    "Oracle": 37,
    "Tempest": 43,
    "Carrier": 64,
    "Mothership": 86,

    # Zerg
    "Drone": 12,
    "Zergling": 17,
    "Overlord": 18,
    "Queen": 36,
    "Roach": 19,
    "Ravager": 12,
    "Hydralisk": 29,
    "Lurker": 18,
    "Baneling": 14,
    "Mutalisk": 33,
    "Corruptor": 29,
    "Brood Lord": 34,
    "Infestor": 43,
    "Swarm Host": 43,
    "Ultralisk": 39,
    "Viper": 29,
    "Overseer": 17,
}

UPGRADE_TIME = {
    # Zerg
    "Metabolic Boost": 79,
    "Adrenal Glands": 93,
    "Glial Reconstitution": 79,
    "Tunneling Claws": 79,
    "Grooved Spines": 50,
    "Muscular Augments": 64,
    "Chitinous Plating": 79,
    "Anabolic Synthesis": 43,
    "Neural Parasite": 79,
    "Centrifugal Hooks": 71,
    "Burrow": 71,
    "Ground Carapace": 114,
    "Melee Attack": 114,
    "Missile Attack": 114,
    "Flyer Armor": 114,
    "Flyer Attack": 114,
    "Adaptive Talons": 57,
    "Seismic Spines": 57,
    "Pneumatized Carapace": 43,

    # Protoss
    "Warp Gate": 100,
    "Shields": 121,
    "Ground Weapons": 121,
    "Ground Armor": 121,
    "Air Weapons": 129,
    "Air Armor": 129,
    "Blink": 121,
    "Charge": 100,
    "Resonating Glaives": 100,
    "Psionic Storm": 79,
    "Anion Pulse-Crystals": 64,
    "Extended Thermal Lance": 100,
    "Gravitic Boosters": 57,
    "Gravitic Drive": 57,
    "Flux Vanes": 57,
    "Tectonic Destabilizers": 100,
    "Shadow Stride": 100,

    # Terran
    "Infantry Weapons": 114,
    "Infantry Armor": 114,
    "Vehicle Weapons": 114,
    "Ship Weapons": 114,
    "Vehicle And Ship Plating": 114,
    "Stimpack": 100,
    "Combat Shield": 79,
    "Concussive Shells": 79,
    "Infernal Pre-Igniter": 110,
    "Smart Servos": 79,
    "Drilling Claws": 79,
    "Hyperflight Rotors": 100,
    "Hi-Sec Auto Tracking": 57,
    "Hurricane Engines": 100,
    "Mag-Field Accelerator": 100,
    "Caduceus Reactor": 80,
    "Interference Matrix": 57,
    "Weapon Refit": 100,
    "Advanced Ballistics": 79,
    "Neosteel Frame": 79,

"Cloak": 79,
}

# --- legal upgrade lists -------------------------------------------------
TERRAN_UP = {
    "Infantry Weapons", "Infantry Armor", "Vehicle Weapons", "Ship Weapons",
    "Vehicle And Ship Plating", "Stimpack", "Combat Shield", "Concussive Shells",
    "Infernal Pre-Igniter", "Smart Servos", "Drilling Claws",
    "Hyperflight Rotors", "Hi-Sec Auto Tracking", "Hurricane Engines",
    "Mag-Field Accelerator", "Caduceus Reactor", "Interference Matrix",
    "Weapon Refit", "Advanced Ballistics", "Neosteel Frame", "Cloak",
}
PROTOSS_UP = {
    "Warp Gate", "Shields", "Ground Weapons", "Ground Armor", "Air Weapons",
    "Air Armor", "Blink", "Charge", "Resonating Glaives", "Psionic Storm",
    "Anion Pulse-Crystals", "Extended Thermal Lance", "Gravitic Boosters",
    "Gravitic Drive", "Flux Vanes", "Tectonic Destabilizers", "Shadow Stride",
}
ZERG_UP = {
    "Metabolic Boost", "Adrenal Glands", "Glial Reconstitution",
    "Tunneling Claws", "Grooved Spines", "Muscular Augments",
    "Chitinous Plating", "Anabolic Synthesis", "Neural Parasite",
    "Centrifugal Hooks", "Burrow", "Ground Carapace", "Melee Attack",
    "Missile Attack", "Flyer Armor", "Flyer Attack", "Adaptive Talons",
    "Seismic Spines", "Pneumatized Carapace",
}

LEGAL_BY_RACE = {
    "terran": TERRAN_UP,
    "protoss": PROTOSS_UP,
    "zerg": ZERG_UP,
}


def is_legal_upgrade(race: str, upg: str) -> bool:
    return upg in LEGAL_BY_RACE.get(race.lower(), set())

# player-pid → set of upgrades currently researching
researching_now = collections.defaultdict(set)

app = Flask(__name__)
CORS(app)


def format_name(name: str) -> str:
    """Convert internal names like 'SpawningPool' to 'Spawning Pool'."""
    if not name:
        return name
    lower = name.lower()
    if lower in NAME_MAP:
        return NAME_MAP[lower]
    # Insert space before capital letters and capitalize words
    return re.sub(r"(?<!^)(?=[A-Z])", " ", name).title()

@app.route('/')
def index():
    return '🟢 SC2 build-order parser is live!'


@app.route('/players', methods=['POST'])
def players():
    if 'replay' not in request.files:
        return 'No replay uploaded', 400

    file = request.files['replay']
    if file.filename == '':
        return 'No replay uploaded', 400

    replay_data = io.BytesIO(file.read())
    try:
        replay = sc2reader.load_replay(replay_data, load_map=False)
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

    # Read replay into memory
    replay_data = io.BytesIO(file.read())
    try:
        # Loading without map reduces parsing time and avoids verbose output
        replay = sc2reader.load_replay(replay_data, load_map=False)
    except Exception as e:
        print("❌ Failed to load replay:", e)
        return f'Failed to load replay: {e}', 400

    try:
        players = [p for p in replay.players if not p.is_observer]
        if not players:
            return 'No player found in replay', 400

        # allow player selection by name or pid
        requested = request.form.get('player') or request.args.get('player')
        player = None
        if requested:
            player = next((p for p in players if str(p.pid) == requested or p.name == requested), None)
        if player is None:
            player = players[0]

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
        stop_limit = None
        time_limit = None
        if stop_supply_raw and stop_supply_raw.isdigit():
            stop_limit = int(stop_supply_raw)
        if stop_time_raw and stop_time_raw.isdigit():
            time_limit = int(stop_time_raw) * 60

        # Build a map of supply values from PlayerStatsEvents as fallback
        supply_events = {}
        for event in replay.events:
            if isinstance(event, sc2reader.events.tracker.PlayerStatsEvent) and event.pid == player.pid:
                used = int(getattr(event, 'food_used', 0))
                made = int(getattr(event, 'food_made', 0))
                supply_events[event.second] = (used, made)
        supply_times = sorted(supply_events.keys())

        def get_supply(second: int):
            """Return (food_used, food_made) for the closest PlayerStatsEvent."""
            if not supply_times:
                return 0, 0
            idx = bisect.bisect_right(supply_times, second) - 1
            if idx >= 0:
                return supply_events[supply_times[idx]]
            return 0, 0

        skip_units = {
            "Egg",
            "Larva",
            "Overlord Cocoon",
            "Mule",
            "M U L E",
            "Scanner Sweep",
            "Kd8Charge",
            "KD8Charge",
            "Broodling",
            "Changeling",
        }
        skip_units_lower = {s.lower() for s in skip_units}
        # Skip any creep tumor variants or phase shift abilities
        skip_keywords = [
            "Creep Tumor",
            "CreepTumor",
            "Phase Shift",
            "PhaseShift",
        ]
        if exclude_workers:
            skip_units.update({"Drone", "Probe", "SCV"})



        # ``event.second`` is reported in real-time seconds. Convert it to the
        # in-game clock using the replay's speed factor. LotV replays on
        # "Faster" still require a 1.4x adjustment to match the in-game timer.
        speed_factor = GAME_SPEED_FACTOR.get(replay.expansion, {}).get(
            replay.speed, 1.0
        )
        if replay.expansion == "LotV" and replay.speed == "Faster" and speed_factor == 1.0:
            speed_factor = 1.4

        entries = []
        researching_now = collections.defaultdict(set)
        building_busy = collections.defaultdict(lambda: None)
        init_map = {}
        chrono_until = {p.pid: 0 for p in players}

        for event in replay.events:
            if event.second == 0:
                continue

            # ----- global stop limits ---------------------------------
            game_time = int(event.second / speed_factor)   # in-game seconds

            if time_limit is not None and game_time > time_limit:
                break

            if stop_limit is not None:
                used_now, _ = get_supply(event.second)
                if used_now > stop_limit:
                    break
            # -----------------------------------------------------------

            # -- Ability / command events ------------------------------------
            ability_raw = (
                getattr(event, "ability_name", None)
                or getattr(event, "ability_link", None)
                or getattr(event, "ability", None)
            )

            # Skip or cast non-string values
            if not isinstance(ability_raw, str):
                ability_raw = str(ability_raw)

            ability = ability_raw

            if ability:
                # Chrono Boost detection
                if ability.endswith(("ChronoBoostEnergyCost", "ChronoBoost")):
                    chrono_until[event.pid] = max(
                        chrono_until.get(event.pid, 0), event.second
                    ) + 9.6 * speed_factor
                    continue

                # Upgrade research start
                if ability.startswith("Research"):

                    # --- skip if this is just a queued copy ---------------------
                    tag = producer_tag(event)
                    building_already_busy = tag and building_busy.get(tag) is not None

                    is_queued = (
                        getattr(event, "queued", False)          # modern flag
                        or (getattr(event, "flags", 0) & 0x1)    # legacy queued bit
                        or building_already_busy                 # producer busy
                    )
                    if is_queued:
                        continue
                    # ------------------------------------------------------------

                    # 5-b race-gate
                    raw_name = prettify_upgrade(ability)
                    upg_name = tidy(raw_name)
                    if upg_name is None or not is_legal_upgrade(player.play_race, upg_name):
                        continue

                    # 5-c skip if building is busy
                    tag = producer_tag(event)
                    if tag and building_busy[tag] is not None:
                        continue

                    # 5-d record start row
                    used, made = get_supply(event.second)
                    entries.append(
                        dict(
                            clock_sec=int(event.second / speed_factor),
                            supply=used,
                            made=made,
                            unit=upg_name,
                            kind="start",
                        )
                    )
                    researching_now[player.pid].add(upg_name)
                    if tag:
                        building_busy[tag] = upg_name
                    continue
            # ----------------------------------------------------------------

            if isinstance(event, sc2reader.events.tracker.UnitBornEvent):
                if getattr(event, "control_pid", None) != player.pid:
                    continue
                unit = event.unit
                is_building = getattr(unit, "is_building", False)
                if is_building:
                    continue
                name = format_name(event.unit_type_name)
                name = tidy(name)
                if name is None:
                    continue
                lower_name = name.lower()
                if (
                    not name
                    or "Beacon" in name
                    or name in skip_units
                    or lower_name in skip_units_lower
                    or any(key.lower() in lower_name for key in skip_keywords)
                ):
                    continue
                build_time = BUILD_TIME.get(event.unit_type_name, 0)
                start_real = event.second - build_time * speed_factor
                if player.play_race.lower() == "protoss" and start_real < chrono_until.get(player.pid, 0):
                    if start_real >= chrono_until[player.pid] - 9.6 * speed_factor:
                        start_real = event.second - build_time * 0.65 * speed_factor
                used, made = get_supply(start_real)
                if stop_limit is not None and used > stop_limit:
                    break
                if time_limit is not None and int(start_real / speed_factor) > time_limit:
                    break
                entries.append({
                    "clock_sec": int(start_real / speed_factor),
                    "supply": used,
                    "made": made,
                    "unit": name,
                    "kind": "start",
                })
                used_finish, made_finish = get_supply(event.second)
                entries.append({
                    "clock_sec": int(event.second / speed_factor),
                    "supply": used_finish,
                    "made": made_finish,
                    "unit": name,
                    "kind": "finish",
                })
                continue

            if isinstance(event, sc2reader.events.tracker.UnitInitEvent):
                if event.control_pid != player.pid:
                    continue
                name = format_name(event.unit_type_name)
                name = tidy(name)
                if name is None:
                    continue
                lower_name = name.lower()
                if (
                    not name
                    or "Beacon" in name
                    or name in skip_units
                    or lower_name in skip_units_lower
                    or any(key.lower() in lower_name for key in skip_keywords)
                ):
                    continue
                used, made = get_supply(event.second)
                init_map[event.unit_id] = name
                entries.append({
                    "clock_sec": int(event.second / speed_factor),
                    "supply": used,
                    "made": made,
                    "unit": name,
                    "kind": "start",
                })
                continue

            if isinstance(event, sc2reader.events.tracker.UnitDoneEvent):
                if event.unit_id in init_map:
                    name = init_map[event.unit_id]
                    used, made = get_supply(event.second)
                    entries.append({
                        "clock_sec": int(event.second / speed_factor),
                        "supply": used,
                        "made": made,
                        "unit": name,
                        "kind": "finish",
                    })
                continue

                if isinstance(event, sc2reader.events.tracker.UpgradeCompleteEvent):
                    name = tidy(format_name(event.upgrade_type_name))
                    if name is None or not is_legal_upgrade(player.play_race, name):
                        continue

                    # skip if we never logged a start
                    if name not in researching_now[player.pid]:
                        continue
                    # free whichever building was researching this upgrade
                    for t, up in list(building_busy.items()):
                        if up == name:
                            del building_busy[t]

                    researching_now[player.pid].discard(name)

                    # optional finish row (kept for debug, later filtered)
                    used, made = get_supply(event.second)
                    entries.append(
                        dict(
                            clock_sec=int(event.second / speed_factor),
                            supply=used,
                            made=made,
                            unit=name,
                            kind="finish",
                        )
                    )
                    continue   # (rest of branch unchanged)


        entries = [e for e in entries if e.get("kind") == "start"]

        # ----- collapse identical unit/supply rows ------------------
        # assumes entries are still unsorted; we'll sort after grouping
        tmp = []

        for e in sorted(entries, key=lambda x: (x["clock_sec"], x["supply"], x["unit"])):
            if (
                tmp
                and e["unit"] == tmp[-1]["unit"]
                and e["supply"] == tmp[-1]["supply"]
            ):
                # same unit & supply → bump count
                tmp[-1]["count"] = tmp[-1].get("count", 1) + 1
            else:
                e["count"] = 1
                tmp.append(e)

        entries = tmp
        # ----------------------------------------------------------------

        entries.sort(key=lambda e: e['clock_sec'])

        build_lines = []

        if compact:
            i = 0
            n = len(entries)
            while i < n:
                first = entries[i]
                supply = first['supply']
                made = first['made']
                start_time = first['clock_sec']
                units = []
                while i < n and entries[i]['supply'] == supply and abs(entries[i]['clock_sec'] - start_time) <= 5:
                    e = entries[i]
                    qty = e.get("count", 1)
                    label = f"{qty} {e['unit']}" if qty > 1 else e['unit']
                    units.append(label)
                    i += 1
                parts = []
                if not exclude_supply:
                    supply_str = str(supply)
                    if supply > made and made > 0:
                        supply_str = f"{supply}/{made}"
                    parts.append(supply_str)
                prefix = f"[{' '.join(parts)}] " if parts else ""
                build_lines.append(prefix + " + ".join(units))
        else:
            for item in entries:
                parts = []
                if not exclude_supply:
                    supply_str = str(item['supply'])
                    if item['supply'] > item['made'] and item['made'] > 0:
                        supply_str = f"{item['supply']}/{item['made']}"
                    parts.append(supply_str)
                if not exclude_time:
                    minutes = item['clock_sec'] // 60
                    seconds = item['clock_sec'] % 60
                    parts.append(f"{minutes:02d}:{seconds:02d}")
                prefix = f"[{' '.join(parts)}] " if parts else ""
                qty = item.get("count", 1)
                label = f"{qty} {item['unit']}" if qty > 1 else item['unit']
                build_lines.append(prefix + label)

        return '\n'.join(build_lines)

    except Exception as e:
        print("❌ Error while processing events:", e)
        return f'Failed to parse replay: {e}', 500

if __name__ == '__main__':
    from waitress import serve
    serve(app, host='0.0.0.0', port=5000)
