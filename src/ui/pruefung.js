// Bildschirm Prüfungssimulation (F-20), Ablauf wie in der Prüfung:
// 1. Übersicht: Fragenzahl, Zeit, Bestehensgrenze und Verteilung aus dem Modul.
// 2. Bearbeiten: alle Fragen ohne Auflösung, mit Uhr; vor und zurück blättern, Abgeben.
//    Läuft die Zeit ab, wird automatisch abgegeben.
// 3. Bewerten: Freitext-Antworten selbst gegen Musterantwort und Kernpunkte bewerten
//    (ohne Zeitlimit). Multiple Choice und Zahlen (F-09) bewertet die App, leere Antworten
//    zählen als falsch.
// 4. Auswertung: bestanden oder nicht, Punkte je Thema, falsche Fragen mit Lösung.
// Die Simulation ändert keine Leitner-Fächer und gibt keine XP; das regelt app.js.

import { t } from './i18n.js';
import { el } from './dom.js';
import {
  optionsReihenfolge, buchstabe, bewerteMc, bewerteZahl, istLeer, freitextVorschlag, herkunftVon,
  istMehrfach, kernpunkteGeprueft,
} from '../engine/m3-fragetypen.js';
import { zahlfeld, zahlUngueltig, zahlLoesung, mitEinheit } from './zahl.js';
import { mcLoesung, mehrfachHinweis, optionstexte } from './mc.js';
import { pruefstatusZeile } from './pruefstatus.js';
import { endeUm, restzeit, zeittext, werteAus } from '../engine/m6-pruefung.js';

// Ab dieser Restzeit wird die Uhr hervorgehoben.
const KNAPP_MS = 5 * 60_000;

/**
 * @param {HTMLElement} ziel
 * @param {{
 *   modul: object,
 *   regeln: object,                       // aus pruefungsregeln (M6)
 *   bildeBogen: () => object[],           // aus bildePruefbogen (M6)
 *   onZurueck: () => void,                // zur Startseite
 *   onFehlerUeben: (fragen: object[]) => void,
 *   holePruefstatus?: () => object | null, // Prüfstatus der Kernpunkte (F-39) aus M7
 *   onPruefstatus?: (frage: object, geprueft: boolean) => void,
 *   jetzt?: () => number,                 // austauschbar für Tests
 * }} sim
 */
