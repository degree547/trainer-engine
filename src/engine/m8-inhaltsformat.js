// M8 Inhaltsformat: liest eine Moduldatei und prüft sie vollständig (F-24, F-25, F-26, F-32).
// Das Modul kennt keine Prüfungsinhalte, nur die Form eines Inhaltsmoduls.
//
// Ein Inhaltsmodul ist eine JSON-Datei:
//   {
//     "format": 1,
//     "meta":   { "id", "titel", "sprache", "version", "stand" (JJJJ-MM-TT),
//                 optional "herkunft", "quelle", "hinweis" },
//     "themen": [ { "id", "titel", optional "beschreibung" } ],
//     "fragen": [ Frage, … ]
//   }
//
// Jede Frage (F-25): "id" (beginnt mit <meta.id>-), "thema", "typ", "frage",
//   "erklaerung" (Text, darf leer sein), "quelle", optional "hinweis".
//   typ "mc":       "optionen" (mindestens 2 Texte), "richtig" (Nummer der Option ab 0),
//                   optional "mischen" (true | false, Standard true: Reihenfolge wird gemischt;
//                   false z. B. bei „Alle oben genannten“), optional "herkunft" (amtlich | buch | eigen)
//   typ "freitext": "musterantwort", "kernpunkte" (Liste von Texten),
//                   "kernpunkteStatus" (ungeprueft | geprueft),
//                   "herkunft" (amtlich | buch | eigen)              (F-32)
//
// Fehler sind Objekte { code, zeile, ort, werte }; die Texte zu den Codes stehen in src/i18n.

export const FORMAT_VERSION = 1;
export const FRAGETYPEN = ['mc', 'freitext'];
export const HERKUENFTE = ['amtlich', 'buch', 'eigen'];
export const PRUEFSTATUS = ['ungeprueft', 'geprueft'];

const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// JSON lesen und dabei die Zeile jedes Werts merken
// ---------------------------------------------------------------------------

export class JsonFehler extends Error {
  constructor(code, zeile, spalte, werte = {}) {
    super(code);
    this.name = 'JsonFehler';
    this.code = code;
    this.zeile = zeile;
    this.spalte = spalte;
    this.werte = werte;
  }
}

/**
 * Liest JSON-Text wie JSON.parse, merkt sich aber für jeden Wert die Zeile.
 * Pfade werden als Text geschrieben: "fragen.3.typ".
 * @returns {{ daten: any, zeilen: Map<string, number> }}
 * @throws {JsonFehler} mit Zeile und Spalte
 */
