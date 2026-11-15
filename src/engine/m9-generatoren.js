// M9 Generatoren (F-28): Rechenaufgaben mit Zufallswerten, die Lösung wird berechnet.
// Das Modul kennt keine Prüfungsinhalte. Welche Aufgaben es gibt und wie gerechnet wird,
// steht im Inhaltsmodul unter "generatoren" (geprüft von M8). Die Engine liefert nur:
// - einen kleinen Formelrechner (kein eval, kein fremder Code),
// - das Erzeugen einer Aufgabe vom Typ "zahl" (F-09) aus einer Vorlage,
// - die Sperre: Ein Generator kommt nur in Runden, wenn er "freigegeben": true hat.
//   Freigegeben wird erst, wenn Tests gegen Beispielaufgaben mit bekannter Lösung grün sind.
//
// Ein Generator im Inhaltsmodul:
//   { "id", "thema", "freigegeben" (true | false),
//     "frage"       Text mit Platzhaltern {name}, z. B. "Fahrt {fahrt} kn, Zeit {zeit} h …",
//     "variablen"   { name: { "von", "bis", optional "schritt" (Standard 1) }, … },
//     "loesung"     Formel, z. B. "fahrt * zeit",
//     optional "nachkommastellen" (Lösung wird darauf gerundet),
//     "toleranz", "einheit", optional "kreis"                       wie beim Typ "zahl"
//     "erklaerung"  Text mit Platzhaltern, auch {loesung}; darf leer sein,
//     "quelle", optional "herkunft", optional "hinweis" }
//
// Formeln: Zahlen (mit Punkt), Variablen, + - * / ^ (Potenz), Klammern und die Funktionen
// in FUNKTIONEN. Winkelfunktionen rechnen in Grad. "pi" ist die Kreiszahl.
// Jede erzeugte Aufgabe hat die ID des Generators: Der Lernstand gilt für den Generator,
// nicht für einzelne Zahlenwerte (stabile IDs, F-23).

const grad = Math.PI / 180;

/** Erlaubte Funktionen mit Anzahl der Argumente [min, max]. */
export const FUNKTIONEN = {
  sin: { n: [1, 1], f: (x) => Math.sin(x * grad) },
  cos: { n: [1, 1], f: (x) => Math.cos(x * grad) },
  tan: { n: [1, 1], f: (x) => Math.tan(x * grad) },
  asin: { n: [1, 1], f: (x) => Math.asin(x) / grad },
  acos: { n: [1, 1], f: (x) => Math.acos(x) / grad },
  atan: { n: [1, 1], f: (x) => Math.atan(x) / grad },
  atan2: { n: [2, 2], f: (y, x) => Math.atan2(y, x) / grad },
  sqrt: { n: [1, 1], f: Math.sqrt },
  abs: { n: [1, 1], f: Math.abs },
  floor: { n: [1, 1], f: Math.floor },
  ceil: { n: [1, 1], f: Math.ceil },
  round: { n: [1, 2], f: (x, stellen = 0) => runde(x, stellen) },
  min: { n: [2, 9], f: Math.min },
  max: { n: [2, 9], f: Math.max },
  // Rest, der immer zwischen 0 und b liegt: mod(-10, 360) = 350.
  mod: { n: [2, 2], f: (a, b) => ((a % b) + b) % b },
};

export const KONSTANTEN = { pi: Math.PI };

/**
 * Rundet kaufmännisch auf eine Anzahl Nachkommastellen: ab 5 vom Nullpunkt weg, also
 * 2,25 → 2,3 und −2,25 → −2,3; auch 1,005 → 1,01 (Rechnen über die Dezimalschreibweise
 * vermeidet die Ungenauigkeit von 1,005 · 100).
 */
export function runde(x, stellen = 0) {
  const vorzeichen = x < 0 ? -1 : 1;
  const betrag = Math.abs(x);
  const ergebnis = Number(`${Math.round(Number(`${betrag}e${stellen}`))}e-${stellen}`);
  // Sehr kleine oder große Zahlen stehen als 1e-7 da; dann einfach rechnen.
  const sicher = Number.isFinite(ergebnis) ? ergebnis : Math.round(betrag * 10 ** stellen) / 10 ** stellen;
  return vorzeichen * sicher || 0;
}

export class FormelFehler extends Error {
  constructor(code, werte = {}) {
    super(code);
    this.name = 'FormelFehler';
    this.code = code;
    this.werte = werte;
  }
}

// ---------------------------------------------------------------------------
// Formel lesen
// ---------------------------------------------------------------------------

function zerlege(formel) {
  const teile = [];
  let pos = 0;
  while (pos < formel.length) {
    const z = formel[pos];
    if (z === ' ' || z === '\t') { pos += 1; continue; }
    const zahl = /^(\d+(\.\d+)?|\.\d+)/.exec(formel.slice(pos));
    if (zahl) { teile.push({ art: 'zahl', wert: Number(zahl[0]) }); pos += zahl[0].length; continue; }
    const name = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(formel.slice(pos));
    if (name) { teile.push({ art: 'name', wert: name[0] }); pos += name[0].length; continue; }
    if ('+-*/^(),'.includes(z)) { teile.push({ art: z }); pos += 1; continue; }
    throw new FormelFehler('formel.zeichen', { zeichen: z });
  }
  return teile;
}

