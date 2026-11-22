# Offline M5 validation (Doc 13)

Outside the app; must not import `mgapp` or `mgengine` (manuscript 4.3.8). Needs numpy only;
the engine environment has it. Step by step: `docs/PSIM_BUILD_GUIDE.md`.

| Module | Doc 13 | Does |
|---|---|---|
| `m5/sheet.py` | §3, §8 step 5 | Input sheet and PSIM parameter file from a REAL RunRecord (FAKE or failed records refused): parameters, M1 initial state, disturbance in SI units |
| `m5/layer2.py` | §7 | Pogaku 2007 Table I inverter scaled in p.u. to each rating; delay (Holmes 2009); limiter |
| `m5/psim.py` | §5, §10 | Read the SIMVIEW export, drop the duplicated disturbance row, resample onto the engine grid; derive S, loading, sharing, losses |
| `m5/compare.py` | §5, §6 | Hash-locked policy (v2 in force, v1 history), Eq. 13.5 steady, Eq. 13.6 NRMSE, settling, nadir/peak, the engine's class rule, modes |
| `m5/mpencil.py` | §6 | Matrix-pencil dominant mode with the R² ≥ 0.99, SNR ≥ 10 trust rule |

PSIM export names: `Time`, `f_sys` (Hz, mean of the inverters in service), `f_<inverter>` (Hz),
`P_`/`Q_<inverter>` (W, VAR), `V_<bus>` (V LL RMS), `A_<bus>` (deg, first bus = 0), `I_<line>` (A).

```
cd validation
../engine/.venv/Scripts/python -m pytest -p no:cacheprovider tests
../engine/.venv/Scripts/python -m m5 sheet RECORD.json out/CASE [--layer2]
../engine/.venv/Scripts/python -m m5 steady M1_RECORD.json psim.csv 1
../engine/.venv/Scripts/python -m m5 series M4B_RECORD.json psim.csv 1
../engine/.venv/Scripts/python -m m5 class M4B_RECORD.json psim.csv
../engine/.venv/Scripts/python -m m5 mode M4B_RECORD.json psim.csv 1 [SIGNAL] [UNTIL_S]
../engine/.venv/Scripts/python -m m5 eig M4A_RECORD.json psim.csv 1 SIGNAL T_FROM T_TO
```

Records: `uv run --project backend python tools/make_validation_fixtures.py --records validation/records`
(every case; git-ignored). Test fixtures and the limiter prediction: the same tool without
`--records`. Changing a `m5/policy_v*.json` breaks its hash lock on purpose: thresholds change only
through a new policy version.
