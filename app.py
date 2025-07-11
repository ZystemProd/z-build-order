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

import sc2reader.events.game as ge

ABILITY_EVENTS = (
    ge.CommandEvent,
    ge.TargetPointCommandEvent,
    ge.TargetUnitCommandEvent,
    ge.BasicCommandEvent
)


UPGRADE_PREFIX = re.compile(r'^(Research|ResearchTech|Upgrade)_?')
HALLUCINATION_WINDOW_FRAMES = 60  # tolerance for matching spawned illusions
HALLUCINATED_TYPES = {
    "Phoenix",
    "Oracle"
}

HALLUCINATED_TYPE_COUNTS = {
    "Phoenix": 1,
    "Oracle": 1,
}

has_stargate = False

upgrade_name_map = {
    "HighCapacityBarrels": "Infernal Pre-Igniter",
    "InterferenceMatrix": "Interference Matrix",
    "ShieldWall": "Combat Shield",
    "CycloneLockOnDamageUpgrade": "Mag-Field Accelerator",
    "PersonalCloaking": "Personal Cloaking",
    "BansheeSpeed": "Hyperflight Rotors",
    "PunisherGrenades": "Concussive Shells",
    "BansheeCloak": "Cloaking Field",
    "DrillClaws": "Drilling Claws",
    "HiSecAutoTracking": "Hi-Sec Auto Tracking",
    "SmartServos": "Smart Servos",
    "BattlecruiserEnableSpecializations": "Weapon Refit",
    "TerranBuildingArmor": "Neosteel Armor",
    "MedivacCaduceusReactor": "Caduceus Reactor",
    "LiberatorAGRangeUpgrade": "Advanced Ballistics",
    "TerranInfantryWeaponsLevel1": "Infantry Weapons L1",
    "WarpGateResearch": "Research Warp Gate",
    "PsiStormTech": "Psionic Storm",
    "BlinkTech": "Blink",
    "DarkTemplarBlinkUpgrade": "Shadow Stride",
    "ObserverGraviticBooster": "Gravitic Boosters",
    "AdeptPiercingAttack": "Resonating Glaives",
    "GraviticDrive": "Gravitic Drive",
    "PhoenixRangeUpgrade": "Anion Pulse-Crystals",
    "ExtendedThermalLance": "Extended Thermal Lance",
    "VoidRaySpeedUpgrade": "Flux Vanes",
    "TempestGroundAttackUpgrade": "Tectonic Destabilizers",
    "Zerglingmovementspeed": "Metabolic Boost",
    "GlialReconstitution": "Glial Reconstitution",
    "TunnelingClaws": "Tunneling Claws",
    "EvolveGroovedSpines": "Grooved Spines",
    "NeuralParasite": "Neural Parasite",
    "EvolveMuscularAugments": "Muscular Augments",
    "Frenzy": "Nanomuscular Swell",
    "LurkerRange": "Seismic Spines",
    "CentrificalHooks": "Centrifugal Hooks",
    "Zerglingattackspeed": "Adrenal Glands",
    "ChitinousPlating": "Chitinous Plating",
    "DiggingClaws": "Adaptive Talons",
    "AnabolicSynthesis": "Anabolic Synthesis",
    "BarracksTechLab": "Tech Lab on Barracks",
    "Barracks Tech Lab": "Tech Lab on Barracks",
    "BarracksReactor": "Reactor on Barracks",
    "Barracks Reactor": "Reactor on Barracks", 
    "FactoryTechLab": "Tech Lab on Factory",
    "Factory Tech Lab": "Tech Lab on Factory",
    "FactoryReactor": "Reactor on Factory",
    "Factory Reactor": "Reactor on Factory",
    "StarportTechLab": "Tech Lab on Starport",
    "Starport Tech Lab": "Tech Lab on Starport",
    "StarportReactor": "Reactor on Starport",
    "Starport Reactor": "Reactor on Starport",
    "TerranShipWeaponsLevel1": "Ship Weapons L1",    
    "TerranShipWeaponsLevel2": "Ship Weapons L2", 
    "TerranShipWeaponsLevel3": "Ship Weapons L3",         
    "TerranInfantryArmorsLevel1": "Infantry Armor L1",
    "TerranInfantryArmorsLevel2": "Infantry Armor L2",
    "TerranInfantryArmorsLevel3": "Infantry Armor L3",
    "TerranInfantryWeaponsLevel1": "Infantry Weapons L1",
    "TerranInfantryWeaponsLevel2": "Infantry Weapons L2",
    "TerranInfantryWeaponsLevel3": "Infantry Weapons L3",
    "ZergMissileWeaponsLevel1": "Missile Attacks L1",
    "ZergMissileWeaponsLevel2": "Missile Attacks L2", 
    "ZergMissileWeaponsLevel3": "Missile Attacks L3", 
    "ZergMeleeWeaponsLevel1": "Melee Attacks L1",
    "ZergMeleeWeaponsLevel2": "Melee Attacks L2",
    "ZergMeleeWeaponsLevel3": "Melee Attacks L3", 
    "ZergFlyerWeaponsLevel1": "Flyer Attacks L1",
    "ZergFlyerWeaponsLevel2": "Flyer Attacks L2",
    "ZergFlyerWeaponsLevel3": "Flyer Attacks L3",
    "ZergFlyerArmorsLevel1": "Flyer Carapace L1",
    "ZergFlyerArmorsLevel2": "Flyer Carapace L2",
    "ZergFlyerArmorsLevel3": "Flyer Carapace L3",                  
    "ZergGroundArmorsLevel1": "Ground Carapace L1",
    "ZergGroundArmorsLevel2": "Ground Carapace L2",
    "ZergGroundArmorsLevel3": "Ground Carapace L3",        
    "ProtossGroundWeaponsLevel1": "Ground Weapons L1",
    "ProtossGroundWeaponsLevel2": "Ground Weapons L2",
    "ProtossGroundWeaponsLevel3": "Ground Weapons L3",
    "ProtossGroundArmorsLevel1": "Ground Armor L1",
    "ProtossGroundArmorsLevel2": "Ground Armor L2",
    "ProtossGroundArmorsLevel3": "Ground Armor L3",
    "ProtossShieldsLevel1": "Shields L1",
    "ProtossShieldsLevel2": "Shields L2",
    "ProtossShieldsLevel3": "Shields L3",
    "ProtossAirWeaponsLevel1": "Air Weapons L1",
    "ProtossAirWeaponsLevel2": "Air Weapons L2",
    "ProtossAirWeaponsLevel3": "Air Weapons L3",
    "ProtossAirArmorsLevel1": "Air Armors L1",
    "ProtossAirArmorsLevel2": "Air Armors L2", 
    "ProtossAirArmorsLevel3": "Air Armors L3",         
}

