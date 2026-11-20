// Testfälle für die SKS-Generatoren (AP9B) mit bekannter Lösung.
// Nur amtliche Fälle (ELWIS) und selbst gerechnete Fälle; die Beispiele aus dem Buch liegen
// in privat/buch/beispiele.json und werden nie committet (siehe tests/ap9b-navigation.test.mjs).
//
// Quelle der amtlichen Fälle: ELWIS, „Sportküstenschifferschein – Aufgaben mit Lösungen für die
// Kartenaufgabe im Fach Navigation in der Übungskarte 49 (INT 1463)“, Navigationsaufgaben-SKS.pdf.
// Jeder Fall: { werte, erwartet, quelle }. Verglichen wird mit der Toleranz des Generators
// (bei Kursen und Peilungen 0, also auf das Grad genau).

export const ELWIS = 'ELWIS, Navigationsaufgaben SKS mit Lösungen';

/** Ablenkung laut Steuertafel, wie sie in den amtlichen Lösungen steht: [Spalte, Kurs, Abl]. */
export const ABL_AMTLICH = [
  ['MgK', 52, 9], ['MgK', 62, 10], ['MgK', 67, 11], ['MgK', 104, 10], ['MgK', 110, 9], ['MgK', 112, 9],
  ['MgK', 116, 8], ['MgK', 117, 8], ['MgK', 154, 5], ['MgK', 157, 4], ['MgK', 200, 7], ['MgK', 231, 3],
  ['MgK', 237, 2], ['MgK', 253, -1], ['MgK', 254, -1], ['MgK', 259, -3], ['MgK', 270, -5], ['MgK', 275, -6],
  ['MgK', 281, -7], ['MgK', 308, -11], ['MgK', 341, -9], ['MgK', 345, -8],
  ['mwK', 61, 9], ['mwK', 93, 11], ['mwK', 209, 7], ['mwK', 301, -11],
];

