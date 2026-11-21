"""Matrix-pencil fit of the dominant mode (Doc 13 §6; Hua and Sarkar's method, manuscript [85]).

Trust rule (Doc 13 §6): R^2 >= 0.99 and SNR >= 10. SNR here is the linear ratio of the RMS of
the fitted signal (mean removed) to the RMS of the residual.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np


def fit(y: np.ndarray, dt: float, order: int | None = None, tol: float = 1e-3) -> dict[str, Any]:
    y = np.asarray(y, dtype=float)
    n = len(y)
    lp = n // 3  # pencil parameter, N/3 is the usual choice
    hank = np.array([y[i : i + lp + 1] for i in range(n - lp)])
    _, s, vh = np.linalg.svd(hank, full_matrices=False)
    m = order if order is not None else int(np.sum(s > tol * s[0]))
    v = vh[:m].conj().T
    z = np.linalg.eigvals(np.linalg.pinv(v[:-1]) @ v[1:])
    vander = z[np.newaxis, :] ** np.arange(n)[:, np.newaxis]
    amp = np.linalg.lstsq(vander, y.astype(complex), rcond=None)[0]
    yhat = (vander @ amp).real
    resid = y - yhat
    r2 = 1 - float(np.sum(resid**2) / np.sum((y - y.mean()) ** 2))
    snr = float(np.std(yhat) / max(np.sqrt(np.mean(resid**2)), 1e-300))
    lam = np.log(z.astype(complex)) / dt
    k = np.arange(n)
    modes = [
        {
            "sigma_per_s": float(lm.real),
            "freq_hz": float(lm.imag / (2 * math.pi)),
            "zeta": float(-lm.real / abs(lm)),
            "energy": float(abs(a) ** 2 * np.sum(np.abs(zi) ** (2 * k))),
        }
        for lm, a, zi in zip(lam, amp, z, strict=True)
        if lm.imag > 1e-9
    ]
    modes.sort(key=lambda d: d["energy"], reverse=True)
    return {"modes": modes, "r2": r2, "snr": snr, "order": m}


def dominant(y: np.ndarray, dt: float, trust: dict[str, float], **kw: Any) -> dict[str, Any]:
    """Strongest oscillatory mode, with the trust flag of Doc 13 §6."""
    f = fit(y, dt, **kw)
    mode = f["modes"][0] if f["modes"] else None
    trusted = mode is not None and f["r2"] >= trust["r2_min"] and f["snr"] >= trust["snr_min"]
    return {"mode": mode, "r2": f["r2"], "snr": f["snr"], "order": f["order"], "trusted": trusted}
