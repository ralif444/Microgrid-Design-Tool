# EX-1 review: guided example files, store slice, S-01 action, header tag

Date 2026-11-05. Scope: Doc 12 X9 FR-99, FR-101 and the type guard of FR-100 (Doc 9 D-92, D-93). Screenshots in `docs/design/ex-1-2026-11-05/` (`before/` at `d9ca332`, `after/` with this change), Fake Engine, 1440 × 900 and 640 × 450.

## What changed

- `frontend/public/examples/guided-d2.mgproj.json`: a schema-v1 Project file built from `d2.mgproj.json`. The design is identical, and the file adds the Doc 3 §3.7 limits and the scenarios D2 base, D2S and D2H of Doc 13 §4, with D2 base first (D-92 K234). Line-current limit and balance tolerance are left out (EMPTY).
- `frontend/public/examples/guided-d2.example.json`: `example_settings_version` 1, holding only the values D-92 K230 – K232 confirm. Each value carries its source. The fields without a value are listed in `needs_value`:
  - M3a `step_relative`
  - M3b `axis.step_count`
  - M3d `axis_x.step_count` and `axis_y`
  - M4b `settling`
  
  It also holds the three S-14 presets. There is no guidance text yet; that comes at EX-5.
- `frontend/store/example.ts`: the hand-written guard `parseExampleSettings`.
  - Ignored: unknown screens, fields and keys.
  - Dropped with a console warning and moved to `needs_value`: a field with no source, or one that fails its Doc 3 §6 stage-1 rule.
  - Dropped: a preset that fails its rule.
  - Wrong version or no `screens`: the whole file is rejected.
- `frontend/store/reducer.ts`: the slice `example`, with actions `exampleEntered` and `exampleLeft` (D-92 K233).
  - `exampleEntered` does nothing without an open Project.
  - `projectCreated`, `projectLoaded` and `exampleOpened` all leave example mode.
- S-01: a primary button "Open guided example (D2)" with one line under it, above the four example buttons. The button is hidden when the settings file is missing or invalid.
- Header, shown only in example mode: a blue Carbon Tag "Example mode", an "About example mode" toggletip saying the settings are not saved, and a "Leave example mode" button.
- `Term.tsx`: the toggletip is now a generic `Toggletip`, and `Term` is a thin wrapper around it. EX-2 reuses it for the "Example" field tags.

## Choices (D-93)

- The guard lives in `store/`, not `components/`: the dependency rule `store-isolated` forbids `store → components`.
- The Tag is blue. Carbon blue is the info colour, and Doc 7 §2.3 calls example mode info, not status. Purple is already the advisory colour (visual guideline §8), and warm-gray marks FAKE.
- Settings fields use contract parameter names (Doc 3 §6). Whether a `parameter_path` resolves is checked against the guided Project in the Python test now; each screen will check it on use from EX-3 (Doc 7 §2.3).

## Checked

- Unchanged: the S-01 layout apart from the new block, every existing button name, the header at 640 px (it wraps, no sideways scroll), and the normal example D2 (no tag).
- The toggletip icon stays white on navy on hover. The first after-shot showed it turning dark; the fix is in `AppShell.module.css`.
- FR-101: saving in example mode gives the same Project file as saving outside it. The guided design hashes the same as D2 with the five limits entered by hand.

## Not yet (later packages)

- No form is prefilled yet (EX-2 – EX-4), although the S-01 line already says "Every screen is pre-filled".
- No banner, guidance or Next links (EX-5).
