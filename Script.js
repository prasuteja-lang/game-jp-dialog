"use strict";

// Ganti URL di bawah dengan Web App URL dari Google Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbwf0-Rt3MElohK2vq4Xo57kYGPfprWcROqid4gZd0-92ObUrGg6YbbrIsdxCS3HDIJP/exec";

const CONFIG = {
  START_NODE: "stasiun_awal",
  FETCH_TIMEOUT: 15000,   // batas waktu ambil data (ms)
  IMAGE_WAIT: 2500,       // maksimal menunggu gambar adegan (ms)
  BGM_VOLUME: 0.3,        // volume backsound (0 - 1)

  // Furigana otomatis (Kuroshiro + Kuromoji). Butuh internet; kamus ~12 MB diunduh sekali lalu tersimpan di cache browser.
  AUTO_FURIGANA: true,
  FURIGANA_WAIT: 20000,   // maksimal menunggu kamus saat game dimulai (ms)
  KUROSHIRO_URL: "https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js",
  ANALYZER_URL: "https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js",
  DICT_PATH: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/",
  CACHE_KEY: "vn_story_cache_v3",   // dinaikkan agar cache lama (tanpa terjemahan / adegan baru) dibuang

  // Musik latar menu utama (letakkan file di folder ini; nama berkas Jepang di-encode otomatis)
  MENU_BGM: "assets/audio/冒険の調べ.mp3",
  SAVE_KEY: "vn_progress_v2",
  SETTINGS_KEY: "vn_settings_v1",
};

const SPEEDS = { lambat: 55, normal: 32, cepat: 14, instan: 0 };
const DEFAULT_SETTINGS = { speed: "normal", sound: true, furigana: true, translation: true };

// ---------- Ikon ----------
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  play: svg("M8 5v14l11-7z"),
  chevron: svg("M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"),
  volume: svg("M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"),
  volumeOff: svg("M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"),
  book: svg("M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"),
  gear: svg("M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"),
};

// ---------- Elemen ----------
const $ = (id) => document.getElementById(id);
const el = {
  stage: $("stage"),
  bgA: $("bg-a"),
  bgB: $("bg-b"),
  char: $("char-image"),
  chapter: $("chapter"),
  vocabBtn: $("vocab-btn"),
  muteBtn: $("mute-btn"),
  settingsBtn: $("settings-btn"),
  choices: $("choices-box"),
  dialog: $("dialog-box"),
  speaker: $("speaker-name"),
  speakBtn: $("speak-btn"),
  text: $("dialog-text"),
  trans: $("dialog-trans"),
  nextBtn: $("next-btn"),
  ending: $("ending"),
  endingCard: $("ending-card"),
  endingIcon: $("ending-icon"),
  endingTitle: $("ending-title"),
  endingBadge: $("ending-badge"),
  endingDesc: $("ending-desc"),
  endingActions: $("ending-actions"),
  title: $("title"),
  titleChar: $("title-char"),
  btnStart: $("btn-start"),
  btnContinue: $("btn-continue"),
  btnSettings: $("btn-settings"),
  btnAbout: $("btn-about"),
  themes: $("themes"),
  themesGrid: $("themes-grid"),
  themesBack: $("themes-back"),
  modal: $("modal"),
  modalTitle: $("modal-title"),
  modalClose: $("modal-close"),
  modalTabs: $("modal-tabs"),
  modalBody: $("modal-body"),
  modalFoot: $("modal-foot"),
  overlay: $("overlay"),
  ovMsg: $("ov-msg"),
  ovActions: $("ov-actions"),
};

// ---------- State ----------
const state = {
  story: {},
  storyIndex: {},
  bgmBlocked: false,
  vocab: [],
  grammar: [],
  settings: Object.assign({}, DEFAULT_SETTINGS),
  nodeKey: null,
  node: null,
  started: false,
  busy: false,
  typing: false,
  typeTimer: null,
  finishTyping: null,
  token: 0,
  bgUrl: null,
  bgFront: "a",
  charUrl: null,
  audio: null,
  bgm: null,
  bgmUrl: null,
  theme: "",
  themes: {},
  themeList: [],
  startKey: "",
  chapter: "",
  history: [],
  read: 0,
  lastChoiceKey: null,
  endingTitle: "",
  modal: null,
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Utilitas ----------
function h(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const isHidden = (node) => node.classList.contains("is-hidden");

// ---------- Penyimpanan lokal (aman jika diblokir browser) ----------
function readStore(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* abaikan */ }
}
function removeStore(key) {
  try { localStorage.removeItem(key); } catch (e) { /* abaikan */ }
}
function readJSON(key) {
  try { return JSON.parse(readStore(key)); } catch (e) { return null; }
}

// ---------- Furigana: tulis di Sheets sebagai 漢字[かんじ] atau 漢字（かんじ） ----------
// Kurung penuh/biasa hanya dianggap furigana jika isinya murni hiragana/katakana.
const RUBY_RE = /([\u3400-\u9fff々〆ヶ]+)(?:\[([^\]]+)\]|[（(]([\u3040-\u30ffー]+)[）)])|\uE000([^\uE001]*)\uE001([^\uE002]*)\uE002/g;

