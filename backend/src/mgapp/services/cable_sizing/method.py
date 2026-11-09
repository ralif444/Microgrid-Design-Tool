"""Method IEC60364_OVERLOAD_PUIL2011 (guideline §3, Doc 9 D-100): overload-only sizing.

Pure functions over a validated table file (`tables.py`). Equations are cited, not re-derived:
CB.1 I_B ≤ I_n ≤ I_Z, CB.2 I_2 ≤ 1.45 I_Z, CB.3 I_Z = I_tab k_θ k_ρ k_g, CB.4/CB.5 R check.
"""

from __future__ import annotations

import math
from typing import Any, Literal, Self

from pydantic import Field, model_validator

from mgapp.domain.base import Model
from mgapp.services.cable_sizing.tables import (
    CableTables,
    Conductor,
    DeviceClass,
    Insulation,
    Method,
    TableIssue,
    TableIssueCode,
    validate_tables,
)

METHOD_ID = "IEC60364_OVERLOAD_PUIL2011"
CB2_FACTOR = 1.45  # (CB.2), PUIL 2011 Ayat 433.1
MAX_CONDUCTOR_TEMP_C: dict[str, float] = {"PVC": 70, "XLPE": 90}  # guideline §2.2, §3.5
R_TEMP_CONSTANTS: dict[str, tuple[float, float]] = {"CU": (234.5, 254.5), "AL": (228, 248)}  # CB.4
R_MISMATCH_RATIO = 0.10  # (CB.5) [DESIGN CHOICE], D-100 K263

AirArrangement = Literal["BUNCHED", "SINGLE_LAYER_WALL", "UNDER_CEILING"]
DuctArrangement = Literal["DUCT_TOUCHING", "DUCT_0_25M", "DUCT_0_5M", "DUCT_1M"]
# A.52-17 rows 2-3 give no further reduction beyond the last column (guideline §3.2).
LAST_COLUMN_ALLOWED = frozenset({"SINGLE_LAYER_WALL", "UNDER_CEILING"})
Outcome = Literal["SIZED", "NO_DEVICE_FITS", "NO_SIZE_FITS", "OUT_OF_TABLE", "TABLE_GAP"]


class CableSizingSettings(Model):
    """Installation parameters (guideline §2.2); no defaults, overrides are partial."""

    method: Method
    conductor: Conductor
    insulation: Insulation
    ambient_temp_c: float
    soil_resistivity_k_m_per_w: float | None = Field(default=None, gt=0)
    grouping_count: int = Field(ge=1)
    grouping_arrangement: AirArrangement | DuctArrangement
    cable_construction: Literal["MULTICORE", "SINGLE_CORE"]
    per_element_overrides: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _fits_method(self) -> Self:
        duct = self.method == "D_DUCT"
        if duct != self.grouping_arrangement.startswith("DUCT_"):
            raise ValueError("grouping_arrangement does not fit the installation method")
        if self.method == "C" and self.grouping_arrangement == "BUNCHED":
            raise ValueError("method C uses A.52-17 row 2 or 3, not BUNCHED")
        if duct and self.soil_resistivity_k_m_per_w is None:
            raise ValueError("method D_DUCT needs soil_resistivity_k_m_per_w")
        return self

    def for_element(self, element_id: str) -> CableSizingSettings:
        base = self.model_dump(exclude={"per_element_overrides"})
        return CableSizingSettings.model_validate(
            {**base, **self.per_element_overrides.get(element_id, {})}
        )


class SizingElement(Model):
    element_id: str
    element_kind: Literal["LINE", "INVERTER_FEEDER"]
    ib_a: float = Field(ge=0)
    ib_source: Literal["M2.sizing_check.per_line", "inverter_rated_current"]
    r_line_ohm_per_km: float | None = None


class DeviceResult(Model):
    device_class: Literal["MCB", "MCCB"] = Field(alias="class")
    standard: str
    in_a: float | None
    k2: float
    k2_source: str
    i2_a: float | None


class LookupValues(Model):
    temp_c_used: float
    rho_used: float | None
    group_used: int


class CableResult(Model):
    conductor: Conductor
    insulation: Insulation
    method: Method
    size_mm2: float
    i_tab_a: float
    k_theta: float
    k_rho: float
    k_g: float
    lookup_values: LookupValues
    iz_a: float


class Checks(Model):
    cond1_ok: bool
    cond2_ok: bool
    margin_in_ib_a: float
    margin_iz_in_a: float
    margin_145iz_i2_a: float


class RCheck(Model):
    r_line_ohm_per_km: float
    r_cable_ohm_per_km: float
    temp_c: float
    deviation_ratio: float
    flagged: bool


class ElementSizing(Model):
    element_id: str
    element_kind: Literal["LINE", "INVERTER_FEEDER"]
    ib_a: float
    ib_source: str
    device: DeviceResult
    cable: CableResult | None = None
    checks: Checks | None = None
    r_check: RCheck | None = None
    outcome: Outcome
    notes: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


