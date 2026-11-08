# Spec: X9 cable and overload-protection sizing

Full specification: `docs/CABLE_BREAKER_FEATURE_GUIDELINES.md` (the guideline wins over this summary).

- Experimental, behind `Settings.feature_cable_sizing` (env `MGAPP_FEATURE_CABLE_SIZING`), off by default. KONFLIK: protection is out of the manuscript scope; supervisor approval pending.
- App-side service, no Engine Port call. Method `IEC60364_OVERLOAD_PUIL2011`: PUIL 2011 Ayat 433.1, KHA from Tabel A.52-4/-5 with correction factors A.52-14 to A.52-19.
- Sizes every Line (I_B from M2 `sizing_check.per_line[].required_current_a`) and every inverter output feeder (I_B = rated current).
- No PUIL values in the repo or the tests: real tables live in `data/private/` (git-ignored); tests use a fictitious fixture.
- Validation: hand calculation H1–H6 (exact match) plus PSIM line currents for I_B. No ETAP (user decision 2026-11-08).

Tickets: `issues/01` to `issues/06`, in order.