function tokenize(text) {
  text = annSync(String(text || ""));
  const tokens = [];
  const pushPlain = (s) => {
    Array.from(s).forEach((ch) => tokens.push({ html: ch === "\n" ? "\n" : esc(ch), ch }));
  };
  let last = 0;
  text.replace(RUBY_RE, (m, base, rtBracket, rtParen, autoBase, autoRt, offset) => {
    const rt = rtBracket || rtParen || autoRt;
    base = base || autoBase;
    pushPlain(text.slice(last, offset));
    tokens.push({ html: `<ruby>${esc(base)}<rt>${esc(rt)}</rt></ruby>`, ch: "" });
    last = offset + m.length;
    return m;
  });
  pushPlain(text.slice(last));
  return tokens;
}

const richHTML = (text) => tokenize(text).map((t) => t.html).join("");
const plainText = (text) => String(text || "").replace(RUBY_RE, (m, base, a, b, autoBase) => base || autoBase);

// ---------- Furigana otomatis ----------
// Teks yang sudah diberi furigana manual (漢字[かん字] / 漢字（かんじ）) tidak diubah.
const AUTO = { kuro: null, ready: false, loading: null, cache: new Map() };
const KANJI_RE = /[\u3400-\u9fff々]/;

// Ambil versi berfurigana dari cache (jika belum ada, pakai teks asli)
const annSync = (text) => (AUTO.cache.has(text) ? AUTO.cache.get(text) : text);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Gagal memuat " + src));
    document.head.appendChild(s);
  });
}

function initAutoFurigana() {
  if (!CONFIG.AUTO_FURIGANA) return Promise.resolve(false);
  if (AUTO.loading) return AUTO.loading;
  AUTO.loading = (async () => {
    try {
      await loadScript(CONFIG.KUROSHIRO_URL);
      await loadScript(CONFIG.ANALYZER_URL);
      const K = window.Kuroshiro && (window.Kuroshiro.default || window.Kuroshiro);
      const A = window.KuromojiAnalyzer && (window.KuromojiAnalyzer.default || window.KuromojiAnalyzer);
      if (!K || !A) throw new Error("Pustaka Kuroshiro tidak ditemukan");
      const kuro = new K();
      await kuro.init(new A({ dictPath: CONFIG.DICT_PATH }));
      AUTO.kuro = kuro;
      AUTO.ready = true;
      console.log("Furigana otomatis siap.");
      return true;
    } catch (err) {
      console.warn("Furigana otomatis tidak aktif (furigana manual tetap berfungsi):", err);
      return false;
    }
  })();
  return AUTO.loading;
}

async function convertPlain(s) {
  if (!s || !KANJI_RE.test(s)) return s;
  try {
    const html = await AUTO.kuro.convert(s, { mode: "furigana", to: "hiragana" });
    return html
      .replace(/<ruby>([^<]*?)(?:<rp>[^<]*<\/rp>)?<rt>([^<]*?)<\/rt>(?:<rp>[^<]*<\/rp>)?<\/ruby>/g, "\uE000$1\uE001$2\uE002")
      .replace(/<[^>]+>/g, "");
  } catch (e) {
    return s;
  }
}

async function annotateText(text) {
  text = String(text || "");
  if (!AUTO.ready || !KANJI_RE.test(text)) return text;
  if (AUTO.cache.has(text)) return AUTO.cache.get(text);

  const manual = new RegExp(RUBY_RE.source, "g");
  let out = "";
  let last = 0;
  let m;
  while ((m = manual.exec(text)) !== null) {
    out += (await convertPlain(text.slice(last, m.index))) + m[0];
    last = m.index + m[0].length;
  }
  out += await convertPlain(text.slice(last));
  AUTO.cache.set(text, out);
  return out;
}

async function prepareNode(node) {
  const texts = [node.text, ...(node.choices || []).map((c) => c.text)];
  await Promise.all(texts.map(annotateText));
}

// Siapkan semua teks cerita di latar belakang agar adegan berikutnya langsung berfurigana
async function prepareAll() {
  if (!AUTO.ready) return;
  const texts = [];
  Object.values(state.story).forEach((n) => {
    texts.push(n.text);
    (n.choices || []).forEach((c) => texts.push(c.text));
  });
  state.grammar.forEach((g) => texts.push(g.contoh));
  for (const t of texts) {
    await annotateText(t);
    await sleep(0);
  }
}

// Saat game dimulai, tunggu kamus sebentar jika belum selesai diunduh
async function ensureFurigana() {
  if (!CONFIG.AUTO_FURIGANA || AUTO.ready || !AUTO.loading) return;
  let shown = false;
  const timer = setTimeout(() => {
    shown = true;
    showOverlay({ msg: "Menyiapkan furigana otomatis… (pertama kali agak lama)", loading: true });
  }, 500);
  await Promise.race([AUTO.loading, sleep(CONFIG.FURIGANA_WAIT)]);
  clearTimeout(timer);
  if (shown) hideOverlay();
}

