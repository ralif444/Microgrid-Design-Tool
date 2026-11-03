# 11 — Traceability Map and Executive Summary

> Doc 11 of 11. Inputs: Docs 1–8, 10, ADR-001…010 (read in full or by section as cited), `_ctx/TA_outline_v2.md` (existing skripsi outline, reference only), PROMPT_v2 (decisions 15, 17, 19), rules G–L. Doc 9 was written in parallel and is referred to as "Doc 9 register". Guardrail (decision 19): no equations; the approved RM/T wording is not touched.

## Ringkasan
Dokumen ini memetakan setiap dokumen arsitektur (Dokumen 1–10 dan kesepuluh ADR) ke bagian-bagian Bab I–III proposal yang akan ditulis, sehingga setiap klaim dalam proposal dapat ditelusuri ke sumbernya. Struktur proposal yang diasumsikan mengikuti kerangka skripsi, tetapi isinya menjelaskan aplikasi web, bukan model perhitungannya. Tujuan skripsi T1 tercakup penuh oleh kumpulan dokumen ini, sedangkan T2–T6 hanya tercakup pada tingkat spesifikasi karena model dan algoritmanya termasuk lingkup skripsi. Hal ini ditandai sebagai KONFLIK-T dengan dua opsi, tanpa memilih dan tanpa mengubah rumusan yang sudah disetujui. Dokumen ini juga memeriksa kepatuhan terhadap catatan dosen pembimbing secara jujur, termasuk kekurangannya. Ringkasan eksekutif satu halaman untuk dosen pembimbing ada pada Bagian 6, beserta daftar keputusan yang diperlukan dari beliau.

---

## 1. Proposal structure assumed
Whole table is **[ASSUMPTION]** pending supervisor: the proposal follows the skripsi outline (`TA_outline_v2.md`) but Bab I–III describe the web app; no mathematical formulation (decision 19, K1).

