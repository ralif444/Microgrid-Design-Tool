# Prompt lanjutan — Tahap 1.2 (untuk Claude Code di laptop Windows)

Kita lanjutkan implementasi App v1, Tahap 1.2 "Fitur utama aplikasi" untuk skripsi microgrid. Repo ini sudah di cabang tahap-1.2.

## Catatan lingkungan
Ini laptop Windows 11. Perintah `python` di PATH menunjuk ke Python 3.8.4 milik ETAP, jadi jangan dipakai. Jalankan semua skrip di tools/ dengan `uv run --python 3.13 python tools\<nama>.py`. Ini pertama kalinya proyek dijalankan di Windows (sebelumnya hanya di Linux). Bila ada skrip atau uji yang gagal karena perbedaan Windows (path, .cmd, proses anak), perbaiki penyebabnya dan catat di docs/gate_log.md.

## Langkah pertama
Pastikan lingkungan berjalan: jalankan tools\check.py, tools\test.py, tools\build_frontend.py, lalu tools\test.py e2e. Bila ada yang gagal, perbaiki atau laporkan sebelum lanjut. Setelah E2E lulus, uji juga dengan Google Chrome stabil (Playwright channel "chrome"). Catat versi Chrome dan hasilnya di docs/gate_log.md; ini syarat terbawa untuk gerbang keluar 1.2. Lalu commit dan push.

## Baca dulu, berurutan
1. docs/HANDOFF_TAHAP_1_2.md (status, keputusan, urutan paket kerja).
2. CLAUDE.md, docs/gate_log.md, docs/10_roadmap.md (Tabel 4.15, Tabel B.1), docs/08_structure_verification.md.
3. Kontrak yang sudah dibekukan (D-43): docs/03_glossary_contracts.md, docs/06_api.md, docs/07_ui_ia.md, docs/02_prd.md.
4. docs/ref/Seminar.pdf adalah acuan tunggal (subbab 4.1, 4.3, 4.5; Lampiran A, B, D). Naskah menang bila ada konflik, kecuali keputusan pengguna yang dibuat sesudahnya dan tercatat di Doc 09 atau Doc 14.

## Aturan kerja
- Tanya sebelum keputusan desain yang tidak ada di dokumen.
- Jangan mengarang nilai.
- Fake Engine tetap dipakai. Profil Fake hanya ditambah bila alur E2E membutuhkannya, dan setiap tambahan dicatat di gate log.
- Perubahan kontrak Doc 03/06 hanya lewat ADR atau entri Doc 09 (aturan G6).
- Setiap paket kerja diakhiri dengan uji yang lulus (tools\check.py dan tools\test.py), commit, push ke tahap-1.2, dan satu baris di docs/gate_log.md.
- Jangan pakai npx; pakai frontend/node_modules/.bin/*.
- Akhiri setiap pesan commit dengan baris Co-Authored-By dari Claude.

## Urutan kerja
WP 1.2.1 (entri beban dan PS, layar S-01 sampai S-04, /api/projects/validate), lalu 1.2.2, 1.2.3, 1.2.4.
Sebelum menulis kode WP 1.2.1, tunjukkan rencana singkat: berkas yang dibuat atau diubah, endpoint, layar, uji per seam, dan butir yang perlu keputusan saya.