/**
 * Liest eine Formel in einen Baum. Prüft dabei Funktionen und Klammern.
 * @param {string} formel
 * @returns {object} Baum für rechne()
 * @throws {FormelFehler}
 */
export function leseFormel(formel) {
  if (typeof formel !== 'string' || formel.trim() === '') throw new FormelFehler('formel.leer');
  const teile = zerlege(formel);
  let i = 0;
  const sieh = () => teile[i];
  const nimm = (art) => {
    if (sieh()?.art !== art) {
      throw new FormelFehler(sieh() ? 'formel.erwartet' : 'formel.ende', { erwartet: art });
    }
    i += 1;
  };

  // summe := produkt (('+' | '-') produkt)*
  function summe() {
    let links = produkt();
    while (sieh()?.art === '+' || sieh()?.art === '-') {
      const op = teile[i++].art;
      links = { art: 'op', op, links, rechts: produkt() };
    }
    return links;
  }
  // produkt := vorzeichen (('*' | '/') vorzeichen)*
  function produkt() {
    let links = vorzeichen();
    while (sieh()?.art === '*' || sieh()?.art === '/') {
      const op = teile[i++].art;
      links = { art: 'op', op, links, rechts: vorzeichen() };
    }
    return links;
  }
  // vorzeichen := ('-' | '+') vorzeichen | potenz
  function vorzeichen() {
    if (sieh()?.art === '-') { i += 1; return { art: 'minus', wert: vorzeichen() }; }
    if (sieh()?.art === '+') { i += 1; return vorzeichen(); }
    return potenz();
  }
  // potenz := grundwert ('^' vorzeichen)?   (rechtsassoziativ: 2^3^2 = 2^9)
  function potenz() {
    const basis = grundwert();
    if (sieh()?.art === '^') { i += 1; return { art: 'op', op: '^', links: basis, rechts: vorzeichen() }; }
    return basis;
  }
  function grundwert() {
    const teil = sieh();
    if (!teil) throw new FormelFehler('formel.ende');
    if (teil.art === 'zahl') { i += 1; return { art: 'zahl', wert: teil.wert }; }
    if (teil.art === '(') { i += 1; const innen = summe(); nimm(')'); return innen; }
    if (teil.art === 'name') {
      i += 1;
      if (sieh()?.art === '(') {
        const fn = Object.hasOwn(FUNKTIONEN, teil.wert) ? FUNKTIONEN[teil.wert] : null;
        if (!fn) throw new FormelFehler('formel.funktionUnbekannt', { name: teil.wert });
        i += 1;
        const argumente = [];
        if (sieh()?.art !== ')') {
          argumente.push(summe());
          while (sieh()?.art === ',') { i += 1; argumente.push(summe()); }
        }
        nimm(')');
        if (argumente.length < fn.n[0] || argumente.length > fn.n[1]) {
          throw new FormelFehler('formel.argumente', { name: teil.wert, anzahl: argumente.length });
        }
        return { art: 'fn', name: teil.wert, argumente };
      }
      return { art: 'name', name: teil.wert };
    }
    throw new FormelFehler('formel.unerwartet', { zeichen: teil.art });
  }

  const baum = summe();
  if (i < teile.length) throw new FormelFehler('formel.unerwartet', { zeichen: teile[i].art === 'zahl' || teile[i].art === 'name' ? String(teile[i].wert) : teile[i].art });
  return baum;
}

/** Namen der Variablen, die in einer gelesenen Formel vorkommen (ohne Konstanten). */
export function namenIn(baum, namen = new Set()) {
  if (baum.art === 'name' && !Object.hasOwn(KONSTANTEN, baum.name)) namen.add(baum.name);
  if (baum.art === 'op') { namenIn(baum.links, namen); namenIn(baum.rechts, namen); }
  if (baum.art === 'minus') namenIn(baum.wert, namen);
  if (baum.art === 'fn') baum.argumente.forEach((a) => namenIn(a, namen));
  return namen;
}

/**
 * Rechnet eine Formel aus.
 * @param {string | object} formel Text oder Baum aus leseFormel
 * @param {Record<string, number>} werte Werte der Variablen
 * @returns {number}
 * @throws {FormelFehler} bei unbekannter Variable oder einem Ergebnis, das keine Zahl ist
 */
export function rechne(formel, werte = {}) {
  const baum = typeof formel === 'string' ? leseFormel(formel) : formel;
  const ergebnis = auswerten(baum, werte);
  if (!Number.isFinite(ergebnis)) throw new FormelFehler('formel.keinErgebnis');
  return ergebnis;
}

