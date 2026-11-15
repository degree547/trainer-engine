// Tests für AP9A: Zahleneingabe mit Toleranz und Einheit (F-09, M3, M8) und das gesperrte
// Gerüst für Generatoren (F-28, M9). Die Rechenwege für die Navigation folgen in AP9B.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leseZahl, abweichung, bewerteZahl, TYPEN } from '../src/engine/m3-fragetypen.js';
import {
  leseFormel, rechne, namenIn, FormelFehler, runde, wertebereich, ziehe, fuelle, platzhalterIn,
  erzeugeAufgabe, freigegebeneGeneratoren, mitGeneratoren, erneuere,
} from '../src/engine/m9-generatoren.js';
import { pruefeModul, lesePruefe } from '../src/engine/m8-inhaltsformat.js';
import { leseModul } from '../src/engine/m1-kern.js';
import { bildeRunde } from '../src/engine/m2-lernlogik.js';

const zahl = (extra = {}) => ({
  id: 't-1', thema: 't-a', typ: 'zahl', frage: 'Wie viel?', loesung: 30, toleranz: 0.5, einheit: 'sm',
  erklaerung: '', quelle: 'eigen', ...extra,
});
const generator = (extra = {}) => ({
  id: 't-gen-strecke', thema: 't-a', freigegeben: false,
  frage: 'Fahrt {fahrt} kn, Zeit {zeit} h. Strecke?',
  variablen: { fahrt: { von: 4, bis: 12 }, zeit: { von: 0.5, bis: 3, schritt: 0.5 } },
  loesung: 'fahrt * zeit', nachkommastellen: 1, toleranz: 0.1, einheit: 'sm',
  erklaerung: '{fahrt} kn × {zeit} h = {loesung} sm', quelle: 'eigen', ...extra,
});
const modul = (fragen = [zahl()], extra = {}) => ({
  format: 1,
  meta: { id: 't', titel: 'Test', sprache: 'de', version: '1', stand: '2026-11-15' },
  themen: [{ id: 't-a', titel: 'A' }],
  fragen,
  ...extra,
});
const codes = (fehler) => fehler.map((f) => f.code);
function folge(...zahlen) {
  let i = 0;
  return () => zahlen[i++ % zahlen.length];
}

// --- Zahleneingabe (F-09) ---------------------------------------------------

test('F-09: „zahl“ ist ein Fragetyp', () => {
  assert.ok(TYPEN.includes('zahl'));
});

test('F-09: Zahl lesen mit Komma oder Punkt, Vorzeichen und angehängter Einheit', () => {
  assert.equal(leseZahl('12,5'), 12.5);
  assert.equal(leseZahl('12.5'), 12.5);
  assert.equal(leseZahl('  7 '), 7);
  assert.equal(leseZahl('-3'), -3);
  assert.equal(leseZahl('−3'), -3);
  assert.equal(leseZahl('+4'), 4);
  assert.equal(leseZahl(',5'), 0.5);
  assert.equal(leseZahl('012'), 12);
  assert.equal(leseZahl('12,5 sm', 'sm'), 12.5);
  assert.equal(leseZahl('12,5SM', 'sm'), 12.5);
  assert.equal(leseZahl('045°', '°'), 45);
  assert.equal(leseZahl('045°'), 45);
  for (const falsch of ['', ' ', 'abc', '1.234,5', '1,2,3', '12 kn', '--3', '1e3', null, undefined, 12]) {
    assert.equal(leseZahl(falsch, 'sm'), null, `${falsch} ist keine gültige Eingabe`);
  }
});

test('F-09: richtig innerhalb der Toleranz, die Grenze zählt mit', () => {
  const frage = zahl({ loesung: 30, toleranz: 0.5 });
  assert.equal(bewerteZahl(frage, '30').richtig, true);
  assert.equal(bewerteZahl(frage, '29,5').richtig, true);
  assert.equal(bewerteZahl(frage, '30.5').richtig, true);
  assert.equal(bewerteZahl(frage, '30,51').richtig, false);
  assert.equal(bewerteZahl(frage, '29,4').richtig, false);
  assert.deepEqual(bewerteZahl(frage, 'x'), { richtig: false, zahl: null, abweichung: null });
  assert.deepEqual(bewerteZahl(frage, ''), { richtig: false, zahl: null, abweichung: null });
  assert.ok(Math.abs(bewerteZahl(frage, '31').abweichung - 1) < 1e-12);
});

