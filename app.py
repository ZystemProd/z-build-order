from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io
import bisect

app = Flask(__name__)
CORS(app)

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
        replay = sc2reader.load_replay(replay_data, load_map=True)
    except Exception as e:
        print('❌ Failed to load replay:', e)
        return f'Failed to load replay: {e}', 400

    players = [p for p in replay.players if not p.is_observer]
    info = [{'pid': p.pid, 'name': p.name, 'race': p.play_race} for p in players]
    return jsonify(info)

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
        # Register supply plugin so we can track supply counts
        from sc2reader.engine.plugins.supply import SupplyTracker
        # Older versions of this plugin are missing a 'name' attribute which
        # the GameEngine expects when registering plugins. Add one if needed.
        if not hasattr(SupplyTracker, "name"):
            SupplyTracker.name = "SupplyTracker"
        if not any(getattr(p, "name", "") == "SupplyTracker" for p in sc2reader.engine.plugins()):
            sc2reader.engine.register_plugin(SupplyTracker())
        replay = sc2reader.load_replay(replay_data, load_map=True)
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
        stop_supply_raw = request.form.get('stop_supply')
        stop_limit = None
        if stop_supply_raw and stop_supply_raw.isdigit():
            stop_limit = int(stop_supply_raw)

        # Build a map of supply values from PlayerStatsEvents as fallback
        supply_events = {}
        for event in replay.events:
            if isinstance(event, sc2reader.events.tracker.PlayerStatsEvent) and event.pid == player.pid:
                used = int(getattr(event, 'food_used', 0))
                made = int(getattr(event, 'food_made', 0))
                supply_events[event.second] = (used, made)
        supply_times = sorted(supply_events.keys())

        def get_supply(second: int):
            used = made = 0
            if hasattr(player, 'current_food_used') and hasattr(player, 'current_food_made'):
                store_u = player.current_food_used
                store_m = player.current_food_made
                if isinstance(store_u, dict) and isinstance(store_m, dict):
                    if second in store_u:
                        used = int(store_u[second])
                    if second in store_m:
                        made = int(store_m[second])
                else:
                    if isinstance(store_u, list) and isinstance(store_m, list):
                        for t, val in store_u:
                            if t == second:
                                used = int(val)
                                break
                        for t, val in store_m:
                            if t == second:
                                made = int(val)
                                break
            if used == 0 and not supply_times:
                return 0, 0
            if used == 0:
                idx = bisect.bisect_right(supply_times, second) - 1
                if idx >= 0:
                    used, made = supply_events[supply_times[idx]]
            return used, made

        skip_units = {"Egg", "Larva", "Overlord Cocoon"}
        if exclude_workers:
            skip_units.update({"Drone", "Probe", "SCV"})

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
            if not name or 'Beacon' in name or name in skip_units:
                continue

            supply_used, supply_made = get_supply(event.second)
            if stop_limit is not None and supply_used > stop_limit:
                break
            minutes = event.second // 60
            seconds = event.second % 60
            timestamp = f"{minutes:02d}:{seconds:02d}"

            if entries and entries[-1]['supply'] == supply_used and entries[-1]['time'] == timestamp and entries[-1]['unit'] == name:
                entries[-1]['count'] += 1
            else:
                entries.append({'supply': supply_used, 'made': supply_made, 'time': timestamp, 'unit': name, 'count': 1})

        build_lines = [f"Build Order for {player.name} ({player.play_race})"]

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
    app.run(host='0.0.0.0', port=5000)