// ---------- Link Google Drive -> link yang bisa dipakai <img>/<audio> ----------
function mediaUrl(url, kind) {
  url = String(url || "").trim();
  if (!url) return "";
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (!m) return url;
  return kind === "audio"
    ? `https://drive.google.com/uc?export=download&id=${m[1]}`
    : `https://drive.google.com/uc?export=view&id=${m[1]}`;
}

// ---------- Preload gambar ----------
const imgCache = new Map();
function preloadImage(url) {
  if (!url) return Promise.resolve(false);
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  imgCache.set(url, p);
  return p;
}

// Cari adegan berdasarkan id; toleran terhadap spasi dan huruf besar/kecil
const normKey = (k) => String(k == null ? "" : k).trim().toLowerCase();
function getNode(key) {
  if (!key) return null;
  return state.story[key] || state.storyIndex[normKey(key)] || null;
}

function prefetchNeighbors(node) {
  const targets = [node.next, ...(node.choices || []).map((c) => c.next)].filter(Boolean);
  targets.forEach((key) => {
    const n = getNode(key);
    if (!n) return;
    preloadImage(mediaUrl(n.background, "image"));
    preloadImage(mediaUrl(n.character, "image"));
    prepareNode(n);
  });
}

// ---------- Pengaturan ----------
function loadSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, readJSON(CONFIG.SETTINGS_KEY) || {});
}

function saveSettings() {
  writeStore(CONFIG.SETTINGS_KEY, JSON.stringify(state.settings));
}

function applySettings() {
  const s = state.settings;
  el.stage.classList.toggle("no-furigana", !s.furigana);
  el.stage.classList.toggle("no-translation", !s.translation);
  el.muteBtn.innerHTML = s.sound ? ICON.volume : ICON.volumeOff;
  el.muteBtn.setAttribute("aria-label", s.sound ? "Matikan suara" : "Nyalakan suara");
  if (state.audio) state.audio.muted = !s.sound;
  if (state.bgm) state.bgm.muted = !s.sound;
}

// ---------- Layar memuat / error ----------
function showOverlay({ msg = "", actions = [], loading = false }) {
  el.ovMsg.textContent = msg;
  el.ovActions.replaceChildren(
    ...actions.map((a) => {
      const b = h("button", "btn-light", a.label);
      b.type = "button";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        a.onClick();
      });
      return b;
    })
  );
  el.overlay.classList.toggle("is-loading", loading);
  el.overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  el.overlay.classList.add("is-hidden");
  el.ovActions.replaceChildren();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// ---------- Ambil data dari Google Sheets ----------
function normalize(data) {
  const story = data && data.story ? data.story : data;
  return {
    story: story && typeof story === "object" ? story : {},
    vocab: data && Array.isArray(data.vocab) ? data.vocab : [],
    grammar: data && Array.isArray(data.grammar) ? data.grammar : [],
    themes: data && Array.isArray(data.themes) ? data.themes : [],
  };
}

