# 04 Endpoint POST /api/analyses/CB
Status: done (2026-11-09)
Type: task
Blocked by: 03

Guideline §5.2–§5.3. Through the existing pipeline: stage-1 validation, canonicalise and hash, dependency check on an M2 RunRecordRef, RunRecord with engine fields null and `diagnostics.computed_by = "app"`. Flag off → UNAVAILABLE / NOT_APPLICABLE. Regenerate OpenAPI and TS types.

Done when: the contract tests in guideline §7 pass (Fake-Engine M2 fixtures).