export const FAELLE = {
  'sks-gen-kurs-mgk-rwk': [
    { werte: { mgk: 52, mw: 1 }, erwartet: 62, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 11` },
    { werte: { mgk: 308, mw: 1 }, erwartet: 298, quelle: `${ELWIS}, Lösungsbogen 02, Aufgabe 5` },
    { werte: { mgk: 0, mw: 0 }, erwartet: 356, quelle: 'eigen: MgK 000°, Abl −4° (Tafel), Mw 0°' },
  ],
  'sks-gen-kurs-rwk-mgk': [
    { werte: { rwk: 62, mw: 1 }, erwartet: 52, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 11` },
    { werte: { rwk: 302, mw: 1 }, erwartet: 312, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 4` },
    { werte: { rwk: 210, mw: 1 }, erwartet: 202, quelle: `${ELWIS}, Lösungsbogen 03, Aufgabe 16` },
  ],
  'sks-gen-wind-kdw': [
    { werte: { mgk: 308, mw: 1, wind: 0, bwb: 5 }, erwartet: 293, quelle: `${ELWIS}, Lösungsbogen 02, Aufgabe 5 (N-Wind, |BW| 5°)` },
  ],
  'sks-gen-wind-mgk': [
    { werte: { kdw: 59, mw: 1, wind: 202.5, bwb: 3 }, erwartet: 52, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 11 (SSW-Wind, |BW| 3°)` },
  ],
  'sks-gen-peilung-mgp': [
    { werte: { mgp: 348, mgk: 67, mw: 1 }, erwartet: 0, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 12` },
    { werte: { mgp: 287, mgk: 275, mw: 1 }, erwartet: 282, quelle: `${ELWIS}, Lösungsbogen 02, Aufgabe 13` },
    { werte: { mgp: 104, mgk: 281, mw: 1 }, erwartet: 98, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 6` },
    { werte: { mgp: 0, mgk: 112, mw: 1 }, erwartet: 10, quelle: `${ELWIS}, Lösungsbogen 08, Aufgabe 6` },
    { werte: { mgp: 60, mgk: 116, mw: 1 }, erwartet: 69, quelle: `${ELWIS}, Lösungsbogen 08, Aufgabe 6` },
    { werte: { mgp: 198, mgk: 254, mw: 1 }, erwartet: 198, quelle: `${ELWIS}, Lösungsbogen 10, Aufgabe 12` },
  ],
  'sks-gen-peilung-sp': [
    { werte: { sp: 352, mgk: 62, mw: 1 }, erwartet: 65, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 12` },
    { werte: { sp: 107, mgk: 270, mw: 1 }, erwartet: 13, quelle: `${ELWIS}, Lösungsbogen 02, Aufgabe 13` },
    { werte: { sp: 332, mgk: 275, mw: 1 }, erwartet: 242, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 6` },
    { werte: { sp: 358, mgk: 259, mw: 1 }, erwartet: 255, quelle: `${ELWIS}, Lösungsbogen 10, Aufgabe 12` },
  ],
  // Gegeben sind hier rwP, MgK und Mw; die Variable abl wird so gewählt, dass rwP stimmt.
  'sks-gen-ablenkung-kontrolle': [
    { werte: { mgk: 117, mw: 1, abl: 0 }, erwartet: 0, rwp: 118, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 14` },
    { werte: { mgk: 157, mw: 1, abl: 2 }, erwartet: 2, rwp: 160, quelle: `${ELWIS}, Lösungsbogen 05, Aufgabe 17` },
  ],
  'sks-gen-missweisung': [
    { werte: { mwg: 1, mwm: 0, mwri: 1, aend: 10, aendri: -1, jahr0: 2015, jahre: 3 }, erwartet: 30, quelle: 'eigen: 60′ − 3 × 10′' },
    { werte: { mwg: 0, mwm: 20, mwri: -1, aend: 8, aendri: 1, jahr0: 2010, jahre: 5 }, erwartet: 20, quelle: 'eigen: −20′ + 5 × 8′' },
  ],
  'sks-gen-strom1-kueg': [
    { werte: { kdw: 0, fdw: 5, str: 90, stg: 5 }, erwartet: 45, quelle: 'eigen: gleich lange Vektoren im rechten Winkel' },
    { werte: { kdw: 90, fdw: 4, str: 0, stg: 3 }, erwartet: 53, quelle: 'eigen: Dreieck 3-4-5, atan(4/3) = 53,1°' },
  ],
  'sks-gen-strom1-fueg': [
    { werte: { kdw: 0, fdw: 5, str: 90, stg: 5 }, erwartet: 7.1, quelle: 'eigen: 5 × √2 = 7,07' },
    { werte: { kdw: 90, fdw: 4, str: 0, stg: 3 }, erwartet: 5, quelle: 'eigen: Dreieck 3-4-5' },
  ],
  'sks-gen-strom2-kdw': [
    { werte: { kueg: 85, fdw: 5.8, str: 50, stg: 1.2 }, erwartet: 92, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 14` },
    { werte: { kueg: 200, fdw: 6.5, str: 55, stg: 1.4 }, erwartet: 207, quelle: `${ELWIS}, Lösungsbogen 03, Aufgabe 16` },
    { werte: { kueg: 300, fdw: 4, str: 282, stg: 1.1 }, erwartet: 305, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 4` },
  ],
  'sks-gen-strom2-mgk': [
    { werte: { kueg: 85, fdw: 5.8, str: 50, stg: 1.2, wind: 225, bwb: 2, mw: 1 }, erwartet: 82, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 14 (SW-Wind)` },
    { werte: { kueg: 200, fdw: 6.5, str: 55, stg: 1.4, wind: 315, bwb: 3, mw: 1 }, erwartet: 202, quelle: `${ELWIS}, Lösungsbogen 03, Aufgabe 16 (NW-Wind)` },
    { werte: { kueg: 300, fdw: 4, str: 282, stg: 1.1, wind: 180, bwb: 3, mw: 1 }, erwartet: 312, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 4 (Südwind)` },
  ],
  'sks-gen-strom2-fueg': [
    { werte: { kueg: 85, fdw: 5.8, str: 50, stg: 1.2 }, erwartet: 6.7, quelle: `${ELWIS}, Lösungsbogen 01, Aufgabe 14` },
    { werte: { kueg: 200, fdw: 6.5, str: 55, stg: 1.4 }, erwartet: 5.3, quelle: `${ELWIS}, Lösungsbogen 03, Aufgabe 16` },
    { werte: { kueg: 300, fdw: 4, str: 282, stg: 1.1 }, erwartet: 5, quelle: `${ELWIS}, Lösungsbogen 04, Aufgabe 4` },
  ],
  'sks-gen-strom2-zeit': [
    { werte: { dist: 6.7, kueg: 85, fdw: 5.8, str: 50, stg: 1.2 }, erwartet: 60, quelle: 'eigen: 6,7 sm bei FüG 6,7 kn (ELWIS Lösungsbogen 01, Aufgabe 14)' },
  ],
  'sks-gen-strom3-str': [
    { werte: { kdw: 0, fdw: 4, dauer: 2, str: 90, stg: 1.5 }, erwartet: 90, quelle: 'eigen: Ok 8 sm Nord, Ob 3 sm östlich davon' },
  ],
  'sks-gen-strom3-stg': [
    { werte: { kdw: 0, fdw: 4, dauer: 2, str: 90, stg: 1.5 }, erwartet: 1.5, quelle: 'eigen: Ok 8 sm Nord, Ob 3 sm östlich davon' },
  ],
  'sks-gen-strom-versetzung': [
    { werte: { bv: 3, minuten: 120 }, erwartet: 1.5, quelle: 'eigen' },
  ],
  'sks-gen-distanz': [
    { werte: { fahrt: 6, minuten: 45 }, erwartet: 4.5, quelle: 'eigen' },
  ],
};

/** IDs der Generatoren, für die es amtliche oder eigene Fälle mit bekannter Lösung gibt. */
export const GEPRUEFT = new Set(Object.keys(FAELLE));