async function fetchStory() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.FETCH_TIMEOUT);
  try {
    const res = await fetch(API_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = normalize(await res.json());
    if (!data.story[CONFIG.START_NODE]) {
      throw new Error(`Node "${CONFIG.START_NODE}" tidak ditemukan di data.`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function useData(data) {
  state.story = data.story;
  state.storyIndex = {};
  Object.keys(data.story).forEach((k) => { state.storyIndex[normKey(k)] = data.story[k]; });

  // Data baru tiba saat adegan sedang tampil: ambil versi terbarunya (mis. terjemahan yang baru diisi)
  if (state.started && state.nodeKey && getNode(state.nodeKey)) {
    state.node = getNode(state.nodeKey);
    if (!state.typing && !isHidden(el.dialog)) el.trans.textContent = state.node.translation || "";
  }
  state.vocab = data.vocab;
  state.grammar = data.grammar;
  state.themes = {};
  state.themeList = (data.themes || []).filter((t) => t.tema);
  state.themeList.forEach((t) => {
    if (t.assets) state.themes[t.tema.toLowerCase()] = t.assets;
  });
  if (AUTO.ready) prepareAll();
}

function friendlyError(err) {
  if (err && err.name === "AbortError") return "Koneksi terlalu lama. Periksa internet Anda lalu coba lagi.";
  if (err && /Node ".*" tidak ditemukan/.test(err.message)) {
    return `${err.message} Pastikan kolom id di Google Sheets berisi "${CONFIG.START_NODE}".`;
  }
  return "Gagal memuat cerita. Periksa koneksi internet atau URL API, lalu coba lagi.";
}

// ---------- Layar judul ----------
async function showTitle() {
  el.stage.classList.add("is-menu");
  const start = state.story[CONFIG.START_NODE];
  const bg = mediaUrl(start.background, "image");
  const ch = mediaUrl(start.character, "image");

  await Promise.race([Promise.all([preloadImage(bg), preloadImage(ch)]), sleep(CONFIG.IMAGE_WAIT)]);
  setBackground(bg);

  if (ch) {
    el.titleChar.src = ch;
    el.titleChar.hidden = false;
  } else {
    el.titleChar.removeAttribute("src");
    el.titleChar.hidden = true;
  }

  const saved = readJSON(CONFIG.SAVE_KEY);
  const canContinue = saved && saved.key && saved.key !== CONFIG.START_NODE && state.story[saved.key];
  el.btnContinue.hidden = !canContinue;
  el.btnContinue.onclick = () => startGame(saved.key, saved);

  el.title.classList.remove("is-hidden");
  setBgm(menuBgmUrl());
  hideOverlay();
}

function themeStart(name) {
  const t = state.themeList.find((x) => x.tema.toLowerCase() === String(name).toLowerCase());
  return t && t.start ? t.start : CONFIG.START_NODE;
}

function startGame(key, saved, themeName) {
  state.started = true;
  state.history = saved && saved.history ? saved.history : [];
  state.read = saved && saved.read ? saved.read : 0;
  state.chapter = saved && saved.chapter ? saved.chapter : "";
  state.theme = saved && saved.theme ? saved.theme : themeName || "";
  state.startKey = saved ? saved.start || themeStart(state.theme) : key;
  state.lastChoiceKey = null;
  el.stage.classList.remove("is-menu");
  el.title.classList.add("is-hidden");
  el.themes.classList.add("is-hidden");
  closeModal();
  loadScene(key);
}

// ---------- Pilih tema ----------
function showThemeSelect() {
  const cards = state.themeList.map((t, index) => {
    const ready = Boolean(t.start && getNode(t.start));
    const btn = h("button", "theme-card");
    btn.type = "button";
    btn.disabled = !ready;
    btn.style.setProperty("--i", String(index));

    const icon = h("div", "theme-icon", t.icon || "📖");
    icon.setAttribute("aria-hidden", "true");

    const jp = h("div", "theme-jp", t.titleJp || "");
    jp.lang = "ja";

    const body = h("div", "theme-body");
    body.append(h("div", "theme-name", t.title || t.tema), jp, h("div", "theme-desc", ready ? t.desc || "" : "Segera hadir"));

    btn.append(icon, body);
    btn.addEventListener("click", () => startGame(t.start, null, t.tema));
    return btn;
  });

  el.themesGrid.replaceChildren(...cards);
  el.themes.classList.remove("is-hidden");
  const first = el.themesGrid.querySelector("button:not(:disabled)");
  if (first) first.focus({ preventScroll: true });
}

// Kembali ke menu utama (menghentikan cerita dan musik)
function showMenu() {
  state.started = false;
  state.token++;
  state.busy = false;
  clearTimeout(state.typeTimer);
  state.typing = false;
  state.finishTyping = null;
  stopAudio();
  setBgm("");
  state.theme = "";
  el.choices.replaceChildren();
  el.nextBtn.classList.remove("is-ready");
  el.stage.classList.remove("has-choices");
  el.ending.classList.add("is-hidden");
  el.themes.classList.add("is-hidden");
  closeModal();
  showTitle();
}

function chooseAnotherTheme() {
  showMenu();
  if (state.themeList.length) showThemeSelect();
}

// Aksi "main lagi": pilih tema lain jika ada beberapa tema, atau ulangi cerita
function replayAction() {
  return state.themeList.length
    ? { label: "Pilih tema lain", run: chooseAnotherTheme }
    : { label: "Main lagi", run: () => startGame(state.startKey || CONFIG.START_NODE, null, state.theme) };
}

// Adegan tidak ada di data: coba ambil data terbaru dulu (cache bisa ketinggalan dari Google Sheets)
async function refreshForScene(key) {
  try {
    const data = await fetchStory();
    writeStore(CONFIG.CACHE_KEY, JSON.stringify(data));
    useData(data);
    return getNode(key);
  } catch (err) {
    return null;
  }
}

function showSceneError(key, fromKey) {
  stopAudio();
  const from = fromKey ? ` (dipanggil dari adegan "${fromKey}")` : "";
  showOverlay({
    msg: `Adegan "${key}" tidak ditemukan di Google Sheets${from}. Tambahkan baris dengan id tersebut, atau perbaiki kolom "next" / pilihan pada adegan sebelumnya.`,
    actions: [
      { label: "Mulai dari awal", onClick: () => { hideOverlay(); startGame(state.startKey || CONFIG.START_NODE, null, state.theme); } },
      { label: "Kembali ke menu", onClick: () => { hideOverlay(); showMenu(); } },
    ],
  });
}

// ---------- Background & karakter ----------
async function setBackground(url) {
  if (url === state.bgUrl) return;
  state.bgUrl = url;
  const front = state.bgFront === "a" ? el.bgA : el.bgB;
  const back = front === el.bgA ? el.bgB : el.bgA;

  if (!url) {
    front.classList.remove("is-visible");
    return;
  }
  await preloadImage(url);
  if (state.bgUrl !== url) return; // sudah berganti selagi menunggu
  back.src = url;
  back.classList.add("is-visible");
  front.classList.remove("is-visible");
  state.bgFront = back === el.bgA ? "a" : "b";
}

function setCharacter(url) {
  if (url === state.charUrl) return;
  state.charUrl = url;
  el.char.classList.remove("is-visible");
  if (!url) return;
  setTimeout(() => {
    if (state.charUrl !== url) return;
    el.char.src = url;
    el.char.classList.add("is-visible");
  }, reducedMotion ? 0 : 180);
}
el.char.addEventListener("error", () => el.char.classList.remove("is-visible"));

// ---------- Audio ----------
function stopAudio() {
  if (state.audio) {
    state.audio.pause();
    state.audio = null;
  }
}

function playAudio(url, force) {
  stopAudio();
  if (!url) return;
  const a = new Audio(url);
  a.preload = "auto";
  a.muted = force ? false : !state.settings.sound;
  state.audio = a;
  a.play().catch(() => { /* autoplay diblokir / file gagal: abaikan */ });
}

// ---------- Backsound (musik latar per tema) ----------
function fadeAudio(a, to, ms, done) {
  const from = a.volume;
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  const timer = setInterval(() => {
    i++;
    a.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
    if (i >= steps) {
      clearInterval(timer);
      if (done) done();
    }
  }, 40);
}

function setBgm(url) {
  if (url === state.bgmUrl) return; // tema sama: biarkan terus berputar
  state.bgmUrl = url;

  const old = state.bgm;
  state.bgm = null;
  if (old) fadeAudio(old, 0, 600, () => old.pause());
  if (!url) return;

  const a = new Audio(url);
  a.loop = true;
  a.volume = 0;
  a.muted = !state.settings.sound;
  state.bgm = a;
  state.bgmBlocked = false;
  a.addEventListener("error", () => {
    if (state.bgm === a) state.bgmBlocked = false;
    console.warn("Musik latar gagal dimuat:", url);
  });
  startBgm(a);
}

function startBgm(a) {
  a.play()
    .then(() => {
      if (state.bgm !== a) return;
      state.bgmBlocked = false;
      fadeAudio(a, CONFIG.BGM_VOLUME, 800);
    })
    .catch(() => {
      // Browser menolak autoplay sebelum ada interaksi: coba lagi saat pemain pertama kali mengetuk/menekan tombol
      if (state.bgm === a && !a.error) state.bgmBlocked = true;
    });
}

["pointerdown", "keydown"].forEach((evt) =>
  document.addEventListener(
    evt,
    () => {
      if (state.bgm && state.bgmBlocked && !document.hidden) {
        state.bgmBlocked = false;
        startBgm(state.bgm);
      }
    },
    true
  )
);

// Musik menu utama
const menuBgmUrl = () => (CONFIG.MENU_BGM ? encodeURI(CONFIG.MENU_BGM) : "");

document.addEventListener("visibilitychange", () => {
  [state.audio, state.bgm].forEach((a) => {
    if (!a) return;
    if (document.hidden) a.pause();
    else if (!a.ended) a.play().catch(() => {});
  });
});

// ---------- Efek mengetik ----------
function typeText(text) {
  clearTimeout(state.typeTimer);
  const tokens = tokenize(text);
  const shown = document.createElement("span");
  const ghost = document.createElement("span");
  ghost.className = "ghost";
  el.text.replaceChildren(shown, ghost);
  el.text.scrollTop = 0;

  const all = tokens.map((t) => t.html).join("");
  const speed = SPEEDS[state.settings.speed];

  if (reducedMotion || speed === 0 || tokens.length === 0) {
    shown.innerHTML = all;
    endTyping();
    return;
  }

  state.typing = true;
  let i = 0;

  state.finishTyping = () => {
    clearTimeout(state.typeTimer);
    shown.innerHTML = all;
    ghost.innerHTML = "";
    endTyping();
  };

  const step = () => {
    i++;
    shown.innerHTML = tokens.slice(0, i).map((t) => t.html).join("");
    ghost.innerHTML = tokens.slice(i).map((t) => t.html).join("");
    if (i >= tokens.length) {
      endTyping();
      return;
    }
    const c = tokens[i - 1].ch;
    const pause = "。！？!?…".includes(c) && c ? 220 : "、，,".includes(c) && c ? 90 : 0;
    state.typeTimer = setTimeout(step, speed + pause);
  };
  step();
}

function endTyping() {
  state.typing = false;
  state.finishTyping = null;
  el.trans.classList.remove("is-pending");
  showChoicesOrNext();
}

// ---------- Pilihan jawaban ----------
function showChoicesOrNext() {
  const node = state.node;
  if (!node) return;
  const choices = (node.choices || []).slice(0, 2);

  if (choices.length === 0) {
    if (node.next) el.nextBtn.classList.add("is-ready");
    return;
  }

  const cards = choices.map((choice, index) => {
    const btn = h("button", "choice-btn");
    btn.type = "button";

    const jp = h("div", "choice-jp");
    jp.lang = "ja";
    jp.innerHTML = richHTML(choice.text);

    const body = h("div", "choice-body");
    body.appendChild(jp);
    if (choice.translation) body.appendChild(h("div", "choice-trans", choice.translation));

    btn.append(h("span", "choice-letter", index === 0 ? "A." : "B."), body);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.choices.querySelectorAll("button").forEach((b) => (b.disabled = true));
      state.history.push({ text: choice.text, translation: choice.translation || "" });
      state.lastChoiceKey = state.nodeKey;
      loadScene(choice.next);
    });
    return btn;
  });

  el.choices.replaceChildren(h("div", "choices-head", "Pilih jawabanmu"), ...cards);
  el.stage.classList.add("has-choices");
}

// ---------- Ending ----------
function getEnding(node) {
  const e = String(node.ending || "").trim().toLowerCase();
  if (e) return ["challenge", "tantangan", "bad", "gagal"].includes(e) ? "challenge" : "good";
  if (!(node.choices || []).length && !node.next) return "end";
  return null;
}

function showEnding(node, type) {
  const challenge = type === "challenge";
  el.dialog.classList.add("is-hidden");
  el.nextBtn.classList.remove("is-ready");
  el.choices.replaceChildren();

  el.endingCard.className = "ending-card " + (challenge ? "is-challenge" : type === "good" ? "is-good" : "is-end");
  el.endingIcon.textContent = challenge ? "!" : "🌸";
  el.endingTitle.innerHTML = richHTML(node.text);
  el.endingBadge.textContent = challenge ? "Challenge Ending" : type === "good" ? "Good Ending" : "Tamat";
  el.endingDesc.textContent = node.translation || "";

  const primary = h("button", "btn-blue", challenge ? "Coba Lagi" : "Lihat Ringkasan");
  primary.type = "button";
  primary.addEventListener("click", challenge ? retryFromChoice : () => openKnowledge("summary"));

  const again = replayAction();
  const secondary = h("button", "btn-link", challenge ? "Lihat Ringkasan" : again.label);
  secondary.type = "button";
  secondary.addEventListener("click", challenge ? () => openKnowledge("summary") : again.run);

  el.endingActions.replaceChildren(primary, secondary);
  el.ending.classList.remove("is-hidden");
}

function retryFromChoice() {
  if (state.lastChoiceKey) {
    state.history.pop();
    const key = state.lastChoiceKey;
    state.lastChoiceKey = null;
    loadScene(key);
  } else {
    startGame(state.startKey || CONFIG.START_NODE, null, state.theme);
  }
}

// ---------- Memuat adegan ----------
async function loadScene(key) {
  const fromKey = state.nodeKey;
  let node = getNode(key);
  if (!node) {
    const t0 = ++state.token;
    state.busy = true;
    el.dialog.classList.add("is-hidden");
    el.choices.replaceChildren();
    showOverlay({ msg: "Memeriksa data terbaru…", loading: true });
    node = await refreshForScene(key);
    if (t0 !== state.token) return;
    state.busy = false;
    if (!node) {
      showSceneError(key, fromKey);
      return;
    }
    hideOverlay();
  }

  const token = ++state.token;
  state.busy = true;
  clearTimeout(state.typeTimer);
  state.typing = false;
  state.finishTyping = null;
  el.choices.replaceChildren();
  el.stage.classList.remove("has-choices");
  el.nextBtn.classList.remove("is-ready");
  el.ending.classList.add("is-hidden");

  const bg = mediaUrl(node.background, "image");
  const ch = mediaUrl(node.character, "image");
  const audio = mediaUrl(node.audio, "audio");

  // Tunggu kamus furigana (hanya jika belum siap), lalu gambar (maksimal beberapa detik)
  await ensureFurigana();
  await Promise.race([Promise.all([preloadImage(bg), preloadImage(ch)]), sleep(CONFIG.IMAGE_WAIT)]);
  await prepareNode(node);
  if (token !== state.token) return;

  state.nodeKey = key;
  state.node = node;
  state.busy = false;
  if (node.chapter) state.chapter = node.chapter;
  if (node.theme) state.theme = node.theme;

  const ending = getEnding(node);
  if (ending) state.endingTitle = node.endingTitle || "";
  el.chapter.textContent = ending && node.endingTitle ? node.endingTitle : state.chapter;

  setBackground(bg);
  setCharacter(ch);
  playAudio(audio);
  setBgm(mediaUrl(state.themes[String(state.theme).toLowerCase()], "audio"));
  prefetchNeighbors(node);

  if (ending) {
    removeStore(CONFIG.SAVE_KEY);
    showEnding(node, ending);
    return;
  }

  state.read++;
  writeStore(CONFIG.SAVE_KEY, JSON.stringify({ key, chapter: state.chapter, theme: state.theme, start: state.startKey, history: state.history, read: state.read }));

  el.dialog.classList.remove("is-hidden");
  el.speaker.textContent = node.speaker || "";
  el.speakBtn.hidden = !audio;
  el.trans.textContent = node.translation || "";
  el.trans.classList.add("is-pending");
  typeText(node.text);
}

// ---------- Interaksi ----------
function uiBlocked() {
  return !isHidden(el.overlay) || !isHidden(el.title) || !isHidden(el.themes) || !isHidden(el.modal) || !isHidden(el.ending);
}

function advance() {
  if (!state.started || state.busy || uiBlocked()) return;

  if (state.typing) {
    if (state.finishTyping) state.finishTyping();
    return;
  }

  const node = state.node;
  if (!node || (node.choices || []).length > 0) return; // tunggu pemain memilih
  if (node.next) loadScene(node.next);
}

el.stage.addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  advance();
});

