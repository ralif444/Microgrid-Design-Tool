"""Shared request fixtures.

FIXTURE ONLY: these numbers exercise plumbing with the Fake Engine; they are not design
values and carry no engineering claim. Shapes follow Doc 3 §3.
"""

from __future__ import annotations

from typing import Any


def two_bus_snapshot() -> dict[str, Any]:
    return {
        "nominal_voltage_kv": 0.4,
        "nominal_frequency_hz": 50.0,
        "buses": [{"id": "B1"}, {"id": "B2"}],
        "lines": [
            {
                "id": "L1",
                "from_bus_id": "B1",
                "to_bus_id": "B2",
                "r_ohm_per_km": 0.1,
                "x_ohm_per_km": 0.1,
                "length_km": 1.0,
            }
        ],
        "loads": [
            {"id": "LD1", "bus_id": "B1", "p_kw": 5.0, "q_kvar": 0.0},
            {
                "id": "LD2",
                "bus_id": "B2",
                "p_kw": 5.0,
                "power_factor": 1.0,
                "pf_direction": "LAGGING",
            },
        ],
        "load_profile": None,
        "inverters": [
            {
                "id": "INV1",
                "bus_id": "B1",
                "rated_kva": 10.0,
                "frequency_droop_hz_per_kw": 0.05,
                "voltage_droop_kv_per_kvar": 0.001,
                "frequency_setpoint_hz": 50.0,
                "voltage_setpoint_kv": 0.4,
                "tau_p_s": 0.05,
                "tau_q_s": 0.05,
            },
            {
                "id": "INV2",
                "bus_id": "B2",
                "rated_kva": 10.0,
                "frequency_droop_hz_per_kw": 0.05,
                "voltage_droop_kv_per_kvar": 0.001,
                "frequency_setpoint_hz": 50.0,
                "voltage_setpoint_kv": 0.4,
                "tau_p_s": 0.05,
                "tau_q_s": 0.05,
            },
        ],
        "design_constraints": {},
    }


PARAMETERS: dict[str, dict[str, Any]] = {
    "PS": {"inverter_margin_ratio": 0.2, "unit_count": 2, "redundancy": 0},
    "M1": {},
    "M2": {"inverter_margin_ratio": 0.2, "line_margin_ratio": 0.2},
    "M3a": {
        "parameter_paths": ["inverters/INV1/rated_kva"],
        "output_metrics": ["SYSTEM_FREQUENCY"],
        "step_relative": 0.01,
    },
    "M3b": {
        "axis": {
            "kind": "PARAMETER",
            "parameter_path": "inverters/INV1/rated_kva",
            "range_min": 5.0,
            "range_max": 15.0,
            "step_count": 3,
        }
    },
    "M3c": {},
    "M3d": {
        "axis_x": {"kind": "LOAD_SCALE", "range_min": 0.5, "range_max": 1.5, "step_count": 2},
        "axis_y": {
            "kind": "PARAMETER",
            "parameter_path": "inverters/INV1/rated_kva",
            "range_min": 5.0,
            "range_max": 15.0,
            "step_count": 2,
        },
    },
    "M4a": {},
    "M4b": {
        "disturbance": {
            "kind": "LOAD_STEP",
            "element_id": "LD1",
            "magnitude": 1.0,
            "start_time_s": 0.1,
            "duration_s": None,
        },
        "simulation_end_s": 1.0,
    },
}


def scenarios() -> list[dict[str, Any]]:
    return [
        {"scenario_id": "S1", "label": "base", "project_snapshot": two_bus_snapshot()},
        {"scenario_id": "S2", "label": "variant", "project_snapshot": two_bus_snapshot()},
    ]