upgrade_times = {
    # Terran
    "Stimpack": 100,
    "Infernal Pre-Igniter": 79,
    "Mag-Field Accelerator": 100,
    "Drilling Claws": 79,
    "Smart Servos": 100,
    "Hi-Sec Auto Tracking": 57,
    "Combat Shield": 79,
    "Concussive Shells": 43,
    "Hyperflight Rotors": 100,
    "Interference Matrix": 57,
    "Weapon Refit": 100,
    "Neosteel Armor": 100,
    "Advanced Ballistics": 79,
    "Infantry Weapons L1": 114,
    "Infantry Weapons L2": 136,
    "Infantry Weapons L3": 157,
    "Infantry Armor L1": 114,
    "Infantry Armor L2": 136,
    "Infantry Armor L3": 157,
    "Ship Weapons L1": 114,
    "Ship Weapons L2": 136,
    "Ship Weapons L3": 157,
    "Vehicle And Ship Plaiting L1": 114,
    "Vehicle And Ship Plaiting L2": 136,
    "Vehicle And Ship Plaiting L3": 157,
    "Vehicle Weapons L1": 114,
    "Vehicle Weapons L2": 136,
    "Vehicle Weapons L3": 157,
    "Cloaking Field": 79,
    "Personal Cloaking": 86,
    "Caduceus Reactor": 50,
    # Zerg
    "Melee Attacks L1": 114,
    "Melee Attacks L2": 136,
    "Melee Attacks L3": 157, 
    "Missle Attacks L1": 114,
    "Missle Attacks L2": 136,
    "Missle Attacks L3": 157,
    "Ground Carapace L1": 114,
    "Ground Carapace L2": 136,
    "Ground Carapace L3": 157,
    "Flyer Armor L1": 114,
    "Flyer Armor L2": 136,
    "Flyer Armor L3": 157,
    "Flyer Attacks L1": 114,
    "Flyer Attacks L1": 136,
    "Flyer Attacks L1": 157,
    "Overlord Speed": 43,
    "Metabolic Boost": 79,
    "Adrenal Glands": 93,
    "Glial Reconstitution": 79,
    "Tunneling Claws": 79,
    "Grooved Spines": 50,
    "Muscular Augments": 64,
    "Chitinous Plating": 43,
    "Anabolic Synthesis": 79,
    "Neural Parasite": 79,
    "Centrifugal Hooks": 71,
    "Burrow": 71,
    "Nanomuscular Swell": 64,
    "Seismic Spines": 57,
    "Adaptive Talons": 57,
    # Protoss
    "Ground Weapons L1": 121,
    "Ground Weapons L2": 145,
    "Ground Weapons L3": 168,
    "Ground Armor L1": 121,
    "Ground Armor L2": 145,
    "Ground Armor L3": 168,
    "Shields L1": 121,
    "Shields L2": 145,
    "Shields L3": 168,
    "Air Armor L1": 129,
    "Air Armor L2": 154,
    "Air Armor L3": 179,
    "Air Weapons L1": 129,
    "Air Weapons L2": 154, 
    "Air Weapons L3": 179,            
    "Research Warp Gate": 100,
    "Psionic Storm": 79,
    "Blink": 121,
    "Charge": 100,
    "Shadow Stride": 100,
    "Gravitic Boosters": 57,
    "Resonating Glaives": 100,
    "Anion Pulse-Crystals": 64,
    "Gravitic Drive": 57,
    "Extended Thermal Lance": 100,
    "Flux Vanes": 57,
    "Tectonic Destabilizers": 100
}