export function leseJsonMitZeilen(text) {
  let pos = 0;
  let zeile = 1;
  let zeilenStart = 0;
  const zeilen = new Map();

  if (text.charCodeAt(0) === 0xfeff) pos = 1; // Byte-Order-Mark überspringen

  const fehler = (code, werte) => new JsonFehler(code, zeile, pos - zeilenStart + 1, werte);

  function leerraum() {
    while (pos < text.length) {
      const z = text[pos];
      if (z === '\n') { zeile++; pos++; zeilenStart = pos; }
      else if (z === ' ' || z === '\t' || z === '\r') pos++;
      else break;
    }
  }

  function erwarte(zeichen) {
    if (text[pos] !== zeichen) {
      if (pos >= text.length) throw fehler('json.unerwartetesEnde');
      throw fehler('json.erwartet', { erwartet: zeichen, zeichen: text[pos] });
    }
    pos++;
  }

  function wert(pfad) {
    leerraum();
    if (pos >= text.length) throw fehler('json.unerwartetesEnde');
    zeilen.set(pfad, zeile);
    const z = text[pos];
    if (z === '{') return objekt(pfad);
    if (z === '[') return liste(pfad);
    if (z === '"') return zeichenkette();
    if (z === '-' || (z >= '0' && z <= '9')) return zahl();
    for (const [wort, ergebnis] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(wort, pos)) { pos += wort.length; return ergebnis; }
    }
    throw fehler('json.unerwartetesZeichen', { zeichen: z });
  }

  function objekt(pfad) {
    pos++;
    const ergebnis = {};
    leerraum();
    if (text[pos] === '}') { pos++; return ergebnis; }
    for (;;) {
      leerraum();
      if (text[pos] !== '"') {
        if (pos >= text.length) throw fehler('json.unerwartetesEnde');
        throw fehler('json.schluesselErwartet', { zeichen: text[pos] });
      }
      const schluesselZeile = zeile;
      const schluessel = zeichenkette();
      if (Object.prototype.hasOwnProperty.call(ergebnis, schluessel)) {
        throw new JsonFehler('json.doppelterSchluessel', schluesselZeile, 1, { schluessel });
      }
      leerraum();
      erwarte(':');
      const kind = pfad === '' ? schluessel : `${pfad}.${schluessel}`;
      ergebnis[schluessel] = wert(kind);
      leerraum();
      if (text[pos] === ',') { pos++; continue; }
      if (text[pos] === '}') { pos++; return ergebnis; }
      if (pos >= text.length) throw fehler('json.unerwartetesEnde');
      throw fehler('json.kommaFehlt', { klammer: '}', zeichen: text[pos] });
    }
  }

  function liste(pfad) {
    pos++;
    const ergebnis = [];
    leerraum();
    if (text[pos] === ']') { pos++; return ergebnis; }
    for (;;) {
      const kind = pfad === '' ? String(ergebnis.length) : `${pfad}.${ergebnis.length}`;
      ergebnis.push(wert(kind));
      leerraum();
      if (text[pos] === ',') { pos++; continue; }
      if (text[pos] === ']') { pos++; return ergebnis; }
      if (pos >= text.length) throw fehler('json.unerwartetesEnde');
      throw fehler('json.kommaFehlt', { klammer: ']', zeichen: text[pos] });
    }
  }

  function zeichenkette() {
    pos++; // öffnendes "
    let ergebnis = '';
    let start = pos;
    for (;;) {
      if (pos >= text.length) throw fehler('json.unerwartetesEnde');
      const code = text.charCodeAt(pos);
      if (code === 0x22) { ergebnis += text.slice(start, pos); pos++; return ergebnis; }
      if (code < 0x20) throw fehler('json.steuerzeichen');
      if (code === 0x5c) {
        ergebnis += text.slice(start, pos);
        const z = text[pos + 1];
        const einfach = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (z in einfach) { ergebnis += einfach[z]; pos += 2; }
        else if (z === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(pos + 2, pos + 6))) {
          ergebnis += String.fromCharCode(parseInt(text.slice(pos + 2, pos + 6), 16));
          pos += 6;
        } else throw fehler('json.escape');
        start = pos;
        continue;
      }
      pos++;
    }
  }

  function zahl() {
    const treffer = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(pos, pos + 40));
    if (!treffer) throw fehler('json.zahl');
    pos += treffer[0].length;
    return Number(treffer[0]);
  }

  const daten = wert('');
  leerraum();
  if (pos < text.length) throw fehler('json.restText', { zeichen: text[pos] });
  return { daten, zeilen };
}

// ---------------------------------------------------------------------------
// Modul prüfen
// ---------------------------------------------------------------------------

const istObjekt = (w) => w !== null && typeof w === 'object' && !Array.isArray(w);
const istText = (w) => typeof w === 'string' && w.trim() !== '';

/**
 * Prüft ein gelesenes Modul vollständig.
 * @param {any} daten
 * @param {Map<string, number>} [zeilen] aus leseJsonMitZeilen; ohne Angabe fehlen die Zeilen
 * @returns {{code: string, zeile: number|null, ort: object, werte: object}[]} leer, wenn alles passt
 */