test('F-09: Toleranz 0 verlangt die genaue Zahl, Rundungsfehler zählen nicht', () => {
  const frage = zahl({ loesung: 0.3, toleranz: 0 });
  assert.equal(bewerteZahl(frage, '0,3').richtig, true);
  assert.equal(bewerteZahl({ ...frage, loesung: 0.1 + 0.2 }, '0.3').richtig, true);
  assert.equal(bewerteZahl(frage, '0,31').richtig, false);
});

test('F-09: mit „kreis“ wird die Abweichung im Kreis gemessen', () => {
  const frage = zahl({ loesung: 1, toleranz: 2, kreis: 360, einheit: '°' });
  assert.equal(abweichung(frage, 359), 2);
  assert.equal(abweichung(frage, 361), 0);
  assert.equal(abweichung(frage, 181), 180);
  assert.equal(bewerteZahl(frage, '359').richtig, true);
  assert.equal(bewerteZahl(frage, '358').richtig, false);
  // Ohne "kreis" liegen 359 und 1 weit auseinander.
  assert.equal(bewerteZahl({ ...frage, kreis: undefined }, '359').richtig, false);
});

// --- Inhaltsformat für Zahlenfragen (M8) ------------------------------------

test('M8: gültige Zahlenfrage ohne Fehler, Einheit darf leer sein', () => {
  assert.deepEqual(pruefeModul(modul()), []);
  assert.deepEqual(pruefeModul(modul([zahl({ einheit: '', kreis: 360, herkunft: 'eigen' })])), []);
});

test('M8: Fehler bei Zahlenfragen werden mit Feld gemeldet', () => {
  const fall = (extra, code, feld) => {
    const fehler = pruefeModul(modul([zahl(extra)]));
    assert.ok(codes(fehler).includes(code), `${JSON.stringify(extra)} → ${codes(fehler)}`);
    if (feld) assert.equal(fehler.find((f) => f.code === code).werte.feld, feld);
  };
  fall({ loesung: undefined }, 'inhalt.feldFehlt', 'loesung');
  fall({ loesung: '30' }, 'inhalt.keineZahl', 'loesung');
  fall({ toleranz: undefined }, 'inhalt.feldFehlt', 'toleranz');
  fall({ toleranz: -1 }, 'inhalt.zahlAb', 'toleranz');
  fall({ einheit: undefined }, 'inhalt.feldFehlt', 'einheit');
  fall({ einheit: 5 }, 'inhalt.keinTextLeerErlaubt', 'einheit');
  fall({ kreis: 0 }, 'inhalt.zahlGroesser', 'kreis');
  fall({ herkunft: 'internet' }, 'inhalt.wertNichtErlaubt', 'herkunft');
});

test('M8: Fehler bei Zahlenfragen nennen die Zeile', () => {
  const text = JSON.stringify(modul([zahl({ toleranz: -1 })]), null, 2);
  const { fehler } = lesePruefe(text);
  const f = fehler.find((x) => x.code === 'inhalt.zahlAb');
  assert.equal(text.split('\n')[f.zeile - 1].trim(), '"toleranz": -1,');
});

// --- Formelrechner (M9) -----------------------------------------------------

test('M9: Rechner beachtet Punkt vor Strich, Klammern, Vorzeichen und Potenz', () => {
  assert.equal(rechne('1 + 2 * 3'), 7);
  assert.equal(rechne('(1 + 2) * 3'), 9);
  assert.equal(rechne('10 - 4 - 3'), 3);
  assert.equal(rechne('12 / 4 / 3'), 1);
  assert.equal(rechne('-2 ^ 2'), -4);
  assert.equal(rechne('2 ^ 3 ^ 2'), 512);
  assert.equal(rechne('-(3 - 5)'), 2);
  assert.equal(rechne('a * b + c', { a: 2, b: 3, c: 4 }), 10);
  assert.equal(rechne('.5 * 4'), 2);
});

test('M9: Winkelfunktionen rechnen in Grad', () => {
  const nahe = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  nahe(rechne('sin(30)'), 0.5);
  nahe(rechne('cos(60)'), 0.5);
  nahe(rechne('tan(45)'), 1);
  nahe(rechne('asin(0.5)'), 30);
  nahe(rechne('acos(0.5)'), 60);
  nahe(rechne('atan(1)'), 45);
  nahe(rechne('atan2(1, -1)'), 135);
  nahe(rechne('cos(180) * pi'), -Math.PI);
});