def _supply_at(frame_list: List[int], supply_list: List[int], frame: int) -> Optional[int]:
    idx = bisect.bisect_right(frame_list, frame) - 1
    return supply_list[idx] if idx >= 0 else None


def frame_to_ingame_seconds(frame: int, replay) -> float:
    """
    Convert frame number to in-game seconds, corrected for SC2 speed.
    Example: event.frame → seconds in-game.
    """
    fps = replay.game_fps
    # Get SC2 in-game speed factor
    speed_factor = GAME_SPEED_FACTOR.get(replay.expansion, {}).get(replay.speed, 1.0)
    if replay.expansion == "LotV" and replay.speed == "Faster" and speed_factor == 1.0:
        speed_factor = 1.4

    real_seconds = frame / fps
    in_game_seconds = real_seconds / speed_factor
    return in_game_seconds

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
    "Adept": 30,
    "Stalker": 27,
    "Sentry": 23,
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
    "sprayterran",
    "sprayzerg",
    "sprayprotoss",
    "interceptor",   
    "oracle stasis trap",
    "phased",   
    "wings",  
    "shield", 
    "auto turret",
    "fighter", 
    "invisible target dummy",
    "broodling escort",
    "parasitic bomb relay dummy",
    "parasitic bomb dummy",
    "changeling zealot",
    "changeling zergling",
    "changeling marine",
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

# Helper for parsing upgrade ability names
UPGRADE_PREFIX = re.compile(r'^(Research|ResearchTech|Upgrade)_?')

def prettify_upgrade(ability_name: str) -> str:
    """Return a human‑friendly upgrade name from a raw ability string."""
    core = UPGRADE_PREFIX.sub('', ability_name)
    words = re.sub(r'([a-z])([A-Z])', r'\1 \2', core)
    return words.replace('_', ' ').strip().title()


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

