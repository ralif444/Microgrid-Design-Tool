"""Bus admittance matrix Y = G + jB (S) from series line impedances; no shunts (A4)."""

from __future__ import annotations

import numpy as np
import numpy.typing as npt

from mgengine.types import Network

Complex = npt.NDArray[np.complex128]


def admittance(net: Network) -> Complex:
    index = {b: i for i, b in enumerate(net.buses)}
    Y = np.zeros((len(net.buses), len(net.buses)), dtype=np.complex128)
    for ln in net.lines:
        i, k = index[ln.from_bus], index[ln.to_bus]
        y = 1.0 / complex(ln.r_ohm, ln.x_ohm)
        Y[i, i] += y
        Y[k, k] += y
        Y[i, k] -= y
        Y[k, i] -= y
    return Y