el.nextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  advance();
});

el.speakBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (state.node) playAudio(mediaUrl(state.node.audio, "audio"), true);
});

el.muteBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  state.settings.sound = !state.settings.sound;
  saveSettings();
  applySettings();
});

el.vocabBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  openKnowledge("vocab");
});

el.settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  openSettings();
});

el.btnStart.addEventListener("click", () => {
  if (state.themeList.length) showThemeSelect();
  else startGame(CONFIG.START_NODE);
});
el.themesBack.addEventListener("click", () => el.themes.classList.add("is-hidden"));
el.btnSettings.addEventListener("click", openSettings);
el.btnAbout.addEventListener("click", openAbout);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !isHidden(el.modal)) {
    closeModal();
    return;
  }
  if (uiBlocked()) return;
  if (e.target && e.target.tagName === "BUTTON") return;

  if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") {
    e.preventDefault();
    advance();
  } else if (e.key === "1" || e.key === "2") {
    const btn = el.choices.querySelectorAll(".choice-btn")[Number(e.key) - 1];
    if (btn) btn.click();
  }
});

// ---------- Jendela (modal) ----------
function openModal(cfg, tabId) {
  state.modal = cfg;
  el.modalTitle.textContent = cfg.title;
  el.modalTabs.replaceChildren();

  if (cfg.tabs.length > 1) {
    cfg.tabs.forEach((t) => {
      const b = h("button", "tab", t.label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.id = t.id;
      b.addEventListener("click", () => selectTab(t.id));
      el.modalTabs.appendChild(b);
    });
    el.modalTabs.hidden = false;
  } else {
    el.modalTabs.hidden = true;
  }

  selectTab(tabId || cfg.tabs[0].id);
  el.modal.classList.remove("is-hidden");
  el.modalClose.focus({ preventScroll: true });
}

function selectTab(id) {
  const tab = state.modal.tabs.find((t) => t.id === id) || state.modal.tabs[0];
  el.modalTabs.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === tab.id)));
  el.modalBody.replaceChildren();
  el.modalFoot.replaceChildren();
  el.modalBody.scrollTop = 0;
  tab.render(el.modalBody, el.modalFoot);
}

