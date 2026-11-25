#!/usr/bin/env node
/*
 * Riscrive in index.html i contenuti statici generati da STUDIO e ORARI:
 * indirizzo, link mappa/telefono/email, tabella orari, <span data-studio> e JSON-LD.
 * La logica è nel blocco BUILDER di site.js (la stessa che usa il browser).
 *
 * Uso (dalla cartella del sito):
 *   node .strumenti/genera-statico.mjs           riscrive index.html
 *   node .strumenti/genera-statico.mjs --check   non scrive; esce con 1 se l'HTML è da rigenerare
 *
 * Questa cartella inizia con il punto: GitHub Pages non la pubblica. Nessuna dipendenza.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const fileIndex = join(radice, "index.html");
const soloControllo = process.argv.includes("--check");

const html = readFileSync(fileIndex, "utf8");

function unico(testo, regex, descrizione) {
  const trovati = testo.match(new RegExp(regex.source, regex.flags.replace("g", "") + "g")) || [];
  if (trovati.length !== 1) {
    throw new Error(`${descrizione}: attese 1 occorrenza, trovate ${trovati.length}`);
  }
  return testo.match(regex);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 1. STUDIO e ORARI dal primo script inline.
const dati = unico(html, /<script>\s*(var STUDIO[\s\S]*?)<\/script>/, "script STUDIO/ORARI")[1];
const contesto = vm.createContext({});
vm.runInContext(dati, contesto);
const { STUDIO, ORARI } = contesto;

// 2. Funzione costruisciDati dal blocco BUILDER di site.js.
const sorgenteJs = readFileSync(join(radice, "site.js"), "utf8");
const builder = unico(sorgenteJs, /\/\*#BUILDER-INIZIO\*\/([\s\S]*?)\/\*#BUILDER-FINE\*\//, "blocco BUILDER in site.js")[1];
vm.runInContext(builder, contesto);

// 3. Link di prenotazione: letto dal pulsante, mai scritto a mano altrove.
const prenotaUrl = unico(html, /<a[^>]*id="prenota"[^>]*href="([^"]+)"/, "pulsante #prenota")[1];

const d = contesto.costruisciDati(STUDIO, ORARI, prenotaUrl);

function sostituisci(testo, regex, descrizione, nuovo) {
  unico(testo, regex, descrizione);
  return testo.replace(regex, (_, a, b) => a + nuovo + (b === undefined ? "" : b));
}

function rimpiazza(testo, regex, nuovo, descrizione) {
  unico(testo, regex, descrizione);
  return testo.replace(regex, () => nuovo);
}

let out = html;

out = out.replace(/(<span data-studio="([a-z]+)">)[^<]*(<\/span>)/g, (_, apri, chiave, chiudi) => {
  if (!(chiave in STUDIO)) throw new Error(`data-studio="${chiave}" non esiste in STUDIO`);
  return apri + esc(STUDIO[chiave]) + chiudi;
});

out = sostituisci(
  out,
  /(<address id="indirizzo">)[\s\S]*?(<\/address>)/,
  "address #indirizzo",
  `${esc(STUDIO.via)}<br>${esc(d.cittaProv)}`
);

out = rimpiazza(out, /<a id="mappa" href="[^"]*"/, `<a id="mappa" href="${esc(d.mappaHref)}"`, "link #mappa");
out = rimpiazza(out, /<a id="telefono" href="[^"]*">[^<]*<\/a>/, `<a id="telefono" href="${esc(d.telHref)}">${esc(STUDIO.telefono)}</a>`, "link #telefono");
out = rimpiazza(out, /<a id="email" href="[^"]*">[^<]*<\/a>/, `<a id="email" href="${esc(d.mailHref)}">${esc(STUDIO.email)}</a>`, "link #email");

const righe = d.righe
  .map((r) => `              <tr><th scope="row">${esc(r.giorno)}</th><td>${esc(r.orario)}</td></tr>`)
  .join("\n");
out = sostituisci(out, /(<tbody id="tabella-orari">)[\s\S]*?(<\/tbody>)/, "tbody #tabella-orari", `\n${righe}\n            `);

out = sostituisci(
  out,
  /(<script type="application\/ld\+json" id="dati-strutturati">)[\s\S]*?(<\/script>)/,
  "script JSON-LD",
  d.jsonLd
);

// Controlli di coerenza (avvisi, non bloccanti).
const avvisi = [];
const privacy = readFileSync(join(radice, "privacy.html"), "utf8");
for (const [nome, valore] of [["via", STUDIO.via], ["cap", STUDIO.cap], ["città", STUDIO.citta], ["email", STUDIO.email]]) {
  if (!privacy.includes(valore)) avvisi.push(`privacy.html non contiene ${nome} "${valore}": aggiornala a mano.`);
}
const testa = out.slice(0, out.indexOf("<body"));
for (const tag of ["<title>", 'name="description"', 'property="og:description"', 'property="og:image:alt"']) {
  const pos = testa.indexOf(tag);
  const riga = pos < 0 ? "" : testa.slice(pos, testa.indexOf("\n", pos));
  if (!riga.includes(STUDIO.citta)) avvisi.push(`${tag} non nomina "${STUDIO.citta}": se hai cambiato città, aggiornalo a mano.`);
}

if (soloControllo) {
  if (out !== html) {
    console.error("index.html NON è aggiornato: lancia  node .strumenti/genera-statico.mjs");
    avvisi.forEach((a) => console.error("Avviso: " + a));
    process.exit(1);
  }
  console.log("index.html è aggiornato.");
  avvisi.forEach((a) => console.log("Avviso: " + a));
} else if (out === html) {
  console.log("Nessuna modifica: index.html era già aggiornato.");
  avvisi.forEach((a) => console.log("Avviso: " + a));
} else {
  writeFileSync(fileIndex, out);
  console.log("index.html riscritto.");
  avvisi.forEach((a) => console.log("Avviso: " + a));
}