export function pruefeModul(daten, zeilen = new Map()) {
  const fehler = [];
  const zeileVon = (pfad) => {
    // Fehlt der Wert selbst, die Zeile des nächsthöheren Werts nehmen.
    let p = pfad;
    for (;;) {
      if (zeilen.has(p)) return zeilen.get(p);
      if (p === '') return null;
      const i = p.lastIndexOf('.');
      p = i < 0 ? '' : p.slice(0, i);
    }
  };
  const melde = (code, pfad, ort, werte = {}) => fehler.push({ code, zeile: zeileVon(pfad), ort, werte });

  if (!istObjekt(daten)) {
    melde('modul.keinObjekt', '', { art: 'modul' });
    return fehler;
  }

  const modulOrt = { art: 'modul' };
  if (daten.format !== FORMAT_VERSION) melde('modul.formatVersion', 'format', modulOrt);

  // meta
  const meta = daten.meta;
  const metaOrt = { art: 'meta' };
  if (!istObjekt(meta)) {
    melde('modul.metaFehlt', 'meta', modulOrt);
  } else {
    if (!istText(meta.id)) melde('modul.idFehlt', 'meta.id', metaOrt);
    else if (!ID_MUSTER.test(meta.id)) melde('inhalt.idUngueltig', 'meta.id', metaOrt, { wert: meta.id });
    if (!istText(meta.titel)) melde('modul.titelFehlt', 'meta.titel', metaOrt);
    for (const feld of ['sprache', 'version']) {
      if (!istText(meta[feld])) melde('inhalt.keinText', `meta.${feld}`, metaOrt, { feld });
    }
    if (!istText(meta.stand) || !DATUM_MUSTER.test(meta.stand)) {
      melde('inhalt.datumUngueltig', 'meta.stand', metaOrt, { feld: 'stand' });
    }
    if (meta.herkunft !== undefined && !HERKUENFTE.includes(meta.herkunft)) {
      melde('inhalt.wertNichtErlaubt', 'meta.herkunft', metaOrt,
        { feld: 'herkunft', wert: String(meta.herkunft), erlaubt: HERKUENFTE.join(', ') });
    }
    for (const feld of ['quelle', 'hinweis']) {
      if (meta[feld] !== undefined && typeof meta[feld] !== 'string') {
        melde('inhalt.keinText', `meta.${feld}`, metaOrt, { feld });
      }
    }
  }

  // themen
  const themenIds = new Map(); // id -> Zeile
  if (!Array.isArray(daten.themen)) {
    melde('modul.themenFehlen', 'themen', modulOrt);
  } else {
    daten.themen.forEach((thema, i) => {
      const pfad = `themen.${i}`;
      const ort = { art: 'thema', nr: i + 1, id: istObjekt(thema) && typeof thema.id === 'string' ? thema.id : '' };
      if (!istObjekt(thema)) { melde('inhalt.keinObjekt', pfad, ort, { feld: 'themen' }); return; }
      if (!istText(thema.id)) melde('inhalt.keinText', `${pfad}.id`, ort, { feld: 'id' });
      else if (!ID_MUSTER.test(thema.id)) melde('inhalt.idUngueltig', `${pfad}.id`, ort, { wert: thema.id });
      else if (themenIds.has(thema.id)) {
        melde('inhalt.idDoppelt', `${pfad}.id`, ort, { wert: thema.id, zeile2: themenIds.get(thema.id) ?? '?' });
      } else themenIds.set(thema.id, zeileVon(`${pfad}.id`));
      if (!istText(thema.titel)) melde('inhalt.keinText', `${pfad}.titel`, ort, { feld: 'titel' });
    });
  }

  // fragen
  if (!Array.isArray(daten.fragen)) {
    melde('modul.fragenFehlen', 'fragen', modulOrt);
  } else {
    const fragenIds = new Map();
    const praefix = istObjekt(meta) && typeof meta.id === 'string' && ID_MUSTER.test(meta.id) ? `${meta.id}-` : null;
    daten.fragen.forEach((frage, i) => {
      const pfad = `fragen.${i}`;
      const ort = { art: 'frage', nr: i + 1, id: istObjekt(frage) && typeof frage.id === 'string' ? frage.id : '' };
      if (!istObjekt(frage)) { melde('inhalt.keinObjekt', pfad, ort, { feld: 'fragen' }); return; }
      pruefeFrage(frage, pfad, ort, { melde, zeileVon, themenIds, fragenIds, praefix,
        themenGeprueft: Array.isArray(daten.themen) });
    });
  }

  return fehler;
}

