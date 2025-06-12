from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io
import bisect
import re
from sc2reader.constants import GAME_SPEED_FACTOR
from name_map import NAME_MAP

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
    return '🟢 SC2 Replay Parser is live!'


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
        # Skip any creep tumor variants or chrono boost abilities
        skip_keywords = [
            "Creep Tumor",
            "CreepTumor",
            "Chrono",
            "Phase Shift",
            "PhaseShift",
        ]
        if exclude_workers:
            skip_units.update({"Drone", "Probe", "SCV"})



        # Convert the raw frame count into in-game seconds.
        # sc2reader reports ``event.second`` based on a 16 FPS reference which
        # does not always match the actual game speed.  Derive the correct
        # frames-per-second using the replay expansion and speed, falling back
        # to sc2reader's default ``game_fps`` when information is missing.
        fps = getattr(replay, "game_fps", 16.0)
        speed_factor = GAME_SPEED_FACTOR.get(replay.expansion, {}).get(
            replay.speed, 1.0
        )
        # LotV replays require an additional 1.4x multiplier even when
        # ``GAME_SPEED_FACTOR`` returns ``1.0`` for "Faster".
        if replay.expansion == "LotV" and replay.speed == "Faster" and speed_factor == 1.0:
            speed_factor = 1.4
        fps *= speed_factor

        entries = []

        for event in replay.events:
            if event.second == 0:
                continue
            etype = None
            name = None

            if isinstance(event, sc2reader.events.tracker.UnitBornEvent):
                etype = 'unit'
                name = event.unit_type_name
            elif isinstance(event, sc2reader.events.tracker.UnitInitEvent):
                etype = 'building'
                name = event.unit_type_name
            elif isinstance(event, sc2reader.events.tracker.UpgradeCompleteEvent):
                etype = 'upgrade'
                name = event.upgrade_type_name
            else:
                continue

            if getattr(event, 'control_pid', getattr(event, 'pid', None)) != player.pid:
                continue
            lower_name = name.lower()
            if (
                not name
                or 'Beacon' in name
                or 'Spray' in name
                or name in skip_units
                or lower_name in skip_units_lower
                or any(key.lower() in lower_name for key in skip_keywords)
            ):
                continue

            name = format_name(name)
            ln = name.lower()
            if ln.startswith("terran "):
                name = name[7:]
            elif ln.startswith("evolve "):
                name = name[7:]

            # Convert the event frame to in-game seconds using the derived FPS
            game_sec = int(event.frame / fps)
            if time_limit is not None and game_sec > time_limit:
                break

            supply_used, supply_made = get_supply(event.second)
            if stop_limit is not None and supply_used > stop_limit:
                break

            minutes = game_sec // 60
            seconds = game_sec % 60
            timestamp = f"{minutes:02d}:{seconds:02d}"

            if entries and entries[-1]['supply'] == supply_used and entries[-1]['unit'] == name:
                # Combine consecutive events for the same unit/building at the
                # same supply regardless of slight timestamp differences.
                entries[-1]['count'] += 1
            else:
                entries.append({'supply': supply_used, 'made': supply_made, 'time': timestamp, 'secs': game_sec, 'unit': name, 'count': 1})

        build_lines = []

        if compact:
            i = 0
            n = len(entries)
            while i < n:
                first = entries[i]
                supply = first['supply']
                made = first['made']
                start_time = first['secs']
                units = []
                while i < n and entries[i]['supply'] == supply and entries[i]['secs'] - start_time <= 5:
                    e = entries[i]
                    count_part = f"{e['count']} " if e['count'] > 1 else ""
                    units.append(f"{count_part}{e['unit']}")
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
                    parts.append(item['time'])
                prefix = f"[{' '.join(parts)}] " if parts else ""
                count_part = f"{item['count']} " if item['count'] > 1 else ""
                build_lines.append(f"{prefix}{count_part}{item['unit']}")

        return '\n'.join(build_lines)

    except Exception as e:
        print("❌ Error while processing events:", e)
        return f'Failed to parse replay: {e}', 500

if __name__ == '__main__':
    from waitress import serve
    serve(app, host='0.0.0.0', port=5000)
