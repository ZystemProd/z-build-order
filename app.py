from flask import Flask, request
from flask_cors import CORS
import sc2reader
from sc2reader.engine.plugins import SupplyTracker
import io

app = Flask(__name__)
CORS(app)

sc2reader.engine.register_plugin(SupplyTracker())

@app.route('/upload', methods=['POST'])
def upload():
    if 'replay' not in request.files:
        return 'No replay uploaded', 400
    file = request.files['replay']
    if file.filename == '':
        return 'No replay uploaded', 400

    # Read into BytesIO for sc2reader
    replay_data = io.BytesIO(file.read())
    try:
        replay = sc2reader.load_replay(replay_data, load_map=True)
    except Exception as e:
        return f'Failed to load replay: {e}', 400

    player = next((p for p in replay.players if not p.is_observer), None)
    if player is None:
        return 'No player found in replay', 400

    build_lines = []
    for event in replay.events:
        if isinstance(event, sc2reader.events.tracker.UnitBornEvent) and event.control_pid == player.pid:
            supply = int(player.current_food_used.get(event.second, 0))
            build_lines.append(f'[{supply}] {event.unit_type_name}')

    return '\n'.join(build_lines)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
