"""CLI (Doc 13 §8 steps 5-7).

python -m m5 sheet RECORD.json OUTDIR [--layer2]   input sheet JSON + PSIM parameter file
python -m m5 steady M1_RECORD.json PSIM.csv LAYER  Eq. 13.5 per quantity
python -m m5 series M4B_RECORD.json PSIM.csv LAYER NRMSE and settling per signal
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from m5 import compare, psim, sheet


def main(argv: list[str]) -> int:
    cmd, rec_path, *rest = argv
    rec = json.loads(Path(rec_path).read_text(encoding="utf-8"))
    if cmd == "sheet":
        out = Path(rest[0])
        out.mkdir(parents=True, exist_ok=True)
        s = sheet.input_sheet(rec, with_layer2="--layer2" in rest)
        (out / "sheet.json").write_text(json.dumps(s, indent=1), encoding="utf-8")
        (out / "params.txt").write_text(sheet.psim_params(s), encoding="utf-8")
        return 0
    sheet.input_sheet(rec)  # same refusal rules (REAL, OK) before any comparison
    data, layer, policy = psim.read_psim(rest[0]), int(rest[1]), compare.load_policy()
    payload = rec["result"]["payload"]
    if cmd == "steady":
        rows = compare.steady(psim.m1_values(payload), data, policy, layer)
    else:
        t0 = rec["parameters"]["disturbance"]["start_time_s"]
        rows = compare.series(psim.engine_series(payload), data, t0, policy, layer)
    print(json.dumps({"policy_sha256": policy["sha256"], "rows": rows}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
