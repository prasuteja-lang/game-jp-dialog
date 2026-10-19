"use strict";

const fs = require("node:fs");
const path = require("node:path");
const kuromoji = require("kuromoji");

const root = path.resolve(__dirname, "..");
const storyPath = path.join(root, "data", "story.json");
const outputPath = path.join(root, "data", "furigana.json");
const dictionaryPath = path.join(path.dirname(require.resolve("kuromoji")), "..", "dict") + path.sep;
const kanji = /[\u3400-\u9fff々〆ヶ]/;
const manualRuby = /([\u3400-\u9fff々〆ヶ]+)(?:\[([^\]]+)\]|[（(]([\u3040-\u30ffー]+)[）)])/g;

function toHiragana(reading) {
  return Array.from(reading, (character) => {
    const code = character.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6
      ? String.fromCharCode(code - 0x60)
      : character;
  }).join("");
}

function annotatePlain(text, tokenizer) {
  return tokenizer.tokenize(text).map((token) => {
    const surface = token.surface_form;
    const match = surface.match(/^([\u3040-\u309f]*)([\u3400-\u9fff々〆ヶ]+)([\u3040-\u309f]*)$/);
    if (!match || !token.reading || token.reading === "*") return surface;

    let reading = toHiragana(token.reading);
    const [, prefix, base, suffix] = match;
    if (prefix) {
      if (!reading.startsWith(prefix)) return surface;
      reading = reading.slice(prefix.length);
    }
    if (suffix) {
      if (!reading.endsWith(suffix)) return surface;
      reading = reading.slice(0, -suffix.length);
    }
    if (!reading || !kanji.test(base)) return surface;

    return `${prefix}${base}[${reading}]${suffix}`;
  }).join("");
}

function annotate(text, tokenizer) {
  text = String(text || "");
  let output = "";
  let last = 0;
  let match;
  const manual = new RegExp(manualRuby.source, "g");

  while ((match = manual.exec(text)) !== null) {
    output += annotatePlain(text.slice(last, match.index), tokenizer) + match[0];
    last = match.index + match[0].length;
  }
  return output + annotatePlain(text.slice(last), tokenizer);
}

function generate(tokenizer) {
  const source = JSON.parse(fs.readFileSync(storyPath, "utf8"));
  if (!source.story || typeof source.story !== "object") {
    throw new Error("data/story.json tidak berisi objek story yang valid.");
  }

  const result = {};
  for (const [id, node] of Object.entries(source.story)) {
    result[id] = {
      sourceText: String(node.text || ""),
      text: annotate(node.text, tokenizer),
      choices: (node.choices || []).map((choice) => ({
        source: String(choice.text || ""),
        text: annotate(choice.text, tokenizer),
      })),
    };
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Furigana dibuat untuk ${Object.keys(result).length} adegan: ${path.relative(root, outputPath)}`);
}

kuromoji.builder({ dicPath: dictionaryPath }).build((error, tokenizer) => {
  if (error) {
    console.error("Gagal memuat kamus Kuromoji untuk membuat furigana:", error);
    process.exitCode = 1;
    return;
  }
  generate(tokenizer);
});
