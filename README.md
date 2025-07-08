
Build order program for primary Starcraft 2

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   Visit <http://localhost:5173> in your browser.

## Building

Create a production build with:

```bash
npm run build
```


After building, run the helper script to further compress the Firebase vendor
bundle:

```bash
npm run minify-firebase
```


The build configuration uses Vite's `splitVendorChunkPlugin` to automatically
separate vendor dependencies into smaller chunks. Scripts for the main pages are
now loaded dynamically after the DOM finishes loading to further reduce unused
JavaScript on initial page load.

## Preview Deployment

Deploy the current build to the `dev` preview channel:

```bash
npm run preview-deploy
```

Ensure you are authenticated with the Firebase CLI (`firebase login`).

## Bracket Input Setting

The editor can insert `[` `]` automatically around supply and time values. You
can toggle this in **Settings**:

1. Open the user menu and click **Settings**.
2. Enable or disable **Bracket Input** in the modal.

* Run `npm install` to install dependencies.
* Install Firebase CLI (`npm install -g firebase-tools` or `npx firebase login`).
* Use `npm run build` followed by `firebase hosting:channel:deploy dev` for preview deployments.

## Replay Parsing Backend

To parse StarCraft II replays locally you must run the Python service:

```bash
pip install flask flask-cors sc2reader
python app.py
```

The server listens on http://localhost:5000. The frontend will send uploaded
replays to `/upload` on that server and populate the **Build Order** text area
with the parsed results.

### Chrono Boost Timing Helper

`app.py` exposes two helpers for dealing with Chrono Boost.

* `calculate_chrono_overlap(start, end, chrono_windows, producer_tag=None)` –
  return boosted/unboosted seconds for a specific structure.
* `adjusted_start_time(end, base_duration, chrono_windows, producer_tag=None)` –
  compute the real start time given the unmodified duration.

Example:

```python
end_time = 380
base_duration = 100

chrono = [(300, 309.6)]  # stored under the core's tag
real_start = adjusted_start_time(end_time, base_duration, chrono, producer_tag=core_tag)
```

Pass the building's tag as ``producer_tag`` so that only boosts on that structure
affect the result.

Overlapping Chrono Boost casts are merged automatically so time is not counted
twice.  The same helper is used for unit build times with the appropriate
`BUILD_TIME` values.

To record Chrono Boost usage in your event loop:

```python
if ability.endswith("ChronoBoostEnergyCost"):
    start = event.second / speed_factor
    end = start + CHRONO_BOOST_SECONDS
    tag = producer_tag(event)
    if tag is not None:
        chrono_windows[tag].append((start, end))
    else:
        chrono_windows[event.pid].append((start, end))  # fallback
```

When processing an upgrade you can then compute the overlap for that building:

```python
boosted, unboosted = calculate_chrono_overlap(start, end, chrono_windows[tag])
```

### Tracking upgrade structures

When a research ability is issued, the parser records the producing structure's
tag and associates it with the upgrade name. Later, if
`UpgradeCompleteEvent` lacks the building reference, the stored tag is used so
that Chrono Boost adjustments apply only to boosts on that structure.

```python
if UPGRADE_PREFIX.match(event.ability_name):
    label = ability_upgrade_label(event.ability_name)
    upgrade_sources[event.pid][label] = event.unit.tag

# ... later when the upgrade finishes ...
tag = upgrade_sources[player.pid].pop(mapped_name, None)
windows = chrono_windows.get(tag, [])
start = adjusted_start_time(frame_sec, duration, windows, producer_tag=tag)
```

If you already know the build window, compute the boosted duration directly:

```python
start = 100
end = 160
base_time = 60
chrono = [(110, 125)]  # in-game seconds

adjusted = chrono_adjusted_build_time(start, end, chrono, base_time, boost_rate=1.5)
```

