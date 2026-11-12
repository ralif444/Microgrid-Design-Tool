"""App-side battery service (Doc 12 B1 – B3, ADR-015). Never imports the engine or an adapter."""

from mgapp.services.battery.banks import bank_issues

__all__ = ["bank_issues"]
