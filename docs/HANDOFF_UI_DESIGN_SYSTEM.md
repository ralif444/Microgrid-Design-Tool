# Handoff: UI design system Microgrid Design Tool (status 2026-11-03)

Dokumen ini merangkum konteks, keputusan, dan progres sesi kerja dengan Claude Code sampai 2026-11-03. Tujuannya: bisa ditempel ke chat Claude biasa (tanpa akses repo) untuk brainstorming langkah berikutnya. Semua isi diambil dari repo dan riwayat sesi. Tidak ada angka hasil rekayasa yang ditambahkan.

---

## 1. Proyeknya apa

- **Microgrid Design Tool**: web app lokal untuk satu pengguna. Dipakai untuk desain awal microgrid AC terisolasi (islanded) dengan inverter grid-forming berbasis droop, untuk analisis keadaan tunak (steady-state) dan stabilitas. Ini bagian dari skripsi atau seminar proposal.
- **Sumber kebenaran:** naskah proposal final `Seminar.pdf` (28-10-2026). Dokumen teknis ada di `docs/`:
  - Doc 01–14 berisi brief, PRD, glosarium dan kontrak, arsitektur, ADR, API, UI/IA, struktur, register keputusan, roadmap, traceability, ekstensi, validasi PSIM, dan daftar keselarasan.
  - Kalau ada konflik, naskah yang menang.
- **Stack:**
  - Frontend: Next.js 16 dengan static export (tanpa SSR, API route, atau server action), React 19, dan store Context + reducer (ADR-005).
  - Backend: FastAPI (`mgapp`) yang menyajikan frontend statis.
  - Engine numerik (`mgengine`) berada di balik **Engine Port**. Ada dua implementasi: **Fake Engine** (hasil placeholder) dan **Real Engine**.
- **Alur pipeline (stepper):** Project → 1 Loads → 2 Sizing advice (PS) → 3 Network → 4 Constraints → 5 Power flow (M1) → 6 Constraint check (M2) → 7 Further analyses (M3a Sensitivity, M3b Sweep, M3c Scenarios, M3d Envelope, M4a Small-signal, M4b Transient) → 8 Report. Run history dan Catalogue bisa dibuka dari header.
- **Status hasil analisis:** FEASIBLE, INFEASIBLE, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INPUT_INVALID, UNAVAILABLE (dengan status_code seperti TIMEOUT, DEPENDENCY_NOT_MET, ENGINE_ERROR).

### Aturan proyek yang mengikat
- Engine hanya diakses lewat Engine Port; app tidak mengimpor bagian dalam engine.
- Jangan mengarang nilai, data, parameter, atau referensi. Nilai hanya boleh berasal dari naskah atau sumber yang terverifikasi.
- Hasil Fake Engine tidak boleh dilaporkan sebagai hasil engine.
- Asumsi model A1–A6 dan daftar out-of-scope di naskah sudah tetap. Ekstensi tidak boleh menambah persamaan, state, atau asumsi.
- Perubahan kontrak Doc 03/06 hanya boleh lewat ADR atau entri register Doc 09.
- Setiap paket kerja ditutup dengan:
  - check, test, dan E2E yang lolos;
  - commit dan push ke branch `tahap-1.5`;
  - satu baris di `docs/gate_log.md`.
- Lingkungan: laptop Windows 11. Perintah `python` di PATH adalah Python 3.8 milik ETAP, jadi jangan dipakai. Skrip dijalankan dengan `uv run --python 3.13 python tools\<nama>.py`. Jangan pakai `npx`; pakai `frontend/node_modules/.bin/*`.

---

## 2. Posisi sebelum sesi design system