def base_unit_name(name: str) -> str:
    return name.replace("Warp In ", "").strip()
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
    global has_stargate
    has_stargate = False  # ✅ always reset for each replay
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
        exclude_units_flag = request.form.get('exclude_units', '')
        exclude_units = str(exclude_units_flag).lower() in {'1', 'true', 'yes', 'on'}
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
        init_map = {}


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

        # ✅ Ensure every player has a starting snapshot at frame 0
        for p in players:
            frames = frames_by_pid[p.pid]
            supplies = supply_by_pid[p.pid]
            if not frames or frames[0] > 0:
                # If no snapshot exists, assume standard starting supply: 12 for SC2 LotV
                starting_supply = 12 if p.play_race in ['Protoss', 'Terran', 'Zerg'] else 6
                initial_supply = supplies[0] if supplies else starting_supply

                frames.insert(0, 0)
                supplies.insert(0, initial_supply)


        def supply_at_frame(pid: int, frame: int) -> int:
            """Return food_used for the last snapshot at or before frame."""
            frames = frames_by_pid.get(pid)
            supplies = supply_by_pid.get(pid)
            if not frames:
                return 0
            idx = bisect.bisect_right(frames, frame) - 1
            return supplies[idx] if idx >= 0 else 0

        def supply_after_frame(pid: int, frame: int) -> int:
            """Return food_used for the first snapshot strictly after frame."""
            frames = frames_by_pid.get(pid)
            supplies = supply_by_pid.get(pid)
            if not frames:
                return 0
            idx = bisect.bisect_right(frames, frame)
            if idx < len(supplies):
                return supplies[idx]
            return supplies[-1]


        last_hallucination_frame = -9999
        last_hallucination_pid = None
        pending_hallucinations = []
        roach_deaths = []  # (frame, supply, unit_id)
        unit_supply_map = {}

        # ---- iterate event stream --------------------------------
        for event in replay.events:
            if event.second == 0:
                continue

            # 🔍 Test all UnitTypeChangeEvents
            if isinstance(event, sc2reader.events.tracker.UnitTypeChangeEvent):
                print(f"🟢 Seen UnitTypeChangeEvent: {event}")
                if getattr(event, "unit", None):
                    print(f"   unit={event.unit}")
                    print(f"   type_history={getattr(event.unit, 'type_history', None)}")

            # ---- UnitDiedEvent: fallback for Roach → Ravager morph ----
            if isinstance(event, sc2reader.events.tracker.UnitDiedEvent):
                if getattr(event.unit, "owner", None) and event.unit.owner.pid == player.pid:
                    unit_name = format_name(event.unit.name)
                    if unit_name.lower() == "roach":
                        roach_deaths.append((
                            event.frame,
                            supply_at_frame(player.pid, event.frame),
                            event.unit_id
                        ))
                        print(f"🐛 Fallback: Tracked Roach death at frame {event.frame}")



            
            # ---- AbilityEvent or CommandEvent (safe for all versions) ----
            if hasattr(event, "ability_name") and event.ability_name:
                ability_name = event.ability_name
                ability_lower = ability_name.lower()

                if "hallucination" in ability_lower or "hallucinate" in ability_lower:
                    unit_raw = None
                    m = re.search(r"hallucinat(?:e|ion)[^A-Za-z]*([A-Za-z]+)", ability_name, re.I)
                    if m:
                        unit_raw = m.group(1)
                    else:
                        flat = re.sub(r"[^a-zA-Z]+", "", ability_lower)
                        for u in HALLUCINATED_TYPE_COUNTS.keys():
                            if u.replace(" ", "").lower() in flat:
                                unit_raw = u
                                break

                    if unit_raw:
                        unit_formatted = format_name(unit_raw)
                        unit_lower = unit_formatted.lower()
                        count = HALLUCINATED_TYPE_COUNTS.get(unit_formatted, 1)

                        for _ in range(count):
                            pending_hallucinations.append({
                                "type": unit_formatted,
                                "frame": event.frame,
                                "pid": event.pid,
                                "expiry": event.frame + HALLUCINATION_WINDOW_FRAMES
                            })

            # ------ capture live supply snapshot -------------------
            if isinstance(event, sc2reader.events.tracker.PlayerStatsEvent) and event.pid == player.pid:
                current_used = int(getattr(event, 'food_used', 0))
                current_made = int(getattr(event, 'food_made', 0))
                have_stats = True
                # no continue – we still want to process other events on this frame


            # ------ GET ability name for Chrono Boost -------------------
            ability_raw = getattr(event, "ability_name", None)
            ability = str(ability_raw) if ability_raw else ""
    

            # ----- global stop limits ------------------------------
            game_time = int(event.second / speed_factor)  # in‑game seconds
            if time_limit is not None and game_time > time_limit:
                break
            if stop_limit is not None and current_used > stop_limit:  # uses live snapshot
                break


            # ---- AbilityEvent for warp-ins and Zerg morphs --------------------
            if isinstance(event, ABILITY_EVENTS):
                ability_name = getattr(event, "ability_name", "")
                if not ability_name:
                    continue

                # Zerg morph abilities (Roach→Ravager, Hydra→Lurker)
                if ability_name in {"MorphToRavager", "MorphToLurker"}:
                    pid = getattr(event, "player", None).pid if getattr(event, "player", None) else event.pid
                    if pid == player.pid:
                        unit_name = "Ravager" if "Ravager" in ability_name else "Lurker"
                        ingame_sec = frame_to_ingame_seconds(event.frame, replay)
                        used_s = supply_at_frame(player.pid, event.frame) + 1
                        entries.append({
                            'clock_sec': int(ingame_sec),
                            'supply': used_s,
                            'made': 0,
                            'unit': unit_name,
                            'kind': 'start',
                            'source': 'morph'
                        })
                    continue

                # Only handle Protoss warp-ins
                if "Warp" in ability_name and ("Zealot" in ability_name or "Stalker" in ability_name or "Sentry" in ability_name or "Adept" in ability_name or "Dark Templar" in ability_name or "High Templar" in ability_name):
                    name = format_name(ability_name)
                    name = tidy(name)
                    if name is None:
                        continue

                    # ✅ Normalize warp-in names
                    name = base_unit_name(name)

                    # Snapshot supply at the moment the player clicked warp-in
                    ingame_sec = frame_to_ingame_seconds(event.frame, replay)
                    used_s = supply_at_frame(player.pid, event.frame)

                    entries.append({
                        'clock_sec': int(ingame_sec),
                        'supply': used_s,
                        'made': 0,
                        'unit': name,
                        'kind': 'start',
                        'source': 'warp-in'  # new!
                    })

            # ---- UnitBornEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitBornEvent):
                if getattr(event, "control_pid", None) != player.pid:
                    continue

                unit = event.unit
                if getattr(unit, "is_building", False):
                    continue
                if exclude_units:
                    continue

                name = format_name(event.unit_type_name)
                base_type_name = re.sub(r'^Hallucinated\s+', '', name, flags=re.I)

                # Skip morph results handled via abilities
                if base_type_name in {"Ravager", "Lurker"}:
                    continue

                hallucinated = getattr(event.unit, "is_hallucination", False)
                slot_match_found = False

                # ✅ Slot match for illusions
                if not hallucinated:
                    for pending in pending_hallucinations:
                        frame_diff = event.frame - pending["frame"]
                        if (
                            frame_diff >= 0 and frame_diff <= HALLUCINATION_WINDOW_FRAMES
                            and event.control_pid == pending["pid"]
                            and base_type_name.lower() == pending["type"].lower()
                        ):
                            hallucinated = True
                            slot_match_found = True
                            pending_hallucinations.remove(pending)
                            break

                # ✅ Fallback: Phoenix / Oracle only + Stargate logic
                if not hallucinated and base_type_name in {"Phoenix", "Oracle"}:
                    prev_supply = supply_at_frame(event.control_pid, event.frame - 32)
                    next_supply = supply_after_frame(event.control_pid, event.frame + 32)
                    print(f"Unit: {name}, Frame: {event.frame}, Prev: {prev_supply}, Next: {next_supply}")

                    if prev_supply == next_supply or not has_stargate:
                        hallucinated = True

                if hallucinated:
                    event.unit.is_hallucination = True
                    name += " (hallucination)"

                name = tidy(name)
                if name is None:
                    continue

                lower_name = name.lower()
                if (
                    not name
                    or "Beacon" in name
                    or name in skip_units
                    or lower_name in skip_units_lower
                    or any(k.lower() in lower_name for k in skip_keywords)
                ):
                    continue

                # ✅ Normal supply logic
                unit_name_lower = name.lower()
                if unit_name_lower in ["probe", "drone", "scv"]:
                    start_frame = event.frame
                    start_ingame_sec = frame_to_ingame_seconds(start_frame, replay) - 12
                    used_s = supply_at_frame(player.pid, start_frame) - 1

                elif unit_name_lower in [
                    "zealot", "stalker", "sentry", "adept", "dark templar", "high templar"
                ]:
                    fallback_ok = True
                    born_ingame_sec = frame_to_ingame_seconds(event.frame, replay)
                    for e in entries:
                        if (
                            e['unit'] == name
                            and abs(e['clock_sec'] - int(born_ingame_sec)) <= 1
                            and e.get('source') == 'warp-in'
                        ):
                            fallback_ok = False
                            break

                    if fallback_ok:
                        build_time = BUILD_TIME.get(event.unit_type_name, 0)
                        fps = replay.game_fps
                        born_frame = event.frame
                        build_frames = int(build_time * fps)
                        start_frame = max(born_frame - build_frames, 0)

                        start_ingame_sec = frame_to_ingame_seconds(start_frame, replay) - 6
                        used_s = supply_at_frame(player.pid, start_frame)

                        if unit_name_lower in [
                            "sentry", "stalker", "adept", "dark templar", "high templar"
                        ]:
                            used_s -= 2
                        elif unit_name_lower == "zealot":
                            used_s -= 1
                    else:
                        continue

                else:
                    build_time = BUILD_TIME.get(event.unit_type_name, 0)
                    if build_time == 0:
                        continue

                    fps = replay.game_fps
                    born_frame = event.frame
                    build_frames = int(build_time * fps)
                    start_frame = max(born_frame - build_frames, 0)
                    start_ingame_sec = frame_to_ingame_seconds(start_frame, replay)
                    used_s = supply_at_frame(player.pid, start_frame)
                    # Normal Roach or other unit born logic:
                    unit_id = event.unit_id
                    supply_at = supply_at_frame(player.pid, event.frame)
                    unit_supply_map[unit_id] = supply_at  # ✅ store exact supply for this unit

                entries.append({
                    'clock_sec': int(start_ingame_sec),
                    'supply': used_s,
                    'made': 0,
                    'unit': name,
                    'kind': 'start'
                })
                # ✅ Fallback: match Ravager Cocoon births to Roach deaths
                # ✅ Fallback: match Ravager Cocoon births to Roach deaths
                if name.lower() == "ravager cocoon":
                    cocoon_frame = event.frame
                    match = None
                    for death_frame, death_supply, unit_id in roach_deaths:
                        if abs(cocoon_frame - death_frame) <= 280:
                            match = (death_frame, death_supply, unit_id)
                            break

                    if match:
                        roach_supply = match[1]
                        ravager_supply = roach_supply + 1
                        entries.append({
                            'clock_sec': int(frame_to_ingame_seconds(cocoon_frame, replay)),
                            'supply': ravager_supply,
                            'made': 0,
                            'unit': 'Ravager',
                            'kind': 'start',
                        })
                        print(f"✅ Fallback: Added Ravager from Roach supply {roach_supply} → {ravager_supply}")
                        roach_deaths.remove(match)












            # ---- UnitInitEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitInitEvent):
                if event.control_pid != player.pid:
                    continue

                unit = event.unit
                name = format_name(event.unit_type_name)

                # ✅ Track if a Stargate has been built
                if "stargate" in name.lower():
                    has_stargate = True

                # --- skip workers & illusions for buildings ---
                if not getattr(unit, "is_building", False) and exclude_units:
                    continue

                unit_type_name = format_name(event.unit_type_name)
                base_type_name = re.sub(r'^Hallucinated\s+', '', unit_type_name, flags=re.I)

                hallucinated = getattr(event.unit, "is_hallucination", False)
                pending_hallucinations = [p for p in pending_hallucinations if p["expiry"] >= event.frame]

                unit_lower = base_type_name.lower()

                # ✅ Slot match for illusions
                if not hallucinated:
                    for pending in pending_hallucinations:
                        if pending["type"].lower() == unit_lower:
                            hallucinated = True
                            pending_hallucinations.remove(pending)
                            break

                # ✅ Fallback (buildings rarely hallucinated — safe to skip fallback)

                if hallucinated:
                    event.unit.is_hallucination = True
                    name += " (hallucination)"

                name = tidy(name)
                if name is None:
                    continue

                lower_name = name.lower()
                if (
                    not name
                    or "Beacon" in name
                    or name in skip_units
                    or lower_name in skip_units_lower
                    or any(k.lower() in lower_name for k in skip_keywords)
                ):
                    continue

                # ✅ Frame-based structure start
                init_frame = event.frame
                init_ingame_sec = frame_to_ingame_seconds(init_frame, replay)
                supply_at_start = supply_at_frame(player.pid, init_frame)

                init_map[event.unit_id] = name

                entries.append({
                    'clock_sec': int(init_ingame_sec),
                    'supply': supply_at_start,
                    'made': 0,
                    'unit': name,
                    'kind': 'start'
                })
                continue



            # ---- UnitDoneEvent ------------------------------------
            if isinstance(event, sc2reader.events.tracker.UnitDoneEvent):
                if event.unit_id in init_map:
                    name = init_map[event.unit_id]
                    entries.append({'clock_sec': int(event.second / speed_factor), 'supply': current_used if have_stats else get_supply(event.second)[0], 'made': current_made if have_stats else get_supply(event.second)[1], 'unit': name, 'kind': 'finish'})
                continue

            # ---- UpgradeCompleteEvent -----------------------------------------
            if isinstance(event, sc2reader.events.tracker.UpgradeCompleteEvent):
                if event.pid != player.pid:
                    continue

                name = tidy(event.upgrade_type_name)
                if name is None:
                    continue

                mapped_name = upgrade_name_map.get(name, name)

                duration_secs = upgrade_times.get(mapped_name)

                frame_sec = frame_to_ingame_seconds(event.frame, replay)

                if duration_secs:
                    start_real = frame_sec - duration_secs
                    boosted_secs = 0.0
                else:
                    start_real = frame_sec


                start_frame = int(start_real * replay.game_fps * speed_factor)
                idx = bisect.bisect_right(frames_by_pid[player.pid], start_frame) - 1

                if idx >= 0 and (start_frame - frames_by_pid[player.pid][idx]) <= 4:
                    used_s = supply_by_pid[player.pid][idx]
                    made_s = 0
                else:
                    real_sec = start_real * speed_factor
                    used_s, made_s = get_supply(real_sec)


                entries.append({
                    'clock_sec': int(start_real),
                    'supply': used_s,
                    'made': made_s,
                    'unit': mapped_name,
                    'kind': 'start',
                    'type': 'upgrade',
                    'label': mapped_name
                })


        # keep only start rows --------------------------------------
        entries = [
            e for e in entries
            if (e.get('kind') == 'start') or (e.get('type') == 'upgrade')
        ]

        # collapse identical supply+unit rows (units only) ----------
        tmp = []
        for e in sorted(entries, key=lambda x: (
            x.get('clock_sec', x.get('time', 0)),
            x.get('supply', 0),
            x.get('unit', x.get('label', ''))
        )):
            if e.get('kind') != 'start':
                # do not collapse upgrades — just add
                tmp.append(e)
                continue

            if (
                tmp
                and tmp[-1].get('kind') == 'start'
                and e.get('unit') == tmp[-1].get('unit')
                and e.get('supply') == tmp[-1].get('supply')
            ):
                tmp[-1]['count'] = tmp[-1].get('count', 1) + 1
            else:
                e['count'] = 1
                tmp.append(e)

        entries = tmp


        # final sort ------------------------------------------------
        entries.sort(key=lambda e: e.get('clock_sec', e.get('time', 0)))


        # ----- stringify build lines -------------------------------
        build_lines = []
        if compact:
            i = 0
            n = len(entries)
            while i < n:
                first = entries[i]
                if first.get('type') == 'upgrade':
                    minutes, seconds = divmod(first.get('clock_sec', first.get('time', 0)), 60)
                    label = first.get('label', 'Unknown')

                    parts = []
                    if not exclude_supply:
                        supply_str = f"{first['supply']}/{first['made']}" if first['supply'] > first['made'] and first['made'] > 0 else str(first['supply'])
                        parts.append(supply_str)
                    if not exclude_time:    
                        parts.append(f"{minutes:02d}:{seconds:02d}")

                    prefix = f"[{' '.join(parts)}] " if parts else ""

                    build_lines.append(prefix + label)
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
                    and entries[i]['clock_sec'] == start_time
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
                if item.get('type') == 'upgrade':
                    minutes, seconds = divmod(item.get('clock_sec', item.get('time', 0)), 60)
                    label = item.get('label', 'Unknown')

                    parts = []
                    if not exclude_supply:
                        supply_str = f"{item['supply']}/{item['made']}" if item['supply'] > item['made'] and item['made'] > 0 else str(item['supply'])
                        parts.append(supply_str)

                    if not exclude_time:
                        parts.append(f"{minutes:02d}:{seconds:02d}")

                    prefix = f"[{' '.join(parts)}] " if parts else ""

                    build_lines.append(prefix + label)
                    continue

                parts = []
                if not exclude_supply:
                    supply_str = f"{item['supply']}/{item['made']}" if item['supply'] > item['made'] and item['made'] > 0 else str(item['supply'])
                    parts.append(supply_str)
                if not exclude_time:
                    minutes, seconds = divmod(item.get('clock_sec', item.get('time', 0)), 60)
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
