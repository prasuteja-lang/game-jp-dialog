"use strict";

const fs = require("node:fs");
const path = require("node:path");

const API_URL = "https://script.google.com/macros/s/AKfycbwf0-Rt3MElohK2vq4Xo57kYGPfprWcROqid4gZd0-92ObUrGg6YbbrIsdxCS3HDIJP/exec";
const outputPath = path.resolve(__dirname, "..", "data", "story.json");

function normalizeAsset(value) {
  let asset = String(value || "").trim();
  if (!asset || asset === "-") return "";
  asset = asset.replace(/^assets\/bg\//i, "assets/background/");
  return asset;
}

function themeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "berbelanja" ? "belanja" : key;
}

async function main() {
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`Apps Script menjawab HTTP ${response.status}`);

  const data = await response.json();
  if (!data.story || !data.story.stasiun_awal || !data.story.kb_start) {
    throw new Error("Data API harus berisi adegan stasiun_awal dan kb_start sebelum disimpan.");
  }
  if ([...(data.vocab || []), ...(data.grammar || [])].some((row) => !String(row.tema || "").trim())) {
    throw new Error("Kolom Tema belum tersedia pada respons API. Perbarui dan deploy Google Apps Script sebelum sinkronisasi.");
  }

  Object.values(data.story).forEach((node) => {
    node.background = normalizeAsset(node.background);
    node.character = normalizeAsset(node.character);
    node.audio = normalizeAsset(node.audio);
  });

  const themes = data.themes || [];
  const themeByKey = new Map(themes.map((theme) => [themeKey(theme.tema), theme.tema]));
  Object.values(data.story).forEach((node) => {
    const canonicalTheme = themeByKey.get(themeKey(node.theme));
    if (canonicalTheme) node.theme = canonicalTheme;
  });

  data.themes = themes.map((theme) => {
    const matchingScenes = Object.entries(data.story).filter(([, node]) => themeKey(node.theme) === themeKey(theme.tema));
    const intro = matchingScenes.find(([id]) => /_intro_01$/i.test(id));
    const namedStart = matchingScenes.find(([id]) => /_(start|awal)$/i.test(id));
    const start = data.story[theme.start] ? theme.start : (intro || namedStart || [])[0] || theme.start;
    return Object.assign({}, theme, {
      assets: normalizeAsset(theme.assets),
      start,
    });
  });

  const json = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(outputPath, json, "utf8");
  console.log(`Tersimpan ${Object.keys(data.story).length} adegan dan ${(data.themes || []).length} tema ke data/story.json`);
}

main().catch((error) => {
  console.error("Gagal menyinkronkan cerita dari Apps Script:", error);
  process.exitCode = 1;
});