| Proposal section | Content at proposal level |
|---|---|
| **BAB I PENDAHULUAN** | |
| 1.1 Latar Belakang | |
| 1.1.1 Desain Awal *Microgrid* Terisolasi dan Alat Bantunya | General problem: early design of islanded AC microgrids needs fast electrical feasibility checks while the tool landscape is large and fragmented; one opening context paragraph of 2–3 sentences, each [PERLU REF-NONIEEE] (Q-PD-7) (UP-04, 2026-10-18). |
| 1.1.2 Alat Bantu Rekayasa Berbasis Peramban | Browser-based tool level as a design choice (local distribution through a browser, single user, no hosting); no claim that web is superior (Q-CL-15) (UP-04, 2026-10-18). |
| 1.1.3 Masalah Utama dan Penyebabnya | Problem tree at tool level: one main problem, three causes (scope mismatch of reviewed tools, result traceability, thin V&V evidence) and one design constraint outside the tree (app structure fixed before the engine exists, linked to the main RM-P) (UP-04, 2026-10-18; audit D1 N04). |
| 1.1.4 Pemecahan Masalah yang Sudah Tersedia | Existing design tools, counter-evidence first (HOMER, MDT, GridPACK), then scope limits; wording per Doc 9 S-01 (reworded) (UP-04, 2026-10-18). |
| 1.1.5 Kebutuhan Alat Bantu Desain dan Pengecekan Kelayakan | Need for a guided flow from load data to a checked preliminary design, with one verdict model, a re-runnable execution record and a readable report (UP-04, 2026-10-18). |
| 1.1.6 Masalah Spesifik Penelitian dan Celah | Hedged contribution (Q-CL-2): guided PS→M1–M4 workflow in one tool, traceable RunRecord and a PSIM validation plan; absence-based observation only as [INFERENSI] limited to reviewed tools (UP-04, 2026-10-18). |
| 1.2 Rumusan Masalah | Proposal-specific RM-P (§4.1, Option B). |
| 1.3 Tujuan | Proposal-specific T-P (§4.1, Option B). |
| 1.4 Manfaat | Users U1–U4 benefits. |
| 1.5 Ruang Lingkup dan Batasan | In/out scope, Won't list, local single-user. |
| 1.6 Sistematika Penulisan | Chapter overview. |
| **BAB II DASAR TEORI DAN APLIKASI** | |
| 2.1 Microgrid terisolasi, inverter *grid-forming*, *droop* | Domain concepts at specification level (no equations). |
| 2.2 Analisis yang dihosting aplikasi (PS, M1–M4) | One-line purpose per module (decision 19b). |
| 2.2.2 Tingkat pemodelan dan rencana garis besar mesin perhitungan | Method names and modelling level, no equations (D-41) (UP-15, 2026-10-18). |
| 2.3 Arsitektur aplikasi web | Client–server, static-export frontend, layered backend. |
| 2.4 API dan kontrak data | HTTP/JSON, OpenAPI, schema-first, status model. |
| 2.5 Batas Mesin Perhitungan, *Test Double*, dan Uji Kontrak | Engine Port, Fake Engine, contract suite; "ports and adapters" named only as a design choice, no pattern-theory citation (Q-CL-16) (UP-05, 2026-10-18). |
| 2.6 Metodologi pengembangan | Iterative-incremental, phase gates, V-model vocabulary. |
| 2.7 Reproduksibilitas | RunRecord, hashing, versioned file. |
| 2.8 Standar dan acuan | Only those verified from LR (rule 8: no unreviewed standard content). |
| 2.9 Penelitian terdahulu dan celah | From LR; not in the doc set. |
| 2.10 Kerangka pemikiran, definisi operasional | Glossary terms EN/ID. |
| **BAB III METODOLOGI** | |
| 3.1 Jenis dan desain penelitian | Rancang bangun (design-and-build). |
| 3.2 Diagram alir pengembangan iteratif | ADR-009 flowchart with gates and loop-backs. |
| 3.3 Kebutuhan sistem (PRD) | FR/NFR/DR. |
| 3.4 Pemilihan Kerangka Kerja dan Metodologi Pengembangan | Evaluation of alternatives against project criteria and decisions (ADR-001, 002, 005, 007, 009); thin margins stated openly (UP-09, 2026-10-18). |
| 3.5 Arsitektur Perangkat Lunak | C4 views, Engine Port, layering, deployment. |
| 3.6 Kontrak Data | Entities, units, validation, RunRecord, Project file. |
| 3.7 Desain API | 15 endpoints, status/error model. |
| 3.8 Desain Antarmuka Pengguna | S-01…S-17, flows F1–F4. |
| 3.9 Struktur Pengembangan | Repository layout, conventions. |
| 3.10 Rencana Verifikasi dan Validasi | Seams T1–T7, requirement↔test, offline M5 procedure. |
| 3.11 Peta Jalan Implementasi | P0–P4 with gates. |
| 3.12 Spesifikasi Perangkat dan Lingkungan | Toolchain, run environment. |
| 3.13 Etika dan Penggunaan Kecerdasan Artifisial | AI-use disclosure; AI/LLM features = Future Work. |

## 2. Document → proposal section map
Every doc 01–10 and each ADR appears at least once. "—" = no gap beyond tags already in Doc 9 register.

