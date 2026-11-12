"""Component Catalogue and catalog_ref (Doc 12 §3.3, FR-64 - FR-72; Doc 9 D-61).

The Catalogue is its own file, independent of any Project; the app ships no entries (D-59
K107). Entries are lenient on presence so an incomplete entry can be stored; the selection
guard (services/catalog.py) decides whether it may be used in a Project.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from mgapp.domain.base import Model

CATALOG_SCHEMA_VERSION = 1


class Provenance(Model):
    """As entered by the user (FR-65)."""

    manufacturer: str | None = None
    model: str | None = None
    document: str | None = None  # datasheet title or document id
    revision: str | None = None  # revision or date


class InverterValues(Model):
    # used by the model (FR-67)
    rated_kva: float | None = None
    nominal_voltage_kv: float | None = None  # line-to-line
    nominal_frequency_hz: float | None = None
    frequency_droop_min_hz_per_kw: float | None = None
    frequency_droop_max_hz_per_kw: float | None = None
    voltage_droop_min_kv_per_kvar: float | None = None
    voltage_droop_max_kv_per_kvar: float | None = None
    tau_in_s: float | None = None  # optional; pre-fills M4a τ_in (FR-71)
    grid_forming: bool | None = None  # declared grid-forming capability (FR-66)
    grid_forming_reference: str | None = None  # datasheet place of that declaration
    # stored and shown, not used by the model (A2)
    overload_ratio: float | None = None
    current_limit_a: float | None = None
    output_filter: str | None = None
    efficiency_ratio: float | None = None
    dc_voltage_min_v: float | None = None
    dc_voltage_max_v: float | None = None


class ConductorValues(Model):
    r_ohm_per_km: float | None = None
    x_ohm_per_km: float | None = None
    rx_conditions: str | None = None  # stated conditions of r and x (FR-68)
    ampacity_a: float | None = None
    ampacity_conditions: str | None = None  # reference installation conditions
    shunt_capacitance_uf_per_km: float | None = None  # not used by the model (A4)
    # X10 cable sizing match only (D-104 K293); an entry without all four never matches
    material: Literal["CU", "AL"] | None = None
    insulation: Literal["PVC", "XLPE"] | None = None
    cores: int | None = Field(default=None, ge=1)
    size_mm2: float | None = Field(default=None, gt=0)


class BreakerValues(Model):
    """X10 Catalogue kind BREAKER (FR-115, D-104 K296); matched on standard and in_a."""

    standard: str | None = None
    device_class: Literal["MCB", "MCCB"] | None = Field(default=None, alias="class")
    in_a: float | None = Field(default=None, gt=0)
    curve: str | None = None
    poles: int | None = Field(default=None, ge=1)


class BatteryModuleValues(Model):
    """Battery round kind BATTERY_MODULE (FR-73, D-106 K308); used by B1 and B2 only, never by
    the network model (A2)."""

    energy_kwh: float | None = Field(default=None, gt=0)
    nominal_voltage_v: float | None = Field(default=None, gt=0)
    voltage_min_v: float | None = Field(default=None, gt=0)
    voltage_max_v: float | None = Field(default=None, gt=0)
    discharge_power_kw: float | None = Field(default=None, gt=0)  # continuous, per module
    c_rate_per_h: float | None = Field(default=None, gt=0)
    recommended_dod_ratio: float | None = Field(default=None, gt=0, le=1)


class CatalogEntry(Model):
    id: str
    kind: Literal["INVERTER", "CONDUCTOR", "BREAKER", "BATTERY_MODULE"]
    provenance: Provenance = Provenance()
    sources: dict[str, str] = {}  # value field -> page or section in the document (FR-65)
    inverter: InverterValues | None = None
    conductor: ConductorValues | None = None
    breaker: BreakerValues | None = None
    battery_module: BatteryModuleValues | None = None


class Catalog(Model):
    schema_version: int
    app_version: str
    entries: list[CatalogEntry]


class CatalogRef(Model):
    """Copied with the values into an Inverter or Line (FR-69); part of the snapshot."""

    entry_id: str
    provenance: Provenance
    sources: dict[str, str] = {}  # sources of the copied values
    catalog_schema_version: int
    modified: bool = False  # a copied value was edited in the Project
    current_limit_confirmed: bool = False  # Line: ampacity taken as current limit (FR-70)
    tau_in_s: float | None = None  # Inverter: entry τ_in for the M4a pre-fill (FR-71)
