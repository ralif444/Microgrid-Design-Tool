# 05 — Architecture Decision Records (index)

## Ringkasan
Folder ini berisi sepuluh catatan keputusan arsitektur (ADR) untuk aplikasi web desain microgrid. Setiap ADR memuat konteks, pilihan yang dibandingkan, keputusan, konsekuensi, dan kondisi untuk meninjau ulang keputusan tersebut. Keputusan utama: *backend* FastAPI, *frontend* Next.js dalam mode *static export*, API JSON melalui HTTP, penyimpanan berupa berkas JSON berversi tanpa basis data, serta satu model status untuk semua analisis. Eksekusi bersifat sinkron dengan batas waktu dan batas ukuran *sweep*, dan seluruh perhitungan diisolasi di balik Engine Port sehingga aplikasi dapat dibangun lebih dahulu dengan Fake Engine. Server tidak menyimpan keadaan proyek; Project dipegang di peramban dan disimpan lewat ekspor/impor berkas. Metodologi pengembangan adalah iteratif-inkremental dengan gerbang fase. Beberapa margin keputusan lemah (Vite lawan Next.js, pustaka *state*) dan dinyatakan jujur di ADR terkait. Klaim perbandingan yang belum bersumber ditandai [NEEDS SOURCE].

| ADR | Title | Status | Drivers |
|---|---|---|---|
| [ADR-001](ADR-001-backend-fastapi.md) | Backend: FastAPI | Accepted | D1, D2, D3, D5, D6, D7; NFR-15, NFR-10 |
| [ADR-002](ADR-002-frontend-nextjs-static.md) | Frontend: Next.js static export | Accepted | D2, D3, D4, D5, D6, D7; NFR-02, NFR-03 |
| [ADR-003](ADR-003-api-style.md) | API style: JSON over HTTP, OpenAPI | Accepted (grouping approved by user 2026-10-17) | D2, D3, D5, D6; NFR-15, NFR-09 |
| [ADR-004](ADR-004-storage-file-json.md) | Storage: versioned JSON file | Accepted | D5, D6; NFR-12, NFR-16 |
| [ADR-005](ADR-005-frontend-state.md) | Frontend state: React built-in | Accepted, approved by user 2026-10-17 | D4, D5, D6, D7 |
| [ADR-006](ADR-006-status-error-handling.md) | Status and error handling | Accepted (HTTP mapping approved by user 2026-10-17) | D2, D3; FR-35, NFR-06, NFR-07 |
| [ADR-007](ADR-007-execution-sync.md) | Execution: synchronous | Accepted | D5, D6; FR-42..44, NFR-04 |
| [ADR-008](ADR-008-engine-port-fake-engine.md) | Engine Port + Fake Engine | Accepted | D1, D2, D3; NFR-07, NFR-08, NFR-10 |
| [ADR-009](ADR-009-dev-methodology.md) | Development methodology | Accepted | D6; NFR-18 |
| [ADR-010](ADR-010-stateless-backend.md) | Stateless backend | Accepted, approved by user 2026-10-17 | D2, D5, D6; FR-38, FR-46 |

## Self-review
- Weakest: ADR-002 (Vite margin) and ADR-005 (state library margin) are explicitly weak; ADR-010 shifts size and loss-of-work risk to the browser.
- Reviewer attack: "no comparative evidence for framework choices" — all such claims are untagged-as-fact or [NEEDS SOURCE]; decisions rest on drivers D1-D7.
- Doc 3 now defines `depends_on`, `result_hash` and M3c `scenarios`; no unresolved gap.
- Undecided: TIME_BUDGET, SWEEP_CAP values; enforcement mechanism (J6).

## Log delegasi
| Task | Agent | Output | Status |
|---|---|---|---|
| DOC5 | ADR writer | ADR-001..010 + README | Done |

Retries: 1 revision (orchestrator gap fixes)

DOC 5 COMPLETE