def inverter_rated_current_a(rated_kva: float, nominal_kv_ll: float) -> float:
    """Guideline D2: I_r = S_r / (√3 V_n), kVA and kV line-to-line give A."""
    return rated_kva / (math.sqrt(3) * nominal_kv_ll)


def corrected_resistance(r20: float, conductor: str, insulation: str) -> float:
    """(CB.4): R_20 corrected to the insulation's maximum conductor temperature, Ω/km."""
    a, b = R_TEMP_CONSTANTS[conductor]
    return r20 * (a + MAX_CONDUCTOR_TEMP_C[insulation]) / b


def _numeric(table: dict[str, Any]) -> list[tuple[float, float | None]]:
    return sorted((float(k), v) for k, v in table.items())


def _next_more_severe(
    table: dict[str, Any], value: float, *, last_allowed: bool = False
) -> tuple[float, float | None] | None:
    """Smallest tabulated key ≥ value (higher = more severe); no interpolation (§3.2)."""
    rows = _numeric(table)
    hit = next(((k, f) for k, f in rows if k >= value), None)
    return rows[-1] if hit is None and last_allowed and rows else hit


def _theta_table(tables: CableTables, s: CableSizingSettings) -> dict[str, Any]:
    src = tables.k_theta_ground if s.method == "D_DUCT" else tables.k_theta_air
    return src.get(s.insulation) or {}


def _group_rows(tables: CableTables, s: CableSizingSettings) -> dict[str, Any]:
    if s.method == "D_DUCT":
        key = "A.52-19A" if s.cable_construction == "MULTICORE" else "A.52-19B"
    else:
        key = "A.52-17"
    return (tables.k_group.get(key) or {}).get("rows", {}).get(s.grouping_arrangement) or {}


def _ampacity(tables: CableTables, s: CableSizingSettings) -> dict[str, float | None] | None:
    return next(
        (
            t.values_a
            for t in tables.ampacity
            if (t.method, t.conductor, t.insulation) == (s.method, s.conductor, s.insulation)
        ),
        None,
    )


def _classes(tables: CableTables) -> dict[str, DeviceClass]:
    return {d.class_: d for d in tables.device_classes}


def _issues_for(tables: CableTables, s: CableSizingSettings) -> list[str]:
    missing = []
    if _ampacity(tables, s) is None:
        missing.append(f"ampacity for method {s.method}, {s.conductor}, {s.insulation}")
    if not _theta_table(tables, s):
        name = "k_theta_ground" if s.method == "D_DUCT" else "k_theta_air"
        missing.append(f"{name} for {s.insulation}")
    if s.method == "D_DUCT" and not tables.k_rho.get("values"):
        missing.append("k_rho values")
    if not _group_rows(tables, s):
        missing.append(f"k_group row {s.grouping_arrangement}")
    if not tables.sizes_mm2.get(s.conductor):
        missing.append(f"sizes_mm2 for {s.conductor}")
    return missing


class Iec60364OverloadPuil2011:
    method_id = METHOD_ID

    def validate(self, settings: CableSizingSettings, tables: CableTables) -> list[TableIssue]:
        """Table completeness for the project defaults and every override (guideline §4)."""
        classes = _classes(tables)
        missing = [f"device class {c}" for c in ("MCB", "MCCB") if c not in classes]
        if "MCB" in classes and classes["MCB"].max_in_a is None:
            missing.append("MCB max_in_a (MCB/MCCB threshold, D6)")
        issues: list[TableIssue] = []
        for eid in ["", *settings.per_element_overrides]:
            s = settings.for_element(eid)
            issues += validate_tables(tables, s.method)
            missing += _issues_for(tables, s)
        issues += [
            TableIssue(code=TableIssueCode.CABLE_TABLES_INCOMPLETE, message=f"Missing {m}.")
            for m in missing
        ]
        return list({i.message: i for i in issues}.values())

    def size(
        self, elements: list[SizingElement], settings: CableSizingSettings, tables: CableTables
    ) -> list[ElementSizing]:
        """Guideline §3.3 per element; call `validate` first (missing tables raise)."""
        return [_size_one(e, settings.for_element(e.element_id), tables) for e in elements]


def _device(tables: CableTables, ib: float) -> tuple[DeviceClass, float | None]:
    """§3.3 steps 1-2: class by I_B (D6), smallest I_n ≥ I_B, MCB → MCCB above the threshold.

    No MCB step ≥ I_B also falls through to MCCB (user decision D-101 K273, not the literal
    step 2 text).
    """
    classes = _classes(tables)
    mcb, mccb = classes["MCB"], classes["MCCB"]
    threshold = mcb.max_in_a
    assert threshold is not None  # checked by validate
    cls = mcb if ib <= threshold else mccb
    in_a = min((i for i in cls.in_series_a if i >= ib), default=None)
    if cls is mcb and (in_a is None or in_a > threshold):
        cls = mccb
        in_a = min((i for i in cls.in_series_a if i >= ib), default=None)
    return cls, in_a


