// Glossary for the "?" toggletips and S-17 About (Doc 12 X6, FR-91; guideline §7). Indonesian text
// (Doc 7 §9 #1) taken from the manuscript, shortened; where the manuscript gives no definition, the
// Doc 3 §2 line in Indonesian (D-89). Every entry names its source. Nothing here is a new definition.
import type { Status } from "../api-types";

export type GlossaryEntry = { term: string; short: string; source: string };

export const GLOSSARY = {
  pu: {
    term: "p.u.",
    short: "Per unit terhadap tegangan nominal Project. Hanya pita tegangan DesignConstraints dan batasan tegangan yang memakai p.u.; besaran lain memakai satuan rekayasa.",
    source: "Naskah 4.2.1; Doc 3 §1",
  },
  kw: { term: "kW", short: "Daya aktif dalam kilowatt, total tiga fasa.", source: "Naskah 2.1.2, 4.2.1; Doc 3 §1" },
  kvar: { term: "kvar", short: "Daya reaktif dalam kilovar, total tiga fasa.", source: "Naskah 2.1.2, 4.2.1; Doc 3 §1" },
  kva: { term: "kVA", short: "Daya semu dalam kilovolt-ampere; rating inverter dinyatakan dalam kVA.", source: "Naskah 4.2.4 Pers. (4.10); Doc 3 §1" },
  mp: {
    term: "m_p",
    short: "Koefisien droop frekuensi: frekuensi turun ketika daya aktif naik, ω_i = ω* − m_p,i (P_i − P_i*). Mesin memakai rad/(s·W); aplikasi menyimpannya dalam Hz/kW.",
    source: "Naskah 2.1.2 Pers. (2.1); Doc 3 §1",
  },
  nq: {
    term: "n_q",
    short: "Koefisien droop tegangan: tegangan turun ketika daya reaktif naik, V_i = V* − n_q,i (Q_i − Q_i*). Mesin memakai V/VAR; aplikasi menyimpannya dalam kV/kvar.",
    source: "Naskah 2.1.2 Pers. (2.1); Doc 3 §1",
  },
  gfm: {
    term: "grid-forming",
    short: "Inverter pembentuk jaringan (GFM): sumber tegangan berimpedansi keluaran rendah yang membentuk tegangan dan frekuensi sendiri, sehingga dapat melayani beban lokal tanpa jaringan utama.",
    source: "Naskah 1.1.1, 2.1.1",
  },
  loading: {
    term: "loading ratio",
    short: "Rasio pembebanan inverter: daya semu inverter terhadap rating-nya, diperiksa terhadap fraksi pembebanan izin μ_max.",
    source: "Naskah 4.2.4 Pers. (4.10)",
  },
  margin: { term: "margin", short: "Jarak suatu besaran dari batasnya dalam satuannya sendiri; negatif berarti batas dilanggar.", source: "Doc 3 §2 (margin)" },
  nmargin: {
    term: "normalised margin",
    short: "Margin dibagi lebar pita (batas dua sisi) atau besar batas (batas satu sisi). Batasan pembatas adalah pelanggaran dengan margin ternormalisasi terkecil.",
    source: "Naskah 4.2.5 Pers. (4.18)",
  },
  lambda_c: {
    term: "λ_c",
    short: "Margin tanpa pelanggaran: faktor pembebanan λ terbesar yang semua titiknya sampai λ itu berstatus FEASIBLE. λ adalah pengali seragam daya aktif dan reaktif semua beban.",
    source: "Naskah Tabel 2.10; 4.2.4 Pers. (4.15)",
  },
  lambda_s: {
    term: "λ_s",
    short: "Margin keberadaan solusi: λ terbesar yang semua titiknya sampai λ itu berstatus FEASIBLE atau INFEASIBLE. λ_s bukan batas stabilitas.",
    source: "Naskah Tabel 2.10; 4.2.4 Pers. (4.15)",
  },
  eps_x: {
    term: "ε_X",
    short: "Galat relatif reaktansi akibat asumsi A4. Indikator keabsahan; ambangnya dikalibrasi pada tahap 1.6.",
    source: "Naskah Tabel 2.10, 4.2.7 Pers. (4.1); Doc 3 §2",
  },
  r_tau: {
    term: "r_τ",
    short: "Indikator keabsahan asumsi A1: konstanta waktu saluran terbesar terhadap konstanta waktu filter daya terkecil. Ambangnya dikalibrasi pada tahap 1.6.",
    source: "Naskah Tabel 2.10, 4.2.7 Pers. (4.23); Doc 3 §2",
  },
  kappa: {
    term: "κ",
    short: "Indikator keabsahan asumsi A1: konstanta waktu saluran terbesar dikali besar nilai eigen dominan terbesar. Ambangnya dikalibrasi pada tahap 1.6.",
    source: "Naskah Tabel 2.10, 4.2.7 Pers. (4.23); Doc 3 §2",
  },
  r_in: {
    term: "r_in",
    short: "Indikator keabsahan asumsi A2: konstanta waktu inner loop terhadap konstanta waktu filter daya terkecil. Ambangnya dikalibrasi pada tahap 1.6.",
    source: "Naskah Tabel 2.10, 4.2.7 Pers. (4.23); Doc 3 §2",
  },
  eigen: {
    term: "eigenvalue",
    short: "Nilai eigen λ_k matriks keadaan A dari model M4 yang dilinierisasi. Titik stabil bila max Re(λ_k) < −t_λ, tidak stabil bila > t_λ, dan marginal di antaranya.",
    source: "Naskah 4.2.6 Pers. (4.20)",
  },
  zeta: {
    term: "damping ratio",
    short: "Rasio redaman ζ_k = −Re(λ_k)/|λ_k|; ζ_min adalah redaman terendah mode berosilasi.",
    source: "Naskah 4.2.6 Pers. (4.20)",
  },
  participation: {
    term: "participation factor",
    short: "Faktor partisipasi menunjuk keadaan yang mendominasi suatu mode; dilaporkan hanya bila matriks vektor eigen berkondisi baik.",
    source: "Naskah 2.1.6; 4.2.6 Pers. (4.21)",
  },
  rocof: {
    term: "RoCoF",
    short: "Laju perubahan frekuensi (rate of change of frequency). M4b menghitungnya dari dω_i/dt = −m_p,i dP_f,i/dt.",
    source: "Naskah 2.1.1, 4.2.6",
  },
  transient: {
    term: "transient class",
    short: "Kelas hasil M4b: pulih stabil, pelanggaran kriteria, tidak stabil, kegagalan simulasi, atau konfigurasi tidak sah, ditetapkan dari jendela settling dan amplop frekuensi-tegangan. Tiga kelas pertama dilaporkan sebagai FEASIBLE.",
    source: "Naskah 4.2.6",
  },
  INPUT_INVALID: { term: "INPUT_INVALID", short: "Masukan ditolak sebelum perhitungan; isunya ada di diagnostik.", source: "Naskah Tabel 4.4" },
  SOLVER_FAILED: { term: "SOLVER_FAILED", short: "Tidak konvergen.", source: "Naskah Tabel 4.4" },
  PHYSICALLY_INADMISSIBLE: { term: "PHYSICALLY_INADMISSIBLE", short: "Konvergen, tetapi tidak fisis.", source: "Naskah Tabel 4.4" },
  INFEASIBLE: { term: "INFEASIBLE", short: "Sah, batasan dilanggar; tidak pernah dari M1.", source: "Naskah Tabel 4.4" },
  FEASIBLE: {
    term: "FEASIBLE",
    short: "Berhasil, makna per modul. Pada M1 berarti titik operasi telah ditemukan, bukan bahwa batasan telah terpenuhi; vonis kelayakan hanya dari M2.",
    source: "Naskah Tabel 4.4, 4.1.5",
  },
  UNAVAILABLE: { term: "UNAVAILABLE", short: "Tidak berlaku, dependensi gagal, atau waktu habis.", source: "Naskah Tabel 4.4" },
} satisfies Record<string, GlossaryEntry> & Record<Status, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

// Column units that carry their own toggletip in a table header.
export const UNIT_TERM: Record<string, GlossaryKey> = { "p.u.": "pu", kW: "kw", kvar: "kvar", kVA: "kva" };