export function zeigePruefung(ziel, sim) {
  const jetzt = sim.jetzt ?? (() => Date.now());
  const themenTitel = new Map(sim.modul.themen.map((thema) => [thema.id, thema.titel]));

  let bogen = [];
  let nr = 0;
  let ende = 0;
  let start = 0;
  let uhr = null;               // setInterval der Uhr
  let abgegebenUm = null;
  let zeitAbgelaufen = false;
  const antworten = new Map();  // Frage-ID → MC: Optionsnummer (Mehrfachauswahl: Set), Freitext und Zahl: Text
  const reihenfolgen = new Map(); // Frage-ID → Anzeigereihenfolge der MC-Optionen
  const bewertungen = new Map(); // Frage-ID → richtig
  let zuBewerten = [];          // Freitext-Fragen mit Antwort
  let bewertNr = 0;
  let abgehakt = new Set();

  // --- 1. Übersicht ------------------------------------------------------

  function zeichneUebersicht() {
    const r = sim.regeln;
    const verteilung = el('ul', { class: 'themen' });
    for (const v of r.verteilung) {
      verteilung.append(el('li', {}, el('span', {}, v.titel), el('span', { class: 'zahl' }, String(v.anzahl))));
    }
    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t('pruefung.titel')),
      el('h2', {}, t('pruefung.ueberschrift')),
      el('dl', { class: 'kennzahlen' },
        el('dt', {}, t('pruefung.fragen')), el('dd', {}, String(r.fragen)),
        el('dt', {}, t('pruefung.zeit')), el('dd', {}, t('pruefung.minuten', { minuten: r.minuten })),
        el('dt', {}, t('pruefung.bestehen')),
        el('dd', {}, t('pruefung.bestehenWert', { bestehenAb: r.bestehenAb, maxPunkte: r.maxPunkte })),
      ),
      verteilung,
      el('p', { class: 'hinweis' }, t('pruefung.ablauf', { punkte: r.punkteJeFrage })),
      el('p', { class: 'hinweis' }, t('pruefung.ohneWirkung')),
      r.hinweis ? el('p', { class: 'hinweis warnung' }, r.hinweis) : null,
    );
    const aktionen = el('div', { class: 'aktionen' },
      el('button', { type: 'button', class: 'knopf', onclick: starte }, t('pruefung.starten')),
      el('button', { type: 'button', class: 'knopf zweitrangig', onclick: sim.onZurueck }, t('statistik.zurueck')),
    );
    ziel.replaceChildren(el('div', { class: 'inhalt' }, karte), aktionen);
    window.scrollTo(0, 0);
  }

  function starte() {
    bogen = sim.bildeBogen();
    for (const frage of bogen) if (frage.typ === 'mc') reihenfolgen.set(frage.id, optionsReihenfolge(frage));
    start = jetzt();
    ende = endeUm(start, sim.regeln.minuten);
    nr = 0;
    uhr = setInterval(tick, 1000);
    zeichneFrage();
  }

  // --- 2. Bearbeiten -----------------------------------------------------

  function tick() {
    // Bildschirm verlassen (z. B. Zurück im Browser): Uhr anhalten.
    if (!ziel.querySelector('#uhr') && !ziel.querySelector('#abgabe')) { halteUhrAn(); return; }
    const rest = restzeit(ende, jetzt());
    aktualisiereUhr(rest);
    if (rest === 0) { zeitAbgelaufen = true; gibAb(); }
  }

  function halteUhrAn() {
    if (uhr !== null) clearInterval(uhr);
    uhr = null;
  }

  function aktualisiereUhr(rest) {
    const anzeige = ziel.querySelector('#uhr');
    if (!anzeige) return;
    anzeige.textContent = zeittext(rest);
    anzeige.classList.toggle('knapp', rest <= KNAPP_MS);
  }

  function uhranzeige() {
    const rest = restzeit(ende, jetzt());
    return el('p', {
      id: 'uhr', class: `uhr${rest <= KNAPP_MS ? ' knapp' : ''}`, role: 'timer', 'aria-label': t('pruefung.restzeit'),
    }, zeittext(rest));
  }

  function beantwortet(frage) {
    const a = antworten.get(frage.id);
    if (frage.typ === 'mc') return istMehrfach(frage) ? (a?.size ?? 0) > 0 : a !== undefined;
    return !istLeer(a ?? '');
  }

  function merkeEingabe() {
    const feld = ziel.querySelector('#antwort');
    if (feld) antworten.set(bogen[nr].id, feld.value);
  }

  function gehe(neu) {
    merkeEingabe();
    nr = neu;
    zeichneFrage();
  }

  function zeichneFrage() {
    const frage = bogen[nr];
    const kopf = el('div', { class: 'rundenkopf' },
      el('p', { class: 'etikett' }, t('pruefung.titel'), ' · ', t('runde.fortschritt', { nr: nr + 1, gesamt: bogen.length })),
      uhranzeige(),
    );
    const anzahl = bogen.filter(beantwortet).length;
    const balken = el('div', {
      class: 'balken', role: 'progressbar', 'aria-label': t('pruefung.beantwortet', { anzahl, gesamt: bogen.length }),
      'aria-valuemin': '0', 'aria-valuemax': String(bogen.length), 'aria-valuenow': String(anzahl),
    }, el('span', { style: `width: ${(anzahl / bogen.length) * 100}%` }));

    const karte = el('section', { class: 'karte frage' },
      el('p', { class: 'etikett' }, themenTitel.get(frage.thema) ?? frage.thema),
      el('h2', { class: 'fragetext', id: 'fragetext' }, frage.frage),
      frage.hinweis ? el('p', { class: 'hinweis' }, frage.hinweis) : null,
      frage.typ === 'mc' ? mehrfachHinweis(frage) : null,
      frage.typ === 'mc' ? mcOptionen(frage) : null,
      frage.typ === 'freitext' ? eingabefeld(frage) : null,
      frage.typ === 'zahl' ? zahleingabe(frage) : null,
    );

    const letzte = nr === bogen.length - 1;
    const aktionen = el('div', { class: 'aktionen' },
      el('div', { class: 'aktionen nebeneinander' },
        el('button', {
          type: 'button', class: 'knopf zweitrangig', disabled: nr === 0, onclick: () => gehe(nr - 1),
        }, t('pruefung.zurueck')),
        el('button', {
          type: 'button', class: 'knopf', id: 'weiter', onclick: () => (letzte ? bestaetigeAbgabe() : gehe(nr + 1)),
        }, t(letzte ? 'pruefung.abgeben' : 'runde.weiter')),
      ),
      letzte ? null : el('button', { type: 'button', class: 'textknopf mitte', onclick: bestaetigeAbgabe }, t('pruefung.abgeben')),
    );

    ziel.replaceChildren(el('div', { class: 'inhalt' }, kopf, balken, karte), aktionen);
    window.scrollTo(0, 0);
  }

  function mcOptionen(frage) {
    const mehrfach = istMehrfach(frage);
    const gewaehlt = antworten.get(frage.id);
    const istGewaehlt = (i) => (mehrfach ? gewaehlt?.has(i) ?? false : i === gewaehlt);
    const liste = el('ul', { class: 'optionen', role: 'list', 'aria-labelledby': 'fragetext' });
    reihenfolgen.get(frage.id).forEach((i, position) => {
      liste.append(el('li', {},
        el('button', {
          type: 'button', class: `option${istGewaehlt(i) ? ' gewaehlt' : ''}`, 'aria-pressed': String(istGewaehlt(i)),
          onclick: () => {
            if (!mehrfach) { antworten.set(frage.id, i); zeichneFrage(); return; }
            // Mehrfachauswahl (F-40): umschalten; neue Menge, damit nichts geteilt wird.
            const neu = new Set(antworten.get(frage.id) ?? []);
            if (neu.has(i)) neu.delete(i); else neu.add(i);
            antworten.set(frage.id, neu);
            zeichneFrage();
          },
        },
        el('span', { class: 'buchstabe', 'aria-hidden': 'true' }, buchstabe(position)),
        el('span', { class: 'optionstext' }, frage.optionen[i]))));
    });
    return liste;
  }

  function eingabefeld(frage) {
    const feld = el('textarea', {
      id: 'antwort', class: 'antwortfeld', rows: '5',
      'aria-label': t('freitext.eingabeLabel'), placeholder: t('freitext.platzhalter'),
      autocomplete: 'off', spellcheck: 'true', enterkeyhint: 'next',
      onkeydown: (e) => {
        // Wie in der Runde (F-33): Enter geht weiter, Shift+Enter bricht die Zeile um.
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (nr === bogen.length - 1) { merkeEingabe(); bestaetigeAbgabe(); } else gehe(nr + 1);
      },
      oninput: (e) => antworten.set(frage.id, e.target.value),
    });
    feld.value = antworten.get(frage.id) ?? '';
    return el('div', { class: 'eingabe' },
      el('label', { for: 'antwort', class: 'etikett' }, t('freitext.eingabeLabel')),
      feld);
  }

  function zahleingabe(frage) {
    const weiter = () => {
      if (zahlUngueltig(frage, antworten.get(frage.id) ?? '')) { zeichneFrage(); ziel.querySelector('#antwort')?.focus(); return; }
      if (nr === bogen.length - 1) bestaetigeAbgabe(); else gehe(nr + 1);
    };
    return zahlfeld({
      frage, wert: antworten.get(frage.id) ?? '', enterkeyhint: 'next',
      // Hinweis auf eine ungültige Zahl erst nach Enter oder beim Zurückkommen, nicht beim Tippen.
      ungueltig: zahlUngueltig(frage, antworten.get(frage.id) ?? ''),
      onInput: (text) => antworten.set(frage.id, text),
      onEnter: (text) => { antworten.set(frage.id, text); weiter(); },
    });
  }

  function bestaetigeAbgabe() {
    merkeEingabe();
    const offen = bogen.length - bogen.filter(beantwortet).length;
    const karte = el('section', { class: 'karte', id: 'abgabe' },
      el('p', { class: 'etikett' }, t('pruefung.titel')),
      el('div', { class: 'rundenkopf' }, el('h2', {}, t('pruefung.abgebenFrage')), uhranzeige()),
      el('p', {}, offen > 0 ? t('pruefung.offen', { anzahl: offen, gesamt: bogen.length }) : t('pruefung.alleBeantwortet')),
    );
    const aktionen = el('div', { class: 'aktionen' },
      el('button', { type: 'button', class: 'knopf', onclick: gibAb }, t('pruefung.abgeben')),
      el('button', { type: 'button', class: 'knopf zweitrangig', onclick: zeichneFrage }, t('pruefung.weiterBearbeiten')),
      el('button', {
        type: 'button', class: 'textknopf mitte', onclick: () => { halteUhrAn(); sim.onZurueck(); },
      }, t('pruefung.abbrechen')),
    );
    ziel.replaceChildren(el('div', { class: 'inhalt' }, karte), aktionen);
    window.scrollTo(0, 0);
  }

  function gibAb() {
    if (abgegebenUm !== null) return;
    merkeEingabe();
    halteUhrAn();
    abgegebenUm = Math.min(jetzt(), ende);
    // MC und leere Freitext-Antworten sind sofort bewertet, die übrigen bewertet der Lernende.
    for (const frage of bogen) {
      const a = antworten.get(frage.id);
      if (frage.typ === 'mc') bewertungen.set(frage.id, a !== undefined && bewerteMc(frage, a));
      else if (frage.typ === 'zahl') bewertungen.set(frage.id, bewerteZahl(frage, a ?? '').richtig);
      else if (istLeer(a ?? '')) bewertungen.set(frage.id, false);
    }
    zuBewerten = bogen.filter((frage) => frage.typ === 'freitext' && !bewertungen.has(frage.id));
    bewertNr = 0;
    if (zuBewerten.length > 0) zeichneBewertung();
    else zeichneAuswertung();
  }

  // --- 3. Bewerten -------------------------------------------------------

  function zeichneBewertung() {
    const frage = zuBewerten[bewertNr];
    abgehakt = new Set();
    const kopf = el('p', { class: 'etikett' },
      t('pruefung.bewerten'), ' · ', t('runde.fortschritt', { nr: bewertNr + 1, gesamt: zuBewerten.length }));
    const inhalt = [kopf];
    if (bewertNr === 0) {
      inhalt.push(el('p', { class: `hinweis oben${zeitAbgelaufen ? ' warnung' : ''}`, role: 'status' },
        zeitAbgelaufen ? t('pruefung.zeitAbgelaufen') : t('pruefung.abgegeben'), ' ', t('pruefung.bewertenAnleitung')));
    }
    inhalt.push(
      el('section', { class: 'karte frage' },
        el('p', { class: 'etikett' }, themenTitel.get(frage.thema) ?? frage.thema),
        el('h2', { class: 'fragetext' }, frage.frage)),
      el('section', { class: 'karte eigene' },
        el('p', { class: 'etikett' }, t('freitext.deineAntwort')),
        el('p', { class: 'antworttext' }, antworten.get(frage.id))),
      el('section', { class: 'karte aufloesung' },
        el('p', { class: 'etikett' }, t('runde.musterantwort')),
        el('p', { class: 'antworttext' }, frage.musterantwort),
        ...herkunftUndQuelle(frage)),
      checkliste(frage),
    );
    const aktionen = el('div', { class: 'aktionen' },
      el('p', { class: 'vorschlag', id: 'vorschlag', role: 'status' }, vorschlagstext(frage)),
      bewertungsknoepfe(frage));
    ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
    window.scrollTo(0, 0);
  }

  function checkliste(frage) {
    const punkte = el('ul', { class: 'kernpunkte', role: 'list' });
    frage.kernpunkte.forEach((text, i) => {
      const id = `kp-${i}`;
      punkte.append(el('li', {},
        el('input', {
          type: 'checkbox', id,
          onchange: (e) => {
            if (e.target.checked) abgehakt.add(i); else abgehakt.delete(i);
            ziel.querySelector('#vorschlag')?.replaceChildren(vorschlagstext(frage));
            ziel.querySelector('#bewertung')?.replaceWith(bewertungsknoepfe(frage));
          },
        }),
        el('label', { for: id }, text)));
    });
    return el('section', { class: 'karte checkliste' },
      el('p', { class: 'etikett' }, t('freitext.kernpunkte')),
      el('p', { class: 'hinweis oben' }, t('freitext.kernpunkteAnleitung')),
      punkte,
      pruefzeile(frage));
  }

  /** Prüfstatus der Kernpunkte mit Knopf (F-39), wie in der Runde. */
  function pruefzeile(frage) {
    const zeile = pruefstatusZeile({
      geprueft: kernpunkteGeprueft(frage, sim.holePruefstatus?.() ?? null),
      onUmschalten: sim.onPruefstatus
        ? (neu) => {
          sim.onPruefstatus(frage, neu);
          const ersatz = pruefzeile(frage);
          zeile.replaceWith(ersatz);
          ersatz.querySelector('#pruefstatusknopf')?.focus();
        }
        : null,
    });
    return zeile;
  }

  function vorschlagstext(frage) {
    const v = freitextVorschlag(frage, abgehakt);
    return t(v.gewusst ? 'freitext.vorschlagGewusst' : 'freitext.vorschlagNicht', v);
  }

  function bewertungsknoepfe(frage) {
    const gewusst = freitextVorschlag(frage, abgehakt).gewusst;
    const bewerte = (richtig) => {
      bewertungen.set(frage.id, richtig);
      bewertNr += 1;
      if (bewertNr < zuBewerten.length) zeichneBewertung();
      else zeichneAuswertung();
    };
    return el('div', { class: 'aktionen nebeneinander', id: 'bewertung' },
      el('button', {
        type: 'button', class: `knopf falsch${gewusst ? '' : ' vorgeschlagen'}`, onclick: () => bewerte(false),
      }, t('runde.nichtGewusst')),
      el('button', {
        type: 'button', class: `knopf richtig${gewusst ? ' vorgeschlagen' : ''}`, onclick: () => bewerte(true),
      }, t('runde.gewusst')),
    );
  }

  function herkunftUndQuelle(frage) {
    const teile = [];
    const herkunft = herkunftVon(frage, sim.modul);
    if (herkunft) {
      const schluessel = `herkunft.${herkunft}`;
      const text = t(schluessel);
      teile.push(el('p', { class: 'herkunft' }, t('herkunft.label'), ' ', el('strong', {}, text === schluessel ? herkunft : text)));
    }
    if (frage.erklaerung) {
      teile.push(el('p', { class: 'etikett' }, t('runde.erklaerung')), el('p', { class: 'antworttext' }, frage.erklaerung));
    }
    if (frage.quelle) teile.push(el('p', { class: 'quelle' }, t('runde.quelle'), ' ', frage.quelle));
    return teile;
  }

  // --- 4. Auswertung -----------------------------------------------------

  function zeichneAuswertung() {
    const e = werteAus(sim.modul, bogen, bewertungen);
    const dauer = zeittext(abgegebenUm - start);

    const ergebnis = el('section', { class: `karte ergebnis ${e.bestanden ? 'bestanden' : 'durchgefallen'}` },
      el('p', { class: 'etikett' }, t('pruefung.auswertung')),
      el('h2', {}, t(e.bestanden ? 'pruefung.bestanden' : 'pruefung.nichtBestanden')),
      el('p', { class: 'punkte' }, t('pruefung.punkte', { punkte: e.punkte, maxPunkte: e.maxPunkte })),
      el('p', { class: 'trefferquote' }, t('pruefung.grenze', { bestehenAb: e.bestehenAb, richtig: e.richtig, gesamt: e.gesamt })),
      el('p', { class: 'hinweis oben' },
        zeitAbgelaufen ? t('pruefung.dauerAbgelaufen', { minuten: sim.regeln.minuten })
          : t('pruefung.dauer', { dauer, minuten: sim.regeln.minuten })),
      el('p', { class: 'hinweis' }, t('pruefung.ohneWirkung')),
    );

    const liste = el('ul', { class: 'themenfortschritt', role: 'list' });
    for (const z of e.themen) {
      const anteil = z.maxPunkte > 0 ? z.punkte / z.maxPunkte : 0;
      liste.append(el('li', {},
        el('p', { class: 'themenzeile' }, el('span', {}, z.titel),
          el('strong', { class: 'zahl' }, t('pruefung.themaPunkte', { punkte: z.punkte, maxPunkte: z.maxPunkte }))),
        el('div', {
          class: 'balken themenbalken', role: 'progressbar',
          'aria-label': t('pruefung.themaLabel', { thema: z.titel, punkte: z.punkte, maxPunkte: z.maxPunkte }),
          'aria-valuemin': '0', 'aria-valuemax': String(z.maxPunkte), 'aria-valuenow': String(z.punkte),
        }, el('span', { class: 'sicher', style: `width: ${anteil * 100}%` })),
        el('p', { class: 'leise themenzahlen' }, t('pruefung.themaRichtig', { richtig: z.richtig, gesamt: z.gesamt }))));
    }
    const themenkarte = el('section', { class: 'karte' }, el('p', { class: 'etikett' }, t('pruefung.jeThema')), liste);

    const inhalt = [ergebnis, themenkarte];
    if (e.fehler.length > 0) {
      const fehlerliste = el('ol', { class: 'schwaechen', role: 'list' });
      for (const frage of e.fehler) fehlerliste.append(fehlerzeile(frage));
      inhalt.push(el('section', { class: 'karte' },
        el('p', { class: 'etikett' }, t('pruefung.fehlerTitel', { anzahl: e.fehler.length })),
        el('p', { class: 'hinweis oben' }, t('pruefung.fehlerAnleitung')),
        fehlerliste));
    }

    const aktionen = el('div', { class: 'aktionen' });
    if (e.fehler.length > 0) {
      aktionen.append(el('button', {
        type: 'button', class: 'knopf', onclick: () => sim.onFehlerUeben(e.fehler),
      }, t('pruefung.fehlerUeben', { anzahl: e.fehler.length })));
    }
    aktionen.append(el('button', {
      type: 'button', class: e.fehler.length > 0 ? 'knopf zweitrangig' : 'knopf', onclick: sim.onZurueck,
    }, t('auswertung.zurStartseite')));

    ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
    window.scrollTo(0, 0);
  }

  function fehlerzeile(frage) {
    const a = antworten.get(frage.id);
    let eigene;
    if (frage.typ === 'mc' && istMehrfach(frage)) eigene = (a?.size ?? 0) === 0 ? null : optionstexte(frage, a).join(' · ');
    else if (frage.typ === 'mc') eigene = a === undefined ? null : frage.optionen[a];
    else if (frage.typ === 'zahl') {
      const zahl = bewerteZahl(frage, a ?? '').zahl;
      eigene = zahl === null ? (istLeer(a ?? '') ? null : a) : mitEinheit(zahl, frage.einheit);
    } else eigene = istLeer(a ?? '') ? null : a;
    let loesung;
    if (frage.typ === 'mc') loesung = mcLoesung(frage);
    else if (frage.typ === 'zahl') loesung = zahlLoesung(frage);
    else loesung = [el('p', { class: 'etikett' }, t('runde.musterantwort')), el('p', { class: 'antworttext' }, frage.musterantwort)];
    return el('li', {},
      el('details', {},
        el('summary', {},
          el('span', { class: 'schwaechetext' },
            el('span', { class: 'fragekurz' }, frage.frage),
            el('span', { class: 'leise' }, themenTitel.get(frage.thema) ?? frage.thema))),
        el('div', { class: 'schwaecheantwort' },
          el('p', { class: 'fragetext' }, frage.frage),
          el('p', { class: 'etikett' }, t('freitext.deineAntwort')),
          eigene === null
            ? el('p', { class: 'antworttext leise' }, t('pruefung.keineAntwort'))
            : el('p', { class: 'antworttext' }, eigene),
          ...loesung,
          frage.quelle ? el('p', { class: 'quelle' }, t('runde.quelle'), ' ', frage.quelle) : null)));
  }

  zeichneUebersicht();
}