function closeModal() {
  el.modal.classList.add("is-hidden");
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

el.modalClose.addEventListener("click", (e) => {
  e.stopPropagation();
  closeModal();
});
el.modal.addEventListener("click", (e) => {
  e.stopPropagation();
  if (e.target === el.modal) closeModal();
});

// ---------- Isi jendela: Kosakata, Tata Bahasa, Ringkasan ----------
function openKnowledge(tabId) {
  openModal(
    {
      title: "Kosakata & Penjelasan",
      tabs: [
        { id: "vocab", label: "Kosakata", render: renderVocab },
        { id: "grammar", label: "Tata Bahasa", render: renderGrammar },
        { id: "summary", label: "Ringkasan", render: renderSummary },
      ],
    },
    tabId
  );
}

function renderVocab(box) {
  if (!state.vocab.length) {
    box.appendChild(h("p", "empty", "Belum ada kosakata. Tambahkan di sheet “Kosakata” pada Google Sheets."));
    return;
  }
  box.appendChild(h("h3", "sec-title", "Kosakata baru"));
  const table = h("table", "vocab-table");
  const tbody = document.createElement("tbody");
  state.vocab.forEach((v) => {
    const tr = document.createElement("tr");
    const jp = h("td");
    jp.lang = "ja";
    jp.appendChild(h("span", "v-kanji", v.kanji || v.yomi || ""));
    if (v.kanji && v.yomi) jp.appendChild(h("span", "v-yomi", ` (${v.yomi})`));
    tr.append(jp, h("td", "v-romaji", v.romaji || ""), h("td", "v-arti", v.arti || ""));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  box.appendChild(table);
}

function renderGrammar(box) {
  if (!state.grammar.length) {
    box.appendChild(h("p", "empty", "Belum ada penjelasan tata bahasa. Tambahkan di sheet “Tata Bahasa” pada Google Sheets."));
    return;
  }
  box.appendChild(h("h3", "sec-title", "Pola kalimat penting"));
  state.grammar.forEach((g) => {
    const card = h("div", "g-card");
    card.appendChild(h("div", "g-pola", g.pola || ""));
    if (g.arti) card.appendChild(h("div", "g-arti", g.arti));
    if (g.contoh) {
      const ex = h("div", "g-ex");
      ex.lang = "ja";
      ex.innerHTML = richHTML(g.contoh);
      card.appendChild(ex);
      if (g.terjemahan) card.appendChild(h("div", "g-ex-trans", g.terjemahan));
    }
    box.appendChild(card);
  });
}

function renderSummary(box, foot) {
  box.appendChild(h("h3", "sec-title", state.endingTitle || "Ringkasan petualanganmu"));

  const stats = h("div", "stats");
  [
    [state.read, "dialog dibaca"],
    [state.history.length, "jawaban dipilih"],
    [state.vocab.length, "kosakata"],
  ].forEach(([num, label]) => {
    const s = h("div", "stat");
    s.append(h("b", "", String(num)), h("span", "", label));
    stats.appendChild(s);
  });
  box.appendChild(stats);

  if (state.history.length) {
    box.appendChild(h("h3", "sec-title", "Jawaban yang kamu pilih"));
    state.history.forEach((item) => {
      const row = h("div", "sum-choice");
      const jp = h("div", "sum-jp");
      jp.lang = "ja";
      jp.innerHTML = richHTML(item.text);
      row.appendChild(jp);
      if (item.translation) row.appendChild(h("div", "sum-trans", item.translation));
      box.appendChild(row);
    });
  }

  const replay = replayAction();
  const again = h("button", "btn-blue", replay.label);
  again.type = "button";
  again.addEventListener("click", replay.run);
  foot.appendChild(again);
}

// ---------- Isi jendela: Pengaturan & Tentang ----------
function openSettings() {
  openModal({ title: "Pengaturan", tabs: [{ id: "settings", label: "Pengaturan", render: renderSettings }] });
}

function renderSettings(box) {
  box.replaceChildren();
  const rerender = () => renderSettings(box);

  // Kecepatan teks
  const group = h("div", "set-group");
  group.appendChild(h("div", "set-label", "Kecepatan teks"));
  const seg = h("div", "seg");
  [["lambat", "Lambat"], ["normal", "Normal"], ["cepat", "Cepat"], ["instan", "Instan"]].forEach(([key, label]) => {
    const b = h("button", "seg-btn", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.settings.speed === key));
    b.addEventListener("click", () => {
      state.settings.speed = key;
      saveSettings();
      rerender();
    });
    seg.appendChild(b);
  });
  group.appendChild(seg);
  box.appendChild(group);

  // Sakelar
  [
    ["sound", "Suara"],
    ["furigana", "Furigana (cara baca di atas kanji)"],
    ["translation", "Terjemahan Indonesia"],
  ].forEach(([key, label]) => {
    const row = h("div", "switch-row");
    row.appendChild(h("span", "", label));
    const sw = h("button", "switch");
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", label);
    sw.setAttribute("aria-checked", String(state.settings[key]));
    sw.addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      saveSettings();
      applySettings();
      rerender();
    });
    row.appendChild(sw);
    box.appendChild(row);
  });

  // Kembali ke menu utama (hanya saat sedang bermain)
  if (state.started) {
    const home = h("button", "btn-blue", "Kembali ke menu utama");
    home.type = "button";
    home.style.marginTop = "1em";
    home.addEventListener("click", () => {
      closeModal();
      showMenu();
    });
    box.appendChild(home);
  }
}

