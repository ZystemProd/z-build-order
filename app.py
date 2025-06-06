from flask import Flask, request
from flask_cors import CORS
import sc2reader
import io
import bisect

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return '🟢 SC2 Replay Parser is live!'

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
        if not any(isinstance(p, SupplyTracker) for p in sc2reader.engine.plugins()):
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

        # Build a map of supply values from PlayerStatsEvents as fallback
        supply_events = {}
        for event in replay.events:
            if isinstance(event, sc2reader.events.tracker.PlayerStatsEvent) and event.pid == player.pid:
                supply_events[event.second] = int(event.food_used)
        supply_times = sorted(supply_events.keys())

        def get_supply(second: int) -> int:
            # try plugin data first
            if hasattr(player, 'current_food_used'):
                if isinstance(player.current_food_used, dict):
                    if second in player.current_food_used:
                        return int(player.current_food_used[second])
                else:
                    for t, val in player.current_food_used:
                        if t == second:
                            return int(val)
            # fallback to nearest PlayerStatsEvent at or before this second
            if not supply_times:
                return 0
            idx = bisect.bisect_right(supply_times, second) - 1
            if idx >= 0:
                return supply_events[supply_times[idx]]
            return 0

        skip_units = {"Egg", "Larva", "Overlord Cocoon"}
        build_lines = [f"Build Order for {player.name} ({player.play_race})"]

        for event in replay.events:
            if isinstance(event, sc2reader.events.tracker.UnitBornEvent):
                if event.control_pid != player.pid:
                    continue
                if not event.unit_type_name or 'Beacon' in event.unit_type_name:
                    continue
                if event.unit_type_name in skip_units:
                    continue

                supply = get_supply(event.second)
                minutes = event.second // 60
                seconds = event.second % 60
                timestamp = f"{minutes:02d}:{seconds:02d}"
                build_lines.append(f"[{supply}] [{timestamp}] {event.unit_type_name}")

        return '\n'.join(build_lines)

    except Exception as e:
        print("❌ Error while processing events:", e)
        return f'Failed to parse replay: {e}', 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