- Tahap 1.x sudah selesai sampai **WP 1.7.4**: demo dari salinan bersih di Real Engine, perbaikan K147 (angka M2 dibulatkan, margin M2 diingat dari RunRecord terakhir), dan keputusan D-70 serta D-71 yang sudah dikonfirmasi pengguna.
- Rilis kandidat sudah ditandai dengan tag **`v0.1.0-rc1`** (commit 6452425). PR ke `main` (#4) masih terbuka.

---

## 3. Sesi ini: UI design system (ADR-011)

### 3.1 Audit (sebelum perubahan)
File `docs/design/ui_audit_2026-11-03.md` memuat 10 masalah teratas. Screenshot-nya ada di `docs/design/audit-2026-11-03/`. Ringkasnya:
1. Angka float mentah dengan 15–17 digit di tabel hasil.
2. Header berupa satu baris panjang berisi 17 link, tanpa stepper yang terlihat.
3. Status banner mengulang isinya sendiri, dan dua peran memakai warna yang sama.
4. Hasil hilang setelah pindah layar, karena state-nya hanya lokal di layar. Ini **masalah store, bukan styling**.
5. Perataan tabel kacau, karena `lang="id"` memicu aturan CSS `td:lang(id)`.
6. Satuan kadang ditaruh di sel, kadang di header.
7. Form tidak terstruktur, dan tab Network tidak punya keadaan "terpilih".
8. Tidak ada hierarki atau kontrol kepadatan, dan tidak ada lebar maksimum.
9. Fokus keyboard tidak didesain, dan `lang` halaman salah.
10. Perlakuan untuk Advice, Fake, dan status tidak jelas; selain itu chart memotong label.

### 3.2 Keputusan: ADR-011 opsi A (disetujui pengguna 2026-11-03)
- Desain ditulis sebagai **CSS custom-property tokens** di `frontend/app/tokens.css`, ditambah sheet dasar global `globals.css` dan **CSS Modules** per komponen. **Tidak ada dependency baru.**
- Batasan keras yang dipegang:
  - static export saja, sepenuhnya offline (tanpa CDN atau font remote);
  - tidak mengubah reducer, kontrak API, atau bentuk data;
  - label UI berbahasa Inggris;
  - status selalu ditunjukkan dengan **warna + ikon + kata**, tidak pernah warna saja;
  - setiap angka punya satuan, rata kanan, dan memakai `tabular-nums`;
  - konten advisory (SizingAdvice, SizingCheck, power sharing) memakai perlakuan "Advice" bergaris putus-putus;
  - kontras teks minimal 4.5:1, dan fokus keyboard terlihat di mana-mana.
- **Peran token** (role): success, negative, error, caution, attention, info, advisory.
  - Pemetaan dari peran di `status-text.ts`: success→success, warning→negative, error→error, caution→caution, attention→attention, neutral→info.
  - Kontras sudah dihitung: semua teks ≥5.4:1 dan semua border ≥3:1.
  - Ada varian khusus untuk print: latar transparan dan teks hitam.
- `<html lang="en">`. Ini sekaligus memperbaiki masalah perataan tabel.

### 3.3 Step 1: komponen inti (commit 7a125d5)
- **AppShell:** header berisi nama proyek, chip "*unsaved", Run history, Catalogue, Save/Open, dan badge `Engine: FAKE/REAL`.
- **PipelineStepper:** keadaan todo, done, stale, dan blocked (ikon + kata), ditambah sub-baris "Further analyses".
- **StatusBanner:** semua baris status dari Doc 7 §5, satu ikon per status, Details yang bisa dilipat, dan baris "FAKE engine". Pesan engine hanya ditampilkan kalau isinya berbeda dari headline.
- **DataTable:**
  - unit ditaruh di header, sel bisa diedit;
  - Enter pindah ke baris berikutnya, Escape mengembalikan nilai awal;
  - error baris tampil inline di bawah barisnya;
  - setiap baris punya `<tbody>` sendiri.
- Komponen lain: **NumberField** dengan sufiks satuan, **AdvisoryPanel** (chip "Advice"), **EmptyState**, **Toast** (khusus error transport), **Icon** (SVG inline), dan `format.ts` (`num` = pembulatan ke 6 digit signifikan, hanya untuk tampilan).
- Galeri **`/dev/components`** menampilkan semua komponen dalam semua keadaannya.

### 3.4 Step 2: restyle layar (satu per satu, berhenti untuk review)
| Langkah | Layar | Commit | Inti perubahan |
|---|---|---|---|
| 2a | S-03 Loads | fb567d0 | Tabel Load di DataTable, radiogroup Q/PF, EmptyState, daftar "Other problems" bergaya caution |
| 2b | S-05 Network | 33d16a9 | EntityTable di atas DataTable (sel turunan berlabel, baris `aria-current` untuk `?focus=`), deretan tab, Toast inline untuk penolakan hapus bus, panel isu, warna diagram dari token |
| 2c | S-07 Power flow (M1) | b97f7d7 | Kepala halaman dengan chip status M1 dan tombol utama Run, panel readiness, EmptyState ("Not run yet." atau "No result on this screen."), tabel hasil M1 di DataTable, power sharing sebagai Advice, perbaikan "Design: …" di StatusBanner |
| 2d | S-08 Constraint check (M2) | e132ef5 | Banner blocked di bawah judul, kotak form margin, ConstraintTable di DataTable (kolom Unit, "✕ Violated by…", chip "Near limit"), daftar Loadability, Sizing check sebagai Advice |
| 2e | S-16 Report + print | bc049ec | Strip kontrol, baris meta, kotak Fake, verdict sebagai kotak status, Design summary di DataTable, label chart dibulatkan; print: kotak gulir dibuka (`overflow: visible`) supaya kolom tidak terpotong, kontrol disembunyikan |

Untuk setiap langkah:
- **Verifikasi:** typecheck, `tools/check.py`, tes Python (engine 53, seams 441), tes klien (35), dan E2E Playwright (30 di Chromium + 30 di Chrome).
- **Screenshot before/after:** di `docs/design/<layar>-2026-11-03/`, ukuran 1440×900 dan 1280×720, untuk keadaan normal, kosong, error, dan loading.
- **Catatan review:** `docs/design/sXX_review.md`.
- **Gate log:** satu baris per langkah.

### 3.5 Pelajaran teknis yang muncul
- **Nama aksesibel adalah kontrak tes.** Tes E2E memilih elemen lewat role, label, dan testid, sering dengan `exact=True`. Restyle harus menjaga nama-nama ini persis sama.
  - Contoh kasus: area gulir "Sizing check per inverter, scrolls sideways" ikut cocok dengan region "Sizing check". Solusinya, dua tabel di dalamnya diganti nama.
- **CSS Module vs kelas global:** gaya modul dengan specificity yang sama menang atas `.no-print` global. Akibatnya kontrol ikut tercetak, jadi aturan print harus diulang di modul.
- **sr-only absolut** bisa "lolos" dari kotak gulir dan memicu scroll horizontal. Solusinya `.table-scroll { position: relative }`.
- **Koma desimal di input angka** ("0,02") berasal dari locale OS, bukan dari kode.
- **Windows:** heredoc bash yang panjang sering gagal, jadi tulis skrip ke file. Proses server anak harus dimatikan lewat PID (`Get-NetTCPConnection` + `taskkill /T`).

---

## 4. Status sekarang

- Branch `tahap-1.5`, commit terakhir `bc049ec`, sudah di-push. Working tree bersih setelah commit ini (file handoff ini belum di-commit).
- Kelima layar dalam rencana ADR-011 sudah selesai: S-03, S-05, S-07, S-08, S-16.
- Status top-10 audit:
  - **Sudah teratasi:** #1 di layar yang direstyle; #2, #3, #5, #9, #10; #6 dan #7 di layar yang direstyle.
  - **Sebagian:** #8 (token dan lebar maksimum sudah ada, tapi belum semua layar dirapikan).
  - **Belum, dan butuh perubahan store:** #4 (hasil hilang setelah pindah layar). Sementara ini ditangani lewat teks EmptyState yang jujur.

### Layar yang belum direstyle (masih memakai gaya dasar global)
S-01 Start, S-02 Project overview, S-04 Sizing advice, S-06 Constraints, S-09 Sensitivity, S-10 Sweep, S-11 Scenarios, S-12 Envelope, S-13 Small-signal, S-14 Transient, S-15 Run history, S-18 Catalogue. S-17 About belum dibangun.

### Celah yang diketahui
- Hasil hilang setelah pindah layar (#4). Perlu perubahan store, jadi di luar cakupan "presentation-only".
- Pada lebar 1280 px, stepper turun ke baris kedua saat muncul label "stale".
- Diagram jaringan memakai koordinat tetap, sehingga menyisakan ruang kosong.
- Tabel Validity indicators dibiarkan tanpa gaya. Aturan FR-62 melarang kelas atau style di dalamnya, dan ini diuji E2E.
- Tombol pilihan bagian di Report (Should) belum dibangun.
- File PDF A4 sudah dibuat, tapi tampilannya belum diperiksa secara visual.
- Belum diuji: dark theme (di luar cakupan), screen reader sungguhan, Firefox dan Edge.
- Run history masih menampilkan timestamp ISO lengkap sampai mikrodetik.

---

## 5. Bahan brainstorming berikutnya (pertanyaan terbuka)

1. **Restyle layar sisanya:** urutan prioritas apa yang masuk akal? Usul awal: S-04 Sizing advice dan S-06 Constraints (inti pipeline), lalu S-15 Run history, lalu M3/M4.
2. **Masalah #4 (hasil hilang):** apakah hasil terakhir per analisis disimpan di store (reducer baru), atau cukup dibaca ulang dari RunRecord terakhir yang snapshot-nya cocok? Yang kedua tidak menambah state baru dan konsisten dengan cara Report bekerja. Keputusan ini perlu ADR atau entri Doc 09.
3. **Stepper di lebar sempit:** dipadatkan (label pendek atau ikon saja), atau dibiarkan wrap?
4. **Report:** apakah tombol pilihan bagian (M1/M2/M3/M4) perlu dibangun untuk seminar? Apakah duplikasi batasan pengikat di bagian 2 dan 3 perlu dihapus? (Itu perubahan isi, Doc 7 §6.7.)
5. **Merge ke `main`:** apakah design system masuk ke `v0.1.0` final, atau ditag terpisah (misalnya `v0.1.1`)? Perlu cek ulang PR #4.
6. **Validasi pengguna:** wireframe dan UI belum pernah diuji dengan junior engineer sungguhan (Doc 7 mencatatnya sebagai kritik). Uji kegunaan singkat seperti apa yang realistis sebelum seminar?
7. **Aksesibilitas:** apakah perlu uji screen reader (NVDA di Windows) dan uji zoom 200 % manual?

---

## 6. Peta file penting
- `frontend/app/tokens.css`, `frontend/app/globals.css`: token dan gaya dasar.
- `frontend/components/`: AppShell, PipelineStepper, StatusBanner, DataTable, NumberField, AdvisoryPanel, EmptyState, Toast, Icon, EntityTable, M1Results, M2Results, M1Freshness, VoltageChart, format.ts.
- `frontend/app/dev/components/page.tsx`: galeri komponen.
- `docs/05_adr/ADR-011-styling-approach.md`: keputusan styling.
- `docs/07_ui_ia.md`: UI/IA, wireframe §6, aturan status §5, aksesibilitas §8.
- `docs/design/`: audit, screenshot before/after, dan catatan review per langkah.
- `docs/gate_log.md`: log gate per paket kerja.
- `docs/demo_script.md`: skrip demo dan cara menjalankan app.