function openAbout() {
  openModal({
    title: "Tentang",
    tabs: [{
      id: "about",
      label: "Tentang",
      render: (box) => {
        const wrap = h("div", "about");
        [
          "Nihongo Adventure adalah game belajar bahasa Jepang lewat cerita dan percakapan interaktif.",
          "Ketuk layar (atau tekan Spasi) untuk melanjutkan dialog. Pilih jawaban A atau B untuk menentukan jalan ceritanya.",
          "Buka tombol buku di pojok kanan atas kapan saja untuk melihat kosakata dan tata bahasa.",
        ].forEach((t) => wrap.appendChild(h("p", "", t)));
        box.appendChild(wrap);
      },
    }],
  });
}

// ---------- Mulai ----------
async function init() {
  state.settings = loadSettings();
  initAutoFurigana().then((ok) => { if (ok) prepareAll(); });

  el.vocabBtn.innerHTML = ICON.book;
  el.settingsBtn.innerHTML = ICON.gear;
  el.speakBtn.innerHTML = ICON.volume;
  el.nextBtn.insertAdjacentHTML("beforeend", ICON.chevron);
  el.btnStart.insertAdjacentHTML("afterbegin", ICON.play);
  el.btnSettings.insertAdjacentHTML("afterbegin", ICON.gear);
  el.btnAbout.insertAdjacentHTML("afterbegin", ICON.book);
  applySettings();

  showOverlay({ msg: "Memuat cerita…", loading: true });

  // Pakai data tersimpan (jika ada) agar langsung siap, lalu perbarui di latar belakang
  const cached = readJSON(CONFIG.CACHE_KEY);
  const hasCache = cached && cached.story && cached.story[CONFIG.START_NODE];

  if (hasCache) {
    useData(normalize(cached));
    await showTitle();
    fetchStory()
      .then((data) => {
        useData(data);
        writeStore(CONFIG.CACHE_KEY, JSON.stringify(data));
      })
      .catch(() => { /* tetap pakai data tersimpan */ });
    return;
  }

  try {
    const data = await fetchStory();
    useData(data);
    writeStore(CONFIG.CACHE_KEY, JSON.stringify(data));
    console.log("Data berhasil dimuat dari Google Sheets:", data);
    await showTitle();
  } catch (err) {
    console.error("Gagal mengambil data dari Google Sheets:", err);
    showOverlay({
      msg: friendlyError(err),
      actions: [{ label: "Coba lagi", onClick: init }],
    });
  }
}

document.addEventListener("DOMContentLoaded", init);