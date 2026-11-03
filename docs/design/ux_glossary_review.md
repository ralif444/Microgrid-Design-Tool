# UX-10: glossary toggletips and S-17 About (2026-11-04)

Work package UX-10 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X6, FR-91; Doc 7 S-17; Doc 9 D-89).

## Screenshots
Location: `ux-glossary-2026-11-04/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE engine, default profile. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s05-inverters` | S-05 Inverters tab; after: the m_p toggletip open on "P–f droop", info buttons on the kVA, kW and kvar headers |
| `s07-tip` | S-07 after M1; after: the "loading ratio" toggletip open on its KPI tile, info buttons on the p.u., kW, kvar, ε_X tiles and on the Status word |
| `s08-banner` | S-08 before M2 margins are entered (INPUT_INVALID); after: the info button beside the Status word |
| `s17-about` | S-17 About; before: the route does not exist; after: versions, active limits, glossary |

## Changes
- **Glossary data** `components/glossary.ts`: 27 entries `{term, short, source}`.
  - Text in Indonesian (Doc 7 §9 #1).
  - From the manuscript where it defines the term: Tabel 2.10, Tabel 4.4, subbab 1.1.1, 2.1.1, 2.1.2, 2.1.6, 4.1.5, 4.2.1, 4.2.4 – 4.2.7.
  - Otherwise from the Doc 3 §2 line, rendered in Indonesian (user decision 2026-11-04). Only "margin" needs that.
- **Toggletip** `components/Term.tsx`:
  - a 16 px info button named "Glossary: <term>", opened by click or Enter
  - closes on Escape (focus returns to the button), on an outside click or on scroll; never on hover
  - the text is rendered only while open, so closed headers keep their text
  - fixed position, so a sideways-scrolling table does not clip it; hidden in print
  - Carbon's own Toggletip was not used: it keeps the content in the DOM while closed.
- **Where the info buttons sit:**
  - Table headers: `DataColumn.term`, plus every p.u., kW, kvar and kVA unit column automatically. This covers the droop gains on S-05 (m_p, n_q), loading on S-07, margin on S-08, and eigenvalue and damping ratio on S-13.
  - KPI labels: `Kpi.term` for p.u., kW, kvar, loading ratio, ε_X, margin, normalised margin, λ_c, λ_s, the M2 verdict, stability class (eigenvalue), ζ_min, transient class and RoCoF.
  - The Status banner, beside the Status word.
- **S-17 About** `/about/`, linked from the header, needs no Project:
  - versions and engine kind from `GET /meta` (FAKE marked)
  - the active limits (null shown as "no limit", Doc 6)
  - the offline note
  - the glossary table with sources

## Critique
1. **Three terms only on S-17.** r_τ, κ and r_in appear only in the validity-indicator table, which must stay untouched (guideline §1 rule 9). Grid-forming and participation factor have no table header or KPI label to sit on. All five are on S-17.
2. **Many info buttons in the editable tables.** Every kW, kvar and kVA column on S-03 and S-05 gets one, which lengthens the Tab order by one stop per column.
3. **Two entries are close readings, not quotations.**
   - "loading ratio" is read from Eq. 4.10 (S_i/1000 ≤ μ_max S_r,i).
   - kW, kvar and kVA are read from the unit convention of 4.2.1 and the power definitions of 2.1.2 and 4.2.4.
   - The source names those places. The owner should confirm the wording.
4. **The definitions are short and some keep symbols** (ω_i, P_f,i, t_λ), as the manuscript does; no derivation is added.

## Open point (Doc 12 §9 #9)
No term of the guideline §7 list was left out: each has a manuscript or Doc 3 definition. Nothing is listed as missing.

## Tests
- Client: `components/glossary.test.ts`:
  - every entry has a term, a text and a source starting "Naskah" or "Doc 3"
  - no out-of-scope term
  - every unit term points at an entry
- E2E: `test_fr_91_glossary_toggletip_and_about` in `tests/e2e/test_ux_round.py`:
  - Enter opens the S-07 "loading ratio" toggletip with its source
  - Escape closes it and focus returns; an outside click closes it
  - S-17 lists 27 glossary rows and marks the FAKE engine
- FR-91 left the seam-6 exception list (FR-92 remains).
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 82
  - E2E 49 on Chromium and 49 on Chrome