| Proposal section | Feeding doc(s) and § | What it supplies | Gap / [NEEDS SOURCE] |
|---|---|---|---|
| 1.1.1–1.1.2 | Doc 1 §1–2 | Problem, motivation | [NEEDS SOURCE] global/remote-area statistics; none in doc set (LR, skripsi draft 1.1.1–1.1.2 only, not read here) |
| 1.1.3 | Doc 1 §1–2; Doc 4 §1 | Problem tree at tool level | S2 (traceability claim) [NEEDS SOURCE] |
| 1.1.4 | Doc 1 §1 item 2 | Existing-tool statement | S1 (HOMER, ETAP, PowerFactory) [NEEDS SOURCE]; LR B09 is the first place to look (Doc 1 §11) |
| 1.1.5 | Doc 1 §3 (PO-1…PO-6), §8 J1 | Need for guided pipeline | — |
| 1.1.6 | Doc 1 §1 item 4, §11; ADR-008, ADR-010 | Research gap: fixed architecture before engine | Gap is an opinion until S1/S2 sourced |
| 1.2, 1.3 | Doc 1 §3, §9 (A3, K1) | PO list for mapping | KONFLIK-T (§4) |
| 1.4 | Doc 1 §6 (U1–U4), §7 | Beneficiaries, key tasks | — |
| 1.5 | Doc 1 §4; Doc 2 §6; Doc 10 §3.6 | In/out scope, Won't, MoSCoW | Thesis exclusions list quoted from decisions, no source needed |
| 1.6 | This doc §1 | Chapter overview | — |
| 2.1–2.2 | Doc 3 §2 (glossary), §6 (payload quantities); Doc 2 §2.7–2.10 | Domain terms, module purposes | Concept theory → LR batches (not in doc set) [NEEDS SOURCE]; equations → skripsi scope |
| 2.3 | Doc 4 §2–4, §8; ADR-001, ADR-002, ADR-010 | Architecture theory application | Framework comparative claims (popularity, performance) [NEEDS SOURCE] unless from official docs |
| 2.4 | Doc 6 §1, §3, §5; Doc 3 §5; ADR-003, ADR-006 | API/style/status concepts | Theory on HTTP/OpenAPI needs references [NEEDS SOURCE] |
| 2.5 | Doc 4 §5; ADR-008; Doc 8 §4 (T2), §5 | Port/adapter, Fake Engine | Software-engineering references [NEEDS SOURCE] |
| 2.6 | ADR-009; Doc 10 §4; Doc 8 §6 | Methodology comparison, V-model vocabulary | Methodology literature (Waterfall, V-model, Scrum) [NEEDS SOURCE] |
| 2.7 | Doc 3 §7–8; Doc 6 §6; ADR-004; Doc 2 §2.13–2.14 | RunRecord, Project file | — |
| 2.8 | Doc 2 §6 (standards not reviewed) | Placeholder only | Rule 8: no content of IEEE 1547, IEEE 2030.7/2030.8, IEC TS 62898, PUIL/SPLN, ESDM rules; none of Docs 1–10 supplies it → [PERLU REF] |
| 2.9 | none | — | Entire section unfed: from LR / skripsi 2.10 |
| 2.10 | Doc 3 §2; Doc 1 §3 | Operational definitions | — |
| 3.1 | ADR-009; Doc 1 J1 | Design-and-build framing | Supervisor wording of "jenis penelitian" unknown |
| 3.2 | ADR-009 flowchart; Doc 10 §2 | Iterative flowchart with gates, loop-backs | — |
| 3.3 | Doc 2 §1–5, §7 | FR/NFR/DR, MoSCoW, story coverage | — |
| 3.4 | ADR-001, 002, 005, 007, 009; Doc 4 §8; Doc 9 D-40 | Evaluation of framework and methodology alternatives against project criteria; decisions with justification | Official framework documentation [PERLU REF-NONIEEE]; methodology wording per Doc 9 S-05, S-06; thin margin stated openly (UP-09, 2026-10-18) |
| 3.5 | Doc 4 §1–10; ADR-008, 010 (ADR-001, 002, 005, 007 now in 3.4) | C4, Engine Port, layers, deployment | ADR-007 J6 mechanism = implementation detail [ASSUMPTION] |
| 3.6 | Doc 3 §1, §3–8 | Entities, units, rules, schemas | Default DesignConstraints basis [NEEDS SOURCE]; voltage-band "common practice" [NEEDS SOURCE] |
| 3.7 | Doc 6 §2–8; ADR-003, ADR-006 | Endpoint list, status/error model | Values `TIME_BUDGET`, `SWEEP_CAP`, 413 limit unmeasured [ASSUMPTION] |
| 3.8 | Doc 7 §1–8; ADR-002, ADR-005 | Screens, navigation, flows, wireframes | Exact report content [ASSUMPTION] (Doc 2 #14) |
| 3.9 | Doc 8 §1–3 | Folder tree, module duties, conventions | Package name, file extensions [ASSUMPTION] |
| 3.10 | Doc 8 §4–8; Doc 2 §3 | Seams T1–T7, requirement↔test, DoD, offline M5 procedure | Browser list, tooling [ASSUMPTION]; PSIM tolerance values → skripsi scope |
| 3.11 | Doc 10 §1–5; ADR-009 | P0–P4 with entry/exit gates, durations | Durations relative weeks [ASSUMPTION]; seminar date not fixed |
| 3.12 | Doc 8 §3, §9 #5; Doc 4 §8 | Toolchain, local run | Hardware/brand specifications absent from doc set (see §5) |
| 3.13 | Doc 1 §5; PROMPT_v2 dec. 13 | AI/LLM = Future Work; AI-use disclosure | Campus AI-use rules not in doc set |
| Whole proposal | Doc 9 register | All tags | Written in parallel; item numbers not cross-checked here |

ADR coverage: ADR-001 → 2.3, 3.4; ADR-002 → 2.3, 3.4, 3.8; ADR-003 → 2.4, 3.7; ADR-004 → 2.7, 3.6; ADR-005 → 3.4, 3.8; ADR-006 → 2.4, 3.7; ADR-007 → 3.4, 3.7; ADR-008 → 2.5, 3.5; ADR-009 → 2.6, 3.1, 3.2, 3.4, 3.10; ADR-010 → 2.3, 3.5; ADR README → index for 3.4, 3.5 (UP-09, 2026-10-18).

## 3. Proposal section ← requirement / decision coverage

| Bab III subsection | FR / NFR / DR groups | ADR | Screens / flows | Endpoints | Test seams / gates |
|---|---|---|---|---|---|
| 3.2 Diagram alir | NFR-18 | ADR-009 | — | — | Doc 10 gates EG/XG |
| 3.3 Kebutuhan | all FR-01…FR-60, NFR-01…18, DR-01…09; Doc 12 extensions FR-61…FR-98 | — | — | — | NFR-09 (every FR has a test) |
| 3.4 Pemilihan kerangka kerja dan metodologi | — (selection by project criteria; no new FR/NFR group) | ADR-001, 002, 005, 007, 009 | — | — | — |
| 3.5 Arsitektur | FR-21, FR-35, FR-36, FR-42, FR-43, FR-46–FR-48; NFR-02, 07, 08, 10, 11, 14, 17 | ADR-008, 010 | — | `/api/health`, `/api/meta` | T2, T6 |
| 3.6 Kontrak data | FR-03–FR-05, FR-10–FR-16, FR-47, FR-54–FR-57; NFR-05, NFR-12, NFR-16; DR-09 | ADR-004 | S-03, S-05, S-06 | `/api/projects/validate`, `/api/projects/import` | T4, T7 |
| 3.7 Desain API | FR-17–FR-25, FR-35–FR-45; NFR-04, 06, 15 | ADR-003, 006, 007 | — | all 15 endpoints | T1, T2 |
| 3.8 Antarmuka | FR-14, FR-26, FR-45, FR-58–FR-60; Doc 12 FR-86–FR-93 (UX round X0–X7, D-72), FR-94–FR-98 (SLD X8, D-75); NFR-03, 05, 13 | ADR-002, 005, 013 | S-01…S-17, F1–F4 | — | T5, T7 |
| 3.9 Struktur | NFR-10, 11, 15, 17 | ADR-001, 002 | — | — | T6 |
| 3.10 Verifikasi dan validasi | NFR-01, 07, 08, 09, 12, 14, 16; FR-49–FR-53 | ADR-008, 009 | S-15, F3 | `/api/run-records/verify`, `/rerun` | T1–T7; offline M5 (procedure) |
| 3.11 Roadmap | NFR-18; scheduling of all FR | ADR-009 | — | — | XG-P0…XG-P4 |
| 3.13 Etika | DR-01, DR-02, DR-05, DR-08 | — | — | — | review |

## 4. Objectives mapping (PO ↔ T)
RM/T are **not reworded**. T1 is the only quoted wording; T2–T6 below are the outline's own short descriptions (`TA_outline_v2.md`), shown for mapping only and not the approved sentences.

| Thesis T (approved wording, short) | Product objectives (Doc 1 §3) | Doc-set coverage in proposal |
|---|---|---|
| T1: "Merumuskan kebutuhan sistem, alur kerja, dan arsitektur perangkat lunak yang terintegrasi." | PO-1 (pipeline), PO-4 (Engine Port), PO-5 (portable files), PO-6 (report) | **Full**: Docs 2, 4, 6, 7, 8 and ADRs |
| T2: model + algorithm of slack-free droop power flow (M1), assumptions, verification strategy | PO-2 (status), PO-3 (RunRecord) | **Spec-level only**: M1 purpose, I/O quantities, validation rules, status set, test plan; model and algorithm → skripsi scope |
| T3: constraint check, preliminary sizing, loading margin (M2) | PO-2 | **Spec-level only**: M2/SizingCheck contract, limiting constraints; margin and sizing method → skripsi scope |
| T4: influence of droop parameters etc. via M3 sweep; best-design rule R1 | PO-2, PO-3 | **Spec-level only**: M3a–d contract, caps; analysis and rule R1 → skripsi scope. Rule R1 does not appear in the doc set. |
| T5: reduced-order small-signal and transient stability model (M4) with validity indicators | PO-2 | **Spec-level only**: M4a/M4b contract; model and indicators → skripsi scope |
| T6: validation framework vs PSIM average model (M5) | PO-3 | **Spec-level only**: offline procedure (Doc 8 §7), no numbers; cases, tolerance and results → skripsi scope |

Plain statement: **T1 is fully covered; T2–T6 are covered only at specification level** (module purpose, I/O quantities with units, validation rules, test plan, PSIM procedure). Their models and algorithms are skripsi scope. PO-1…PO-6 are product objectives, not Tujuan; Doc 1 A3 assumes they map onto the approved T without rewording T. This mapping shows the assumption holds well for T1 and weakly for T2–T6.

**KONFLIK-T — DECIDED by user 2026-10-17: Option B** (supervisor consent still needed at bimbingan): if the proposal reuses RM2–RM6/T2–T6 as written, Bab I–III promise calculation-model content that the proposal does not contain (decision 19, K1). Options, **not chosen here**:

| Option | Description | Effect | Recommendation |
|---|---|---|---|
| A | Proposal keeps RM/T identical to the skripsi; Bab III states that T2–T6 are realised after implementation, with specification-level design in the proposal. | Single objective set, easy traceability; reviewers may ask where the models are. | — |
| B | Proposal has its own RM/T focused on the web app (framework, architecture, methodology, verification plan); skripsi RM/T stay as approved and are mapped in Bab I scope. | Proposal internally consistent with Bab III; two objective sets to keep in sync (the double bookkeeping Doc 1 §11 warned about). | **Recommended** by this doc (not decided): Bab III can then justify every Tujuan. Needs supervisor consent. |

### 4.1 Proposal RM-P / T-P — Approved by user 2026-10-18 (Q-PD-1); supervisor approval pending (Option B) (UP-10, 2026-10-18)

Skripsi RM1–RM6 / T1–T6 stay unchanged. The proposal gets its own problem statements and objectives, worded in Indonesian with Bloom-taxonomy verbs (level in brackets, revised Bloom: C4 analyse, C5 evaluate, C6 create) [ASSUMPTION: verb levels per the common revised-Bloom reading; confirm against the faculty guideline].

**RM-P utama.** Bagaimana aplikasi web alat bantu desain awal *microgrid* AC terisolasi berbasis inverter *grid-forming* berkendali *droop* dirancang agar terstruktur, dapat diuji, dan hasilnya dapat ditelusuri, sehingga mesin perhitungan dapat dipasang kemudian tanpa merancang ulang aplikasi?

| ID | Rumusan masalah (RM-P) | Tujuan (T-P) | Bloom | Feeding docs | Skripsi link |
|---|---|---|---|---|---|
| P1 | Bagaimana kebutuhan fungsional dan nonfungsional serta alur kerja pengguna alat bantu dirumuskan dari alur kerja desain awal dan literatur alat yang ditinjau? | Menganalisis kebutuhan dan merumuskan alur kerja pengguna alat bantu beserta kriteria penerimaannya. | C4 | Doc 1, Doc 2 | part of T1 |
| P2 | Bagaimana arsitektur aplikasi, batas mesin perhitungan (*Engine Port*), kontrak data, model status, dan antarmuka pengguna dirancang agar perhitungan dapat diperlakukan sebagai kotak hitam yang dapat diganti? | Merancang arsitektur berlapis, *Engine Port*, kontrak data bersatuan, model status tunggal, dan antarmuka pengguna aplikasi. | C6 | Doc 3, Doc 4, Doc 6, Doc 7, ADR-006/008/010 | part of T1; interfaces for T2–T5 |
| P3 | Bagaimana kerangka kerja perangkat lunak dan metodologi pengembangan dipilih serta dijustifikasi untuk pengembang tunggal dengan batasan lokal? | Mengevaluasi alternatif kerangka kerja dan metodologi pengembangan, lalu menetapkan pilihan beserta justifikasinya. | C5 | Doc 5 (ADR-001…005, 007, 009) | part of T1 |
| P4 | Bagaimana strategi verifikasi aplikasi, mekanisme reproduksibilitas hasil, dan rencana validasi mesin terhadap PSIM dirancang beserta tahapan implementasinya? | Merancang strategi verifikasi berbasis *Fake Engine*, mekanisme *RunRecord*, rencana validasi terhadap PSIM, dan peta jalan implementasi bergerbang. | C6 | Doc 8, Doc 10, ADR-008/009 | procedure for T6; T2–T5 realised in skripsi |

Expected proposal outputs (in place of K for Bab V, which the proposal does not have): O1 requirements baseline (P1); O2 architecture + contracts (P2); O3 ADR set (P3); O4 verification plan + roadmap (P4). Each RM-P ↔ T-P ↔ Bab III subsection ↔ output is one-to-one, as the project rules require.

## 5. Supervisor-note compliance check

| Supervisor note | How the doc set supports it | Gap |
|---|---|---|
| Inverted pyramid, Latar Belakang ~10 pages | Doc 1 §1–3 gives problem, motivation, objectives; Doc 1 §11 flags weak sourcing | No page budget or outline per level; global/remote-area content (1.1.1–1.1.2) not in doc set; S1/S2 unsourced |
| Urgency and novelty | Doc 1 §1 item 4, ADR-008/010 (fixed architecture before engine; Run Record traceability) | Novelty rests on S1/S2 [NEEDS SOURCE]; no comparison with existing tools |
| Tujuan in Bloom taxonomy, linked to method and conclusions | T unchanged; §4 maps PO↔T; Doc 8 §6 maps requirement↔test | PO wording is not Bloom-verb based; no Bab V conclusions in proposal to link; depends on KONFLIK-T |
| Bab II from ~30 papers, redrawn figures | Doc 4 and Doc 10 contain Mermaid diagrams that can be redrawn as original figures | Doc set cites no papers; literature must come from LR; no figure list; software-engineering theory needs IEEE/Elsevier sources [NEEDS SOURCE]; non-IEEE/Elsevier sources would be [PERLU REF-NONIEEE] |
| Bab III step-by-step, with looping flowchart | ADR-009 flowchart, Doc 10 §2 (gates, loop-backs), Doc 1 J1 | Looping is the development loop, not a research-procedure loop with parameter variation |
| Independent vs dependent variables | Not applicable to a design-and-build methodology as written | **Honest gap**: only a stretch analogy exists (inputs = Project design; outputs = Status, payload), and it must not be presented as research variables without supervisor agreement |
| Parameter variation | M3a–d are sensitivity, sweep, scenario, envelope features of the app; skripsi methodology draft (DRAF_TA v2 §3.8–3.10) defines 4 reference designs, 7 independent variables, sweep plan and rule R1 | Method and results are skripsi scope; proposal Bab IV 4.6 records the design without results (K-06, 2026-10-21); contract gaps open (Doc 9 Q-17) |
| Specifications and brands | Doc 8 §3, §9 #5 list tool categories; Doc 4 §8 local deployment | Tool names are [ASSUMPTION]; versions not pinned; no laptop/OS/browser specification (browser list [ASSUMPTION], Doc 8 #4) |
| Replicable | Start procedure (NFR-02), RunRecord with engine commit (FR-47), tool versions pinned at P0 (XG-P0 item 5a) and engine version/commit at P2, Doc 10 gates, fixtures (Doc 8 §5) | Versions unpinned until P0; replicability is of the tool, not of experimental results (C5.20, 2026-10-21) |
| Mathematical modelling | Spec-level only (decision 19) | **KONFLIK (pending supervisor)**: K1 resolved by user, K2 accepted by user; no supervisor confirmation yet; proposal v2 adds method-level plan (D-41) (UP-15, 2026-10-18) |

## 6. Ringkasan Eksekutif (untuk Dosen Pembimbing)

**Masalah.** Insinyur junior yang merancang *microgrid* AC terisolasi dengan inverter *grid-forming* berkendali *droop* belum memiliki alat ringan yang membawanya dari data beban ke rancangan awal yang sudah diperiksa. Hasil perhitungan juga sulit ditelusuri ke masukan dan pengaturan yang menghasilkannya. Pernyataan tentang perangkat lunak yang ada masih memerlukan sumber sebelum masuk ke proposal.

**Yang dibangun.** Aplikasi web lokal untuk satu pengguna dengan alur bertahap: data beban, saran kapasitas awal, desain jaringan, aliran daya, pemeriksaan batasan, analisis lanjutan, dan laporan. Setiap analisis menghasilkan satu dari enam status yang tegas, dan setiap eksekusi menghasilkan catatan (*RunRecord*) yang dapat diekspor serta dijalankan ulang.

**Cara kerja.** Peramban memegang *Project* yang sedang dibuka; server tidak menyimpan apa pun dan menerima setiap permintaan secara lengkap. Lapisan API memeriksa masukan, menghitung *hash*, dan membuat *RunRecord*, lalu meneruskan analisis lewat satu antarmuka, yaitu *Engine Port*. Di balik antarmuka itu ada *Fake Engine* yang dibangun lebih dahulu, dan mesin hitung sesungguhnya dipasang kemudian tanpa mengubah aplikasi. Seluruhnya berjalan sebagai satu proses lokal.

**Tumpukan teknologi.** FastAPI (Python) dipilih karena mesin hitung kelak ditulis dalam Python dan skema Pydantic menghasilkan deskripsi API otomatis. Next.js dalam mode *static export* dipilih karena antarmuka membutuhkan penyunting jaringan interaktif dan tipe data dapat dibangkitkan dari deskripsi API; selisih keunggulannya dibanding alternatif yang lebih sederhana tergolong tipis, dan hal ini dinyatakan terbuka dalam ADR.

**Metodologi pengembangan.** Pengembangan bersifat iteratif-inkremental dengan gerbang fase P0 sampai P4, dimulai setelah proposal diterima. Aplikasi dibangun dan diuji terhadap *Fake Engine* lebih dahulu; mesin sesungguhnya masuk pada P2, saat pekerjaan skripsi dimulai. Setiap fase memiliki gerbang masuk dan keluar yang dapat diperiksa.

**Pemeriksaan kebenaran.** Pengujian utama dilakukan pada antarmuka API dengan *Fake Engine*, ditambah satu rangkaian uji kontrak yang harus lulus pada setiap mesin, uji reproduksibilitas atas *RunRecord*, dan uji berkas proyek. Uji peramban hanya untuk alur utama. Kebenaran mesin hitung tidak diuji oleh aplikasi, tetapi dibandingkan dengan PSIM secara luring setelah mesin tersedia.

**Batasan.** Proposal tidak memuat rumusan matematika; model dan algoritma menjadi lingkup skripsi. Aplikasi tidak memiliki autentikasi, basis data, maupun hosting, dan fitur AI/LLM hanya menjadi pekerjaan lanjutan.

**Keputusan yang dibutuhkan dari Bapak/Ibu.**
1. Menyetujui rumusan masalah dan tujuan khusus proposal (Opsi B, Bagian 4.1), yang terpisah dari RM/T skripsi.
2. Menyetujui struktur Bab I–III pada Bagian 1.
3. Menyetujui bahwa proposal tanpa rumusan matematika dan tanpa variabel bebas-terikat klasik dapat diterima untuk Bab III (KONFLIK K1/K2).
4. Menetapkan tanggal seminar, karena durasi fase masih asumsi.
5. Menyampaikan kebutuhan jumlah acuan dan format gambar untuk Bab II.

## 7. Open points

| # | Item | Tag | → doc |
|---|---|---|---|
| 1 | Proposal Bab I–III structure (§1) | [ASSUMPTION] | 9 |
| 2 | KONFLIK-T resolved: Option B chosen by user; RM-P/T-P wording in §4.1 approved by user 2026-10-18 (Q-PD-1), supervisor approval pending (UP-10, 2026-10-18) | DECIDED (user) / wording approved by user, supervisor pending | 9 |
| 3 | Supervisor "mathematical modelling" note (K1, K2) | KONFLIK (pending supervisor) | 9 |
| 4 | S1 existing-tool claims; S2 traceability claim | [NEEDS SOURCE] | 9 |
| 5 | Bab II literature (~30 papers) and standards content absent from the doc set | [NEEDS SOURCE] | 9 |
| 6 | Independent/dependent variables for a software methodology | [ASSUMPTION] pending supervisor | 9 |
| 7 | Specifications/brands: tool versions and hardware not fixed | [ASSUMPTION] | 8, 9 |
| 8 | Seminar date and phase durations | [ASSUMPTION] | 9, 10 |
| 9 | Campus rules on AI use not in doc set | [NEEDS SOURCE] | 9 |
| 10 | Rule R1 and PSIM case list belong to skripsi; none in doc set | → skripsi scope | — |

## 8. Self-review
- **Weakest point:** §2 shows Bab II 2.1, 2.2, 2.8, 2.9 are barely fed by the doc set; Bab II needs the LR, and the doc set supplies only software-side theory seeds without references.
- **Skeptical reviewer would attack:** (a) proposal objectives that differ from the thesis RM/T (KONFLIK-T); (b) no variables or parameter variation in Bab III; (c) novelty rests on unsourced S1/S2; (d) only three of ten supervisor notes are well supported (§5).
- **Undecided:** KONFLIK-T option, proposal structure, supervisor consent on no-math scope.
- **Checks done:** every doc 01–10 and all ten ADRs appear in §2; no equation; RM/T text unchanged (only T1 quoted; T2–T6 taken from the outline, labelled). Doc 9 item numbers not cross-checked (written in parallel). `_ctx/PROMPT_v2.md` has no "supervisor note" list; notes were taken from the T_TRACE task brief.

## Log delegasi (Task "Doc 11 drafting", Model sonnet)

| Task | Model | Retries/escalation | Orchestrator fixes |
|---|---|---|---|
| Doc 11 drafting | sonnet | 0 | — |
| Option B applied + RM-P/T-P draft | Opus (orchestrator) | — | KONFLIK-T decided by user; draft wording added as §4.1 (pending approval) |
| UP-04 edit | sonnet | 0 | – |
| UP-05 edit | sonnet | 0 | – |
| UP-09 edit | sonnet | 0 | – |
| UP-10 edit | sonnet | 0 | – |
| UP-15 edit | sonnet | 0 | – |

DOC 11 COMPLETE

## Change log 2026-10-21 (user-approved change proposals from the proposal design checks)
- C5.20 replicability row: tool versions pinned at P0, engine at P2.
- Parameter-variation row updated for K-06 (proposal records skripsi parametric design without results).

## Change log 2026-11-03 (SLD round, D-75)
- §3: rows 3.3 and 3.8 name FR-94 – FR-98 (Doc 12 X8) and ADR-013. Order: UX-4 absorbed into SLD-4; UX-3 resumes after SLD-7 (Doc 10 §4.1).

## Change log 2026-11-03 (UX and analytics round, D-72)
- §3: rows 3.3 and 3.8 name the Doc 12 extensions (FR-61 – FR-93), including the UX round X0–X7 (FR-86 – FR-93).
