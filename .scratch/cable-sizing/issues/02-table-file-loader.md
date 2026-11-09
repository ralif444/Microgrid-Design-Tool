# 02 Table file: schema, loader, validator
Status: done (ba61359)
Type: task
Blocked by: 01

Guideline §4. In `backend/src/mgapp/services/cable_sizing/`.
- Pydantic model of `cable_tables.json`; loader; validator giving `CABLE_TABLES_INCOMPLETE` and `CABLE_TABLES_UNCHECKED`.
- `table_set_hash`: SHA-256 with the Doc 3 §7 canonicalisation.
- Fictitious fixture under `tests/` (round numbers, labelled fake). Never PUIL values.

Done when: unit tests (test first) for both codes and table_hash_changes_on_edit pass.