def _size_one(e: SizingElement, s: CableSizingSettings, tables: CableTables) -> ElementSizing:
    cls, in_a = _device(tables, e.ib_a)
    i2 = None if in_a is None else cls.k2 * in_a
    device = DeviceResult.model_validate(
        {
            "class": cls.class_,
            "standard": cls.standard,
            "in_a": in_a,
            "k2": cls.k2,
            "k2_source": cls.k2_source,
            "i2_a": i2,
        }
    )
    base = {
        "element_id": e.element_id,
        "element_kind": e.element_kind,
        "ib_a": e.ib_a,
        "ib_source": e.ib_source,
        "device": device,
    }
    if in_a is None or i2 is None:
        return ElementSizing(**base, outcome="NO_DEVICE_FITS", notes=["No rated current ≥ I_B."])

    theta = _next_more_severe(_theta_table(tables, s), s.ambient_temp_c)
    rho: tuple[float, float | None] | None = (math.nan, 1.0)
    if s.method == "D_DUCT":
        assert s.soil_resistivity_k_m_per_w is not None
        rho = _next_more_severe(tables.k_rho["values"], s.soil_resistivity_k_m_per_w)
    group = _next_more_severe(
        _group_rows(tables, s),
        s.grouping_count,
        last_allowed=s.method != "D_DUCT" and s.grouping_arrangement in LAST_COLUMN_ALLOWED,
    )
    for name, hit in (("ambient temperature", theta), ("soil resistivity", rho), ("group", group)):
        if hit is None:
            return ElementSizing(
                **base, outcome="OUT_OF_TABLE", notes=[f"The {name} is beyond the table."]
            )
        if hit[1] is None:
            return ElementSizing(
                **base, outcome="TABLE_GAP", notes=[f"The {name} factor cell is blank."]
            )
    assert theta is not None and rho is not None and group is not None  # returned above
    k_theta, k_rho, k_g = (float(h[1] or 0) for h in (theta, rho, group))  # None returned above
    lookup = LookupValues(
        temp_c_used=theta[0],
        rho_used=None if s.method != "D_DUCT" else rho[0],
        group_used=int(group[0]),
    )

    amp = _ampacity(tables, s)
    assert amp is not None
    values = dict(_numeric(amp))
    sizes = sorted(x for x in tables.sizes_mm2[s.conductor] if x in values)
    for size in sizes:
        i_tab = values[size]
        if i_tab is None:  # blank cell: data not available, never 0 (§3.2)
            return ElementSizing(
                **base, outcome="TABLE_GAP", notes=[f"Blank ampacity cell at {size:g} mm²."]
            )
        iz = i_tab * k_theta * k_rho * k_g  # (CB.3)
        cond1, cond2 = in_a <= iz, i2 <= CB2_FACTOR * iz  # (CB.1), (CB.2); I_B ≤ I_n by step 2
        if cond1 and cond2:
            cable = CableResult(
                conductor=s.conductor,
                insulation=s.insulation,
                method=s.method,
                size_mm2=size,
                i_tab_a=i_tab,
                k_theta=k_theta,
                k_rho=k_rho,
                k_g=k_g,
                lookup_values=lookup,
                iz_a=iz,
            )
            checks = Checks(
                cond1_ok=cond1,
                cond2_ok=cond2,
                margin_in_ib_a=in_a - e.ib_a,
                margin_iz_in_a=iz - in_a,
                margin_145iz_i2_a=CB2_FACTOR * iz - i2,
            )
            r_check, notes = _r_check(e, s, tables, size)
            return ElementSizing(
                **base,
                cable=cable,
                checks=checks,
                r_check=r_check,
                outcome="SIZED",
                notes=notes,
                warnings=["LINE_R_MISMATCH"] if r_check and r_check.flagged else [],
            )
    return ElementSizing(
        **base, outcome="NO_SIZE_FITS", notes=["No tabulated size meets CB.1/CB.2."]
    )


def _r_check(
    e: SizingElement, s: CableSizingSettings, tables: CableTables, size: float
) -> tuple[RCheck | None, list[str]]:
    """(CB.4), (CB.5) for Lines only (guideline §3.5)."""
    if e.element_kind != "LINE" or e.r_line_ohm_per_km is None:
        return None, []
    r20 = dict(_numeric(tables.r20_ohm_per_km.get(s.conductor) or {})).get(size)
    if r20 is None:
        return None, [f"No R20 for {size:g} mm² {s.conductor}: resistance check not made."]
    rt = corrected_resistance(r20, s.conductor, s.insulation)
    dev = abs(e.r_line_ohm_per_km - rt) / rt
    return (
        RCheck(
            r_line_ohm_per_km=e.r_line_ohm_per_km,
            r_cable_ohm_per_km=rt,
            temp_c=MAX_CONDUCTOR_TEMP_C[s.insulation],
            deviation_ratio=dev,
            flagged=dev > R_MISMATCH_RATIO,
        ),
        [],
    )