test('M9: weitere Funktionen', () => {
  assert.equal(rechne('mod(-10, 360)'), 350);
  assert.equal(rechne('mod(370, 360)'), 10);
  assert.equal(rechne('round(2.345, 2)'), 2.35);
  assert.equal(rechne('round(1.005, 2)'), 1.01);
  assert.equal(rechne('round(2.5)'), 3);
  assert.equal(rechne('sqrt(16) + abs(-2)'), 6);
  assert.equal(rechne('floor(2.7) + ceil(2.1)'), 5);
  assert.equal(rechne('min(3, 1, 2) + max(3, 9)'), 10);
});

test('M9: fehlerhafte Formeln werden abgelehnt, kein fremder Code', () => {
  const fall = (formel, code) => assert.throws(() => leseFormel(formel), (e) => e instanceof FormelFehler && e.code === code, formel);
  fall('', 'formel.leer');
  fall('1 +', 'formel.ende');
  fall('(1 + 2', 'formel.ende');
  fall('1 + 2)', 'formel.unerwartet');
  fall('2 3', 'formel.unerwartet');
  fall('alert(1)', 'formel.funktionUnbekannt');
  fall('sin(1, 2)', 'formel.argumente');
  fall('a; b', 'formel.zeichen');
  fall('"x"', 'formel.zeichen');
  fall('a.b', 'formel.zeichen');
  assert.throws(() => rechne('x + 1', {}), (e) => e.code === 'formel.variableUnbekannt');
  assert.throws(() => rechne('1 / 0'), (e) => e.code === 'formel.keinErgebnis');
  assert.throws(() => rechne('sqrt(-1)'), (e) => e.code === 'formel.keinErgebnis');
  // Namen aus der Umgebung von JavaScript sind keine Variablen.
  assert.throws(() => rechne('constructor'), (e) => e.code === 'formel.variableUnbekannt');
  assert.throws(() => rechne('toString'), (e) => e.code === 'formel.variableUnbekannt');
  fall('constructor(1)', 'formel.funktionUnbekannt');
  fall('__proto__(1)', 'formel.funktionUnbekannt');
  assert.equal(rechne('constructor + 1', { constructor: 2 }), 3);
  assert.deepEqual([...namenIn(leseFormel('a * sin(b) + pi'))].sort(), ['a', 'b']);
});

test('M9: runden', () => {
  assert.equal(runde(2.25, 1), 2.3);
  assert.equal(runde(-2.25, 1), -2.3);
  assert.equal(runde(29.99, 0), 30);
  assert.equal(runde(-0.4), 0);
  assert.ok(Object.is(runde(-0.4), 0), 'keine negative Null');
  assert.equal(runde(1e-7, 2), 0);
});

// --- Aufgaben erzeugen (M9) -------------------------------------------------

test('M9: Wertebereich und Ziehen bleiben in den Grenzen und treffen beide Enden', () => {
  const { anzahl, wert } = wertebereich({ von: 0.5, bis: 3, schritt: 0.5 });
  assert.equal(anzahl, 6);
  assert.deepEqual(Array.from({ length: anzahl }, (_, k) => wert(k)), [0.5, 1, 1.5, 2, 2.5, 3]);
  assert.equal(wertebereich({ von: 0.1, bis: 0.3, schritt: 0.1 }).anzahl, 3);
  assert.equal(wertebereich({ von: 5, bis: 5 }).anzahl, 1);
  const v = { a: { von: 4, bis: 12 } };
  assert.deepEqual(ziehe(v, () => 0), { a: 4 });
  assert.deepEqual(ziehe(v, () => 0.999999), { a: 12 });
  for (let i = 0; i < 200; i += 1) {
    const { a } = ziehe(v);
    assert.ok(Number.isInteger(a) && a >= 4 && a <= 12);
  }
});

test('M9: Platzhalter einsetzen und finden', () => {
  assert.equal(fuelle('{a} und {b}, {c}', { a: 1, b: 2.5 }, (n) => String(n).replace('.', ',')), '1 und 2,5, {c}');
  assert.deepEqual(platzhalterIn('x {a} y {b_2}'), ['a', 'b_2']);
});

