# X10-5: S-19 Cable and breaker sizing (2026-11-09)

Ticket 05 of `.scratch/cable-sizing/`. Sources: guideline `docs/CABLE_BREAKER_FEATURE_GUIDELINES.md` §6, Doc 7 §2.4, Doc 12 FR-105, FR-112, and Doc 9 D-102 and D-103.

## Screenshots
Location: `x10-5-2026-11-09/{before,after}/{1440x900,640x900}/`.
- Design: the E2E two-bus design on the FAKE engine. The server ran with `MGAPP_FEATURE_CABLE_SIZING=1`.
- Table file: `tests/fixtures/FAKE_cable_tables_TEST_ONLY.json`. It is fictitious, with round numbers; it is not PUIL and not standard data. The screen labels it "FAKE test table: the results are not real sizing advice". Every number in the result shots is a test value, not sizing advice.

| File | Shows |
|---|---|
| `before/s19-route` | `/cable-sizing/` before ticket 05: the route does not exist (404), even with the flag on. |
| `after/s19-no-m2` | Before M1 and M2: the settings panel is empty, the gate says "Run the constraint check (M2) first", Run is disabled, and the empty state reads "Not run yet." |
| `after/s19-ready` | After M2, with the FAKE table file loaded and the settings chosen: Run is enabled. |
| `after/s19-result` | After Run: the FEASIBLE banner, the fixed caveat above the table, one row per Line and Inverter feeder, and the INV1 row opened to its factors. |

## Changes
- **Flag in `/api/meta` (D-103 K286).** `GET /api/meta` gains `features.cable_sizing`. The S-19 link under "Further analyses" and the screen itself appear only when it is true. With the flag off, the route shows "This screen is not available." and no form.
- **Settings panel.** It holds the project defaults only: method, conductor, insulation, ambient temperature, soil resistivity (method D only), grouping count and arrangement, and cable construction.
  - The arrangement list follows the method: air rows for A1, B1 and C; duct rows for D.
  - Empty fields are not sent, so the server's stage 1 names them with `CABLE_SETTINGS_INVALID`.
  - The settings are held in the session only (K287). Per-element overrides are deferred (K290).
- **"Load table file (JSON)" (K289).** The panel shows the file name, the `table_set_id` and the source document. The file is held in the session only.
- **Run gate.** Run needs three things:
  - the latest M2 result on the current design, with Status FEASIBLE or INFEASIBLE;
  - a loaded table file;
  - a request not already running.

  The gate line names the missing step. A stale M2 reads "out of date ... Re-run M1 and M2 first."
- **Status banner.** It is the house `StatusBanner`. `status-text.ts` has two new CB texts: the FEASIBLE headline "advice ... only", and DEPENDENCY_NOT_MET, which names M2 instead of M1.
- **Fixed caveat.** It sits above the results table, with a warning icon on a Carbon caution background, and uses the text from the payload `caveat_text` (guideline §0).
- **Results table.** It has one row per element, with these columns:
  - I_B, device class, I_n, size, I_Z;
  - both conditions (CB.1, CB.2) as icon + "Met" / "Not met";
  - the outcome as icon + word;
  - the R check ("R differs" with a warning icon).

  The caption names the method, the table set and the start of the SHA-256.
- **Expandable row ("Factors of <id>").** It shows:
  - the I_B source and the device with k_2 and its source;
  - I_tab, k_θ, k_ρ and k_g, each with the value used and the table and page it came from (read from the table file that was sent);
  - the three margins and the R check;
  - the catalogue match, shown as "Not checked yet" (FR-115 is not built);
  - any notes.
- **Glossary toggletips (FR-91, Indonesian).** KHA (I_Z), I_B, I_n, I_2, k_θ, k_ρ and k_g. Each names the guideline section and the PUIL clause or table that the guideline cites.
  - They live on S-19, not in `glossary.ts`, so S-17 About shows nothing of X10 while the flag is off (FR-105).
- **E2E fixture (K288).** `server(profile, env=...)` starts one server per profile and env pair. Existing tests are unchanged.

## Critique and open points
1. **The CB RunRecord stays out of Run history and the Project file.** Its `parameters` carry the whole table file. Keeping the file out of the Project (K289) therefore means keeping the record out too, so S-19 holds the last record in the session only. Run history, Report (FR-114) and the SLD breakers (FR-113) will need a decision: either store the record without `tables` (only `table_set_hash`), or keep it session-only.
2. **The outcome colours are an agent choice within guideline §6.**
   - SIZED: success, green, check icon.
   - NO_DEVICE_FITS and NO_SIZE_FITS: negative, orange, misuse icon.
   - OUT_OF_TABLE and TABLE_GAP: caution, yellow, warning icon.

   The docs say only "Carbon support colours + icon + word". Confirm or change.
3. **The selects do not line up with the number fields.** `NumberField` uses the label grid of the settings box, while the native selects sit inline (as on S-14). It reads fine but is uneven at 1440 px.
4. **At 640 px the results table scrolls sideways** inside its region (as with the other tables). An opened factor row is as wide as the table, so long lines such as "Catalogue match" need the same sideways scroll.
5. **The session copy is shared across Projects** opened in the same tab (code comment `shortcut:`). It moves into the Project store when K264 (settings saved in the Project) is built.
6. **Not shown:** the INPUT_INVALID state (covered by the API contract tests) and the flag-off route (covered by the E2E `screen_hidden_when_flag_off`).
