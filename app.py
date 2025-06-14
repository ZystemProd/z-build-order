# ────────────────────────────────────────────────────────────────────
#  StarCraft II replay parser – accurate command-time build-orders
#  (load_map flag removed so ability names are available)
# ────────────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify
from flask_cors import CORS
import sc2reader
import io, bisect, re, os

# optional prettifiers; falls back safely when file is absent
try:
    from name_map import NAME_MAP        # {'spawningpool': 'Spawning Pool', …}
except ImportError:
    NAME_MAP = {}

# ── helpers ─────────────────────────────────────────────────────────
def pretty(raw: str) -> str:
    if not raw:
        return raw
    return NAME_MAP.get(raw.lower(),
                        re.sub(r'(?<!^)(?=[A-Z])', ' ', raw).title())

clock   = lambda s: f'{s//60:02d}:{s%60:02d}'
truthy  = lambda v: (v or '').lower() in {'1', 'true', 'yes', 'on'}

# ── app ─────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route('/')
def root():
    return '🟢 SC2 replay parser running'


# -------------------------------------------------------------------
#  /players – list players & matchup
# -------------------------------------------------------------------
@app.route('/players', methods=['POST'])
def players():
    f = request.files.get('replay')
    if not f or not f.filename:
        return 'No replay uploaded', 400

    # ▼▼  load_map flag **removed**  ▼▼
    replay = sc2reader.load_replay(io.BytesIO(f.read()))
    roster = [p for p in replay.players if not p.is_observer]
    info   = [{'pid': p.pid, 'name': p.name, 'race': p.play_race} for p in roster]

    matchup = None
    if len(roster) >= 2:
        a, b = roster[0].play_race[0].lower(), roster[1].play_race[0].lower()
        matchup = f'{a}v{b}'
    return jsonify({'players': info, 'matchup': matchup})


# -------------------------------------------------------------------
#  /upload – build-order endpoint
# -------------------------------------------------------------------
@app.route('/upload', methods=['POST'])
def upload():
    f = request.files.get('replay')
    if not f or not f.filename:
        return 'No replay uploaded', 400

    # ▼▼  load_map flag **removed**  ▼▼
    try:
        replay = sc2reader.load_replay(io.BytesIO(f.read()))
    except Exception as e:
        return f'Failed to load replay: {e}', 400

    contenders = [p for p in replay.players if not p.is_observer]
    if not contenders:
        return 'No active players', 400
    req   = request.values.get('player')
    player = next((p for p in contenders if str(p.pid) == req or p.name == req),
                  contenders[0])

    excl_workers = truthy(request.values.get('exclude_workers'))
    excl_supply  = truthy(request.values.get('exclude_supply'))
    excl_time    = truthy(request.values.get('exclude_time'))
    compact      = truthy(request.values.get('compact'))
    stop_supply  = int(request.values.get('stop_supply', 0) or 0) or None
    stop_time    = int(request.values.get('stop_time', 0) or 0) * 60 or None

    # ── supply lookup ───────────────────────────────────────────────
    supply_ev = {}
    for ev in replay.tracker_events:
        if isinstance(ev, sc2reader.events.tracker.PlayerStatsEvent) and ev.pid == player.pid:
            supply_ev[ev.second] = (int(ev.food_used), int(ev.food_made))
    times = sorted(supply_ev)
    supply_at = lambda s: supply_ev[times[bisect.bisect_right(times, s)-1]] if times else (0, 0)

    # ── skip lists ──────────────────────────────────────────────────
    skip_units = {'Egg','Larva','Overlord Cocoon','Broodling','Changeling',
                  'Mule','M U L E','Scanner Sweep','Kd8Charge','KD8Charge'}
    if excl_workers:
        skip_units |= {'Probe','SCV','Drone'}
    skip_kw = {'creep tumor','chronoboost','phase shift','reward','dance'}

    def clean(ability: str) -> str:
        for p in ('Train ','WarpIn ','Warp In ','Build Protoss ','Build Terran ',
                  'Build Zerg ','Build ','Research ','Morph ','Upgrade to '):
            if ability.startswith(p):
                return ability[len(p):]
        return ability

    # ── extract commands (start times) ──────────────────────────────
    order = []
    for ev in replay.game_events:
        if ev.second < 0 or ev.pid != player.pid:
            continue
        if not isinstance(ev, (sc2reader.events.game.DataCommandEvent,
                               sc2reader.events.game.TargetUnitCommandEvent)):
            continue

        ab = ev.ability.name if ev.ability else getattr(ev, 'ability_name', '')
        if not ab or ab.startswith('Cancel'):
            continue
        if any(k in ab.lower() for k in skip_kw):
            continue

        unit = clean(ab)
        if unit in skip_units or unit.lower() in skip_units:
            continue

        used, cap = supply_at(ev.second)
        if stop_supply and used > stop_supply:
            break
        if stop_time   and ev.second > stop_time:
            break

        order.append({'secs': ev.second,
                      'time': clock(ev.second),
                      'supply': used, 'cap': cap,
                      'unit': pretty(unit)})

    # ── format output ───────────────────────────────────────────────
    lines = []
    if compact:
        i, n = 0, len(order)
        while i < n:
            fst = order[i]; sup, t0 = fst['supply'], fst['secs']
            units, j = [], i
            while j < n and order[j]['supply'] == sup and order[j]['secs']-t0 <= 5:
                units.append(order[j]['unit']); j += 1
            pre = ''
            if not excl_supply:
                pre += f'[{sup}/{fst["cap"] if sup > fst["cap"] else sup}] '
            if not excl_time:
                pre += f'[{clock(t0)}] '
            lines.append(pre + ' + '.join(units)); i = j
    else:
        for e in order:
            parts = []
            if not excl_supply:
                parts.append(f'{e["supply"]}/{e["cap"]}' if e["supply"] > e["cap"] else str(e["supply"]))
            if not excl_time:
                parts.append(e['time'])
            pre = f'[{" ".join(parts)}] ' if parts else ''
            lines.append(pre + e['unit'])

    return '\n'.join(lines), 200


# ── entrypoint for Render / local ------------------------------------------------
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 5000))
    try:
        from waitress import serve
        serve(app, host='0.0.0.0', port=PORT)
    except ImportError:
        app.run(host='0.0.0.0', port=PORT, debug=True)