test('F-28: einfache Beispielrechnung mit bekannter Lösung (Strecke = Fahrt × Zeit)', () => {
  // 6 kn × 2,5 h = 15 sm; 12 kn × 0,5 h = 6 sm.
  const a = erzeugeAufgabe(generator(), { werte: { fahrt: 6, zeit: 2.5 } });
  assert.equal(a.loesung, 15);
  assert.equal(erzeugeAufgabe(generator(), { werte: { fahrt: 12, zeit: 0.5 } }).loesung, 6);
  assert.equal(a.typ, 'zahl');
  assert.equal(a.id, 't-gen-strecke');
  assert.equal(a.generator, 't-gen-strecke');
  assert.equal(a.frage, 'Fahrt 6 kn, Zeit 2.5 h. Strecke?');
  assert.equal(a.erklaerung, '6 kn × 2.5 h = 15 sm');
  assert.equal(a.einheit, 'sm');
  assert.equal(a.toleranz, 0.1);
  assert.deepEqual(a.werte, { fahrt: 6, zeit: 2.5 });
  assert.equal(bewerteZahl(a, '15,0').richtig, true);
  assert.equal(bewerteZahl(a, '15,2').richtig, false);
  // Mit Zahltext der Sprache, z. B. Komma im Deutschen.
  const de = erzeugeAufgabe(generator(), { werte: { fahrt: 6, zeit: 2.5 }, zahlText: (n) => String(n).replace('.', ',') });
  assert.equal(de.frage, 'Fahrt 6 kn, Zeit 2,5 h. Strecke?');
});

test('F-28: Zufallsaufgaben rechnen ihre Lösung aus den gezogenen Werten', () => {
  for (let i = 0; i < 100; i += 1) {
    const a = erzeugeAufgabe(generator());
    assert.equal(a.loesung, runde(a.werte.fahrt * a.werte.zeit, 1));
  }
  const fest = erzeugeAufgabe(generator(), { zufall: folge(0, 0.99) });
  assert.deepEqual(fest.werte, { fahrt: 4, zeit: 3 });
  assert.equal(fest.loesung, 12);
});

test('F-28: Lösung mit „kreis“ liegt immer zwischen 0 und dem Kreis', () => {
  const g = generator({
    variablen: { a: { von: 350, bis: 359 }, b: { von: 5, bis: 20 } },
    frage: '{a} + {b}', erklaerung: '', loesung: 'a + b', kreis: 360, einheit: '°', nachkommastellen: undefined,
  });
  assert.equal(erzeugeAufgabe(g, { werte: { a: 355, b: 10 } }).loesung, 5);
  assert.equal(erzeugeAufgabe(g, { werte: { a: 350, b: 10 } }).loesung, 0);
});

// --- Sperre -----------------------------------------------------------------

test('F-28: gesperrte Generatoren kommen nicht ins Modul und nicht in Runden', () => {
  const m = modul([zahl()], { generatoren: [generator()] });
  assert.deepEqual(freigegebeneGeneratoren(m), []);
  assert.equal(mitGeneratoren(m), m);
  const runde1 = bildeRunde(mitGeneratoren(m), { version: 2, karten: {} }, '2026-11-15');
  assert.ok(runde1.every((f) => !f.generator));
  // Eine Aufgabe eines gesperrten Generators wird auch nicht erneuert.
  const alt = erzeugeAufgabe(generator(), { werte: { fahrt: 6, zeit: 2.5 } });
  assert.equal(erneuere([alt], m)[0], alt);
});

test('F-28: ein freigegebener Generator liefert je Runde eine Aufgabe mit neuen Werten', () => {
  const m = modul([zahl()], { generatoren: [generator({ freigegeben: true }), generator({ id: 't-gen-zu' })] });
  const mit = mitGeneratoren(m, { zufall: () => 0 });
  assert.equal(mit.fragen.length, 2);
  assert.equal(mit.fragen[1].id, 't-gen-strecke');
  assert.equal(m.fragen.length, 1, 'das Original bleibt unverändert');
  const neu = erneuere(mit.fragen, m, { zufall: () => 0.99 });
  assert.equal(neu[0], mit.fragen[0]);
  assert.deepEqual(neu[1].werte, { fahrt: 12, zeit: 3 });
  assert.equal(neu[1].loesung, 36);
});

// --- Inhaltsformat für Generatoren (M8) -------------------------------------

test('M8: gültiger Generator ohne Fehler', () => {
  assert.deepEqual(pruefeModul(modul([zahl()], { generatoren: [generator()] })), []);
  assert.deepEqual(pruefeModul(modul([zahl()], { generatoren: [] })), []);
});