function auswerten(k, werte) {
  switch (k.art) {
    case 'zahl': return k.wert;
    case 'name':
      if (Object.prototype.hasOwnProperty.call(werte, k.name)) return werte[k.name];
      if (Object.hasOwn(KONSTANTEN, k.name)) return KONSTANTEN[k.name];
      throw new FormelFehler('formel.variableUnbekannt', { name: k.name });
    case 'minus': return -auswerten(k.wert, werte);
    case 'fn': return FUNKTIONEN[k.name].f(...k.argumente.map((a) => auswerten(a, werte)));
    case 'op': {
      const a = auswerten(k.links, werte);
      const b = auswerten(k.rechts, werte);
      if (k.op === '+') return a + b;
      if (k.op === '-') return a - b;
      if (k.op === '*') return a * b;
      if (k.op === '/') return a / b;
      return a ** b;
    }
    default: throw new FormelFehler('formel.unerwartet', { zeichen: String(k.art) });
  }
}

// ---------------------------------------------------------------------------
// Aufgaben erzeugen
// ---------------------------------------------------------------------------

/** Mögliche Werte einer Variablen: von, von + schritt, … bis höchstens bis. */
export function wertebereich({ von, bis, schritt = 1 }) {
  const anzahl = Math.floor((bis - von) / schritt + 1e-9) + 1;
  return { anzahl, wert: (k) => runde(von + k * schritt, 10) };
}

/** Zieht für jede Variable einen Wert aus ihrem Bereich. */
export function ziehe(variablen, zufall = Math.random) {
  const werte = {};
  for (const [name, bereich] of Object.entries(variablen)) {
    const { anzahl, wert } = wertebereich(bereich);
    werte[name] = wert(Math.min(Math.floor(zufall() * anzahl), anzahl - 1));
  }
  return werte;
}

/** Setzt Werte in einen Text mit Platzhaltern {name} ein. Unbekannte Platzhalter bleiben stehen. */
export function fuelle(text, werte, zahlText = String) {
  return text.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (ganz, name) => (Object.prototype.hasOwnProperty.call(werte, name) ? zahlText(werte[name]) : ganz));
}

/** Namen der Platzhalter {name} in einem Text. */
export function platzhalterIn(text) {
  return [...String(text).matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)].map((m) => m[1]);
}

/**
 * Erzeugt aus einem Generator eine Aufgabe vom Typ "zahl".
 * @param {object} generator geprüfter Eintrag aus "generatoren"
 * @param {{zufall?: () => number, werte?: Record<string, number>, zahlText?: (n: number) => string}} [optionen]
 *   werte: feste Werte statt Zufall (für Tests gegen Beispielaufgaben)
 * @returns {object} Frage mit typ "zahl", "generator" (ID) und "werte"
 */
export function erzeugeAufgabe(generator, { zufall = Math.random, werte, zahlText = String } = {}) {
  const gezogen = werte ?? ziehe(generator.variablen, zufall);
  let loesung = rechne(generator.loesung, gezogen);
  if (Number.isInteger(generator.nachkommastellen)) loesung = runde(loesung, generator.nachkommastellen);
  if (generator.kreis) loesung = FUNKTIONEN.mod.f(loesung, generator.kreis);
  const mitLoesung = { ...gezogen, loesung };
  const aufgabe = {
    id: generator.id,
    thema: generator.thema,
    typ: 'zahl',
    frage: fuelle(generator.frage, gezogen, zahlText),
    loesung,
    toleranz: generator.toleranz,
    einheit: generator.einheit,
    erklaerung: fuelle(generator.erklaerung ?? '', mitLoesung, zahlText),
    quelle: generator.quelle,
    generator: generator.id,
    werte: gezogen,
  };
  for (const feld of ['kreis', 'herkunft', 'hinweis']) if (generator[feld] !== undefined) aufgabe[feld] = generator[feld];
  return aufgabe;
}

/** Generatoren eines Moduls, die in Runden dürfen (nur "freigegeben": true). */
export function freigegebeneGeneratoren(modul) {
  return (modul?.generatoren ?? []).filter((g) => g.freigegeben === true);
}

/**
 * Modul mit je einer erzeugten Aufgabe für jeden freigegebenen Generator; gesperrte bleiben
 * draußen. Ohne freigegebene Generatoren kommt das Modul unverändert zurück.
 */
export function mitGeneratoren(modul, optionen = {}) {
  const freie = freigegebeneGeneratoren(modul);
  if (freie.length === 0) return modul;
  return { ...modul, fragen: [...modul.fragen, ...freie.map((g) => erzeugeAufgabe(g, optionen))] };
}

/**
 * Neue Zahlenwerte für erzeugte Aufgaben (z. B. zu Beginn jeder Runde), andere Fragen
 * bleiben, wie sie sind.
 */
export function erneuere(fragen, modul, optionen = {}) {
  const generatoren = new Map((modul?.generatoren ?? []).map((g) => [g.id, g]));
  return fragen.map((frage) => {
    const g = frage.generator ? generatoren.get(frage.generator) : null;
    return g && g.freigegeben === true ? erzeugeAufgabe(g, optionen) : frage;
  });
}