function pruefeFrage(frage, pfad, ort, k) {
  const { melde } = k;
  const textFeld = (feld) => {
    if (frage[feld] === undefined) melde('inhalt.feldFehlt', `${pfad}.${feld}`, ort, { feld });
    else if (!istText(frage[feld])) melde('inhalt.keinText', `${pfad}.${feld}`, ort, { feld });
  };

  // ID: Format, eindeutig, Präfix der Modul-ID (stabile IDs, F-23)
  if (frage.id === undefined) melde('inhalt.feldFehlt', `${pfad}.id`, ort, { feld: 'id' });
  else if (!istText(frage.id) || !ID_MUSTER.test(frage.id)) {
    melde('inhalt.idUngueltig', `${pfad}.id`, ort, { wert: String(frage.id) });
  } else {
    if (k.fragenIds.has(frage.id)) {
      melde('inhalt.idDoppelt', `${pfad}.id`, ort, { wert: frage.id, zeile2: k.fragenIds.get(frage.id) ?? '?' });
    } else k.fragenIds.set(frage.id, k.zeileVon(`${pfad}.id`));
    if (k.praefix && !frage.id.startsWith(k.praefix)) {
      melde('inhalt.idPraefix', `${pfad}.id`, ort, { wert: frage.id, praefix: k.praefix });
    }
  }

  // Thema
  if (frage.thema === undefined) melde('inhalt.feldFehlt', `${pfad}.thema`, ort, { feld: 'thema' });
  else if (k.themenGeprueft && !k.themenIds.has(frage.thema)) {
    melde('inhalt.themaUnbekannt', `${pfad}.thema`, ort, { wert: String(frage.thema) });
  }

  textFeld('frage');
  textFeld('quelle');
  if (frage.erklaerung === undefined) melde('inhalt.feldFehlt', `${pfad}.erklaerung`, ort, { feld: 'erklaerung' });
  else if (typeof frage.erklaerung !== 'string') {
    melde('inhalt.keinTextLeerErlaubt', `${pfad}.erklaerung`, ort, { feld: 'erklaerung' });
  }
  if (frage.hinweis !== undefined && typeof frage.hinweis !== 'string') {
    melde('inhalt.keinTextLeerErlaubt', `${pfad}.hinweis`, ort, { feld: 'hinweis' });
  }

  // Typ und typabhängige Pflichtfelder
  if (frage.typ === undefined) { melde('inhalt.feldFehlt', `${pfad}.typ`, ort, { feld: 'typ' }); return; }
  if (!FRAGETYPEN.includes(frage.typ)) {
    melde('inhalt.typUnbekannt', `${pfad}.typ`, ort, { wert: String(frage.typ), erlaubt: FRAGETYPEN.join(', ') });
    return;
  }

  if (frage.typ === 'mc') {
    const optionen = frage.optionen;
    if (optionen === undefined) melde('inhalt.feldFehlt', `${pfad}.optionen`, ort, { feld: 'optionen' });
    else if (!Array.isArray(optionen)) melde('inhalt.keineListe', `${pfad}.optionen`, ort, { feld: 'optionen' });
    else {
      if (optionen.length < 2) melde('inhalt.zuWenige', `${pfad}.optionen`, ort, { feld: 'optionen', min: 2 });
      optionen.forEach((o, j) => {
        if (!istText(o)) melde('inhalt.eintragKeinText', `${pfad}.optionen.${j}`, ort, { feld: 'optionen', nr: j + 1 });
      });
    }
    if (frage.richtig === undefined) melde('inhalt.feldFehlt', `${pfad}.richtig`, ort, { feld: 'richtig' });
    else if (!Number.isInteger(frage.richtig) || !Array.isArray(optionen)
      || frage.richtig < 0 || frage.richtig >= optionen.length) {
      melde('inhalt.richtigAusserhalb', `${pfad}.richtig`, ort,
        { max: Array.isArray(optionen) ? Math.max(optionen.length - 1, 0) : 0 });
    }
    if (frage.mischen !== undefined && typeof frage.mischen !== 'boolean') {
      melde('inhalt.keinWahrheitswert', `${pfad}.mischen`, ort, { feld: 'mischen' });
    }
    if (frage.herkunft !== undefined && !HERKUENFTE.includes(frage.herkunft)) {
      melde('inhalt.wertNichtErlaubt', `${pfad}.herkunft`, ort,
        { feld: 'herkunft', wert: String(frage.herkunft), erlaubt: HERKUENFTE.join(', ') });
    }
    return;
  }

  // freitext (F-32)
  textFeld('musterantwort');
  const kp = frage.kernpunkte;
  if (kp === undefined) melde('inhalt.feldFehlt', `${pfad}.kernpunkte`, ort, { feld: 'kernpunkte' });
  else if (!Array.isArray(kp)) melde('inhalt.keineListe', `${pfad}.kernpunkte`, ort, { feld: 'kernpunkte' });
  else {
    if (kp.length < 1) melde('inhalt.zuWenige', `${pfad}.kernpunkte`, ort, { feld: 'kernpunkte', min: 1 });
    kp.forEach((p, j) => {
      if (!istText(p)) melde('inhalt.eintragKeinText', `${pfad}.kernpunkte.${j}`, ort, { feld: 'kernpunkte', nr: j + 1 });
    });
  }
  for (const [feld, erlaubt] of [['kernpunkteStatus', PRUEFSTATUS], ['herkunft', HERKUENFTE]]) {
    if (frage[feld] === undefined) melde('inhalt.feldFehlt', `${pfad}.${feld}`, ort, { feld });
    else if (!erlaubt.includes(frage[feld])) {
      melde('inhalt.wertNichtErlaubt', `${pfad}.${feld}`, ort,
        { feld, wert: String(frage[feld]), erlaubt: erlaubt.join(', ') });
    }
  }
}

/**
 * Bequemer Einstieg: Text lesen und prüfen.
 * @returns {{ daten?: any, fehler: object[], jsonFehler?: JsonFehler }}
 */
export function lesePruefe(text) {
  let gelesen;
  try {
    gelesen = leseJsonMitZeilen(text);
  } catch (e) {
    if (e instanceof JsonFehler) return { fehler: [], jsonFehler: e };
    throw e;
  }
  return { daten: gelesen.daten, fehler: pruefeModul(gelesen.daten, gelesen.zeilen) };
}