test('M8: Fehler bei Generatoren werden erkannt', () => {
  const fall = (extra, code, werte = {}) => {
    const fehler = pruefeModul(modul([zahl()], { generatoren: [generator(extra)] }));
    const f = fehler.find((x) => x.code === code);
    assert.ok(f, `${JSON.stringify(extra)} → ${codes(fehler)}`);
    assert.equal(f.ort.art, 'generator');
    for (const [k, v] of Object.entries(werte)) assert.equal(f.werte[k], v);
  };
  fall({ freigegeben: undefined }, 'inhalt.feldFehlt', { feld: 'freigegeben' });
  fall({ freigegeben: 'ja' }, 'inhalt.keinWahrheitswert', { feld: 'freigegeben' });
  fall({ id: 't-1' }, 'inhalt.generatorIdBelegt', { wert: 't-1' });
  fall({ id: 'x-gen' }, 'inhalt.idPraefix');
  fall({ id: 'Gen 1' }, 'inhalt.idUngueltig');
  fall({ thema: 't-z' }, 'inhalt.themaUnbekannt');
  fall({ frage: '' }, 'inhalt.keinText', { feld: 'frage' });
  fall({ quelle: undefined }, 'inhalt.feldFehlt', { feld: 'quelle' });
  fall({ erklaerung: undefined }, 'inhalt.feldFehlt', { feld: 'erklaerung' });
  fall({ toleranz: -0.1 }, 'inhalt.zahlAb', { feld: 'toleranz' });
  fall({ einheit: undefined }, 'inhalt.feldFehlt', { feld: 'einheit' });
  fall({ nachkommastellen: 1.5 }, 'inhalt.ganzeZahl', { feld: 'nachkommastellen' });
  fall({ variablen: {} }, 'inhalt.generatorKeineVariablen');
  fall({ variablen: { sin: { von: 1, bis: 2 } }, loesung: '1' }, 'inhalt.variablenName', { wert: 'sin' });
  fall({ variablen: { loesung: { von: 1, bis: 2 } }, loesung: '1' }, 'inhalt.variablenName');
  fall({ variablen: { a: { von: 1 } }, loesung: 'a' }, 'inhalt.variablenBereich', { name: 'a' });
  fall({ variablen: { a: { von: 3, bis: 1 } }, loesung: 'a' }, 'inhalt.variablenVonBis', { name: 'a' });
  fall({ variablen: { a: { von: 1, bis: 3, schritt: 0 } }, loesung: 'a' }, 'inhalt.zahlGroesser', { feld: 'schritt' });
  fall({ frage: 'Fahrt {tempo}?' }, 'inhalt.platzhalterUnbekannt', { feld: 'frage', name: 'tempo' });
  fall({ erklaerung: '{ergebnis}' }, 'inhalt.platzhalterUnbekannt', { feld: 'erklaerung', name: 'ergebnis' });
  fall({ loesung: 'fahrt *' }, 'inhalt.formelFehler');
  fall({ loesung: 'eval(fahrt)' }, 'inhalt.formelFehler');
  fall({ loesung: 'fahrt * dauer' }, 'inhalt.formelVariable', { name: 'dauer' });
  fall({ loesung: 'fahrt / (zeit - 0.5)' }, 'inhalt.formelKeinErgebnis', { ende: 'von' });
  fall({ loesung: undefined }, 'inhalt.feldFehlt', { feld: 'loesung' });
});

test('M8: „generatoren“ muss eine Liste sein, zwei Generatoren mit derselben ID fallen auf', () => {
  assert.ok(codes(pruefeModul(modul([zahl()], { generatoren: {} }))).includes('inhalt.keineListe'));
  assert.ok(codes(pruefeModul(modul([zahl()], { generatoren: [generator(), generator()] }))).includes('inhalt.generatorIdBelegt'));
});

// --- mitgelieferte Module ---------------------------------------------------

test('Beispielmodul: Zahlenfrage gültig, Generator gültig, aber gesperrt', async () => {
  const m = leseModul(await readFile(new URL('../content/beispiel/beispiel.json', import.meta.url), 'utf8'));
  const frage = m.fragen.find((f) => f.typ === 'zahl');
  assert.ok(frage);
  assert.equal(bewerteZahl(frage, '60').richtig, true);
  assert.equal(bewerteZahl(frage, '61').richtig, false);
  assert.equal(m.generatoren.length, 1);
  assert.equal(m.generatoren[0].freigegeben, false);
  assert.deepEqual(freigegebeneGeneratoren(m), []);
  // Die Beispielrechnung selbst: 12 km/h × 2,5 h = 30 km.
  assert.equal(erzeugeAufgabe(m.generatoren[0], { werte: { tempo: 12, zeit: 2.5 } }).loesung, 30);
});

test('SKS-Modul: kein Generator ist freigegeben (Freigabe erst in AP9B nach Tests gegen das Buch)', async () => {
  const m = JSON.parse(await readFile(new URL('../content/sks/sks.json', import.meta.url), 'utf8'));
  assert.deepEqual(freigegebeneGeneratoren(m), []);
});
