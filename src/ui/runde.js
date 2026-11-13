// Rundenbildschirm: Frage → Antwort → Auflösung mit Erklärung (F-07) → Bewertung.
// Multiple Choice (F-08): Option antippen, die App bewertet selbst.
// Freitext (F-29, F-30): Antwort tippen, Musterantwort mit Herkunft sehen,
// Kernpunkte abhaken, selbst bewerten. Die Regeln stehen in M3.

import { t } from './i18n.js';
import { el } from './dom.js';
import {
  optionsReihenfolge, buchstabe, bewerteMc, istLeer, freitextVorschlag, herkunftVon,
} from '../engine/m3-fragetypen.js';

/**
 * @param {HTMLElement} ziel
 * @param {{
 *   fragen: object[],
 *   modus: 'normal' | 'vorziehen' | 'fehler',
 *   modul: object,
 *   themenTitel: Map<string, string>,
 *   onBewertung: (frage: object, richtig: boolean, uebung: boolean) => void,
 *   holeFaecher: () => number[],
 *   onFertig: () => void,
 * }} runde
 */
export function zeigeRunde(ziel, runde) {
  const uebung = runde.modus !== 'normal';
  const ergebnisse = [];
  let nr = 0;
  // Zustand der aktuellen Frage
  let aufgedeckt = false;
  let reihenfolge = [];      // MC: Anzeigereihenfolge der Optionen
  let gewaehlt = null;       // MC: gewählte Option (Nummer im Modul)
  let antwort = '';          // Freitext: getippte Antwort
  let leerNachfragen = false; // Freitext: Rückfrage bei leerem Feld
  let abgehakt = new Set();  // Freitext: abgehakte Kernpunkte

  function neueFrage() {
    const frage = runde.fragen[nr];
    aufgedeckt = false;
    gewaehlt = null;
    antwort = '';
    leerNachfragen = false;
    abgehakt = new Set();
    reihenfolge = frage.typ === 'mc' ? optionsReihenfolge(frage) : [];
    zeichneFrage();
  }

  function bewerteUndWeiter(richtig) {
    const frage = runde.fragen[nr];
    runde.onBewertung(frage, richtig, uebung);
    ergebnisse.push({ frage, richtig });
    nr += 1;
    if (nr < runde.fragen.length) neueFrage();
    else zeichneAuswertung();
  }

  function zeichneFrage() {
    const frage = runde.fragen[nr];
    const kopf = el('div', { class: 'rundenkopf' },
      el('p', { class: 'etikett' },
        t(`runde.titel.${runde.modus}`), ' · ',
        t('runde.fortschritt', { nr: nr + 1, gesamt: runde.fragen.length })),
      el('button', { type: 'button', class: 'textknopf', onclick: zeichneAuswertung }, t('runde.beenden')),
    );
    const balken = el('div', {
      class: 'balken', role: 'progressbar', 'aria-valuemin': '0',
      'aria-valuemax': String(runde.fragen.length), 'aria-valuenow': String(nr),
    }, el('span', { style: `width: ${(nr / runde.fragen.length) * 100}%` }));

    const karte = el('section', { class: 'karte frage' },
      el('p', { class: 'etikett' }, runde.themenTitel.get(frage.thema) ?? frage.thema),
      el('h2', { class: 'fragetext', id: 'fragetext' }, frage.frage),
      frage.hinweis ? el('p', { class: 'hinweis' }, frage.hinweis) : null,
      frage.typ === 'mc' ? optionen(frage) : null,
      frage.typ === 'freitext' && !aufgedeckt ? eingabefeld() : null,
    );

    const inhalt = [kopf, balken, karte];
    if (uebung && nr === 0 && !aufgedeckt) inhalt.push(el('p', { class: 'hinweis' }, t('runde.uebungHinweis')));
    if (aufgedeckt) inhalt.push(...(frage.typ === 'mc' ? mcAufloesung(frage) : freitextAufloesung(frage)));

    const aktionen = el('div', { class: 'aktionen' });
    if (frage.typ === 'mc') {
      // Vor der Wahl keine Knöpfe unten: die Optionen selbst sind die Knöpfe.
      if (aufgedeckt) {
        aktionen.append(el('button', {
          type: 'button', class: 'knopf', onclick: () => bewerteUndWeiter(bewerteMc(frage, gewaehlt)),
        }, t('runde.weiter')));
      }
    } else if (!aufgedeckt) {
      if (leerNachfragen) aktionen.append(el('p', { class: 'hinweis mitte', id: 'leerhinweis', role: 'status' }, t('freitext.leerHinweis')));
      aktionen.append(el('button', {
        type: 'button', class: 'knopf', id: 'pruefknopf', onclick: pruefeAntwort,
      }, t(leerNachfragen ? 'freitext.ohneAntwort' : 'freitext.pruefen')));
    } else {
      aktionen.append(vorschlagszeile(frage), bewertungsknoepfe(frage));
    }

    ziel.replaceChildren(el('div', { class: 'inhalt' }, ...inhalt), aktionen);
    if (aufgedeckt) ziel.querySelector('.aufloesung')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }

  // --- Multiple Choice ---------------------------------------------------

  function optionen(frage) {
    const liste = el('ul', { class: 'optionen', role: 'list', 'aria-labelledby': 'fragetext' });
    reihenfolge.forEach((i, position) => {
      let klasse = 'option';
      let zusatz = null;
      if (aufgedeckt) {
        if (i === frage.richtig) { klasse += ' korrekt'; zusatz = t('mc.markeRichtig'); }
        else if (i === gewaehlt) { klasse += ' daneben'; zusatz = t('mc.markeGewaehlt'); }
      }
      liste.append(el('li', {},
        el('button', {
          type: 'button', class: klasse, disabled: aufgedeckt,
          'aria-pressed': aufgedeckt ? String(i === gewaehlt) : null,
          onclick: () => { gewaehlt = i; aufgedeckt = true; zeichneFrage(); },
        },
        el('span', { class: 'buchstabe', 'aria-hidden': 'true' }, buchstabe(position)),
        el('span', { class: 'optionstext' }, frage.optionen[i]),
        zusatz ? el('span', { class: 'marke' }, zusatz) : null)));
    });
    return liste;
  }

  function mcAufloesung(frage) {
    const richtig = bewerteMc(frage, gewaehlt);
    const teile = [
      el('p', { class: `urteil ${richtig ? 'ok' : 'nein'}` }, t(richtig ? 'mc.richtig' : 'mc.falsch')),
    ];
    if (!richtig) {
      teile.push(el('p', { class: 'etikett' }, t('runde.richtigeAntwort')),
        el('p', { class: 'antworttext' }, frage.optionen[frage.richtig]));
    }
    teile.push(...erklaerungUndQuelle(frage));
    return [el('section', { class: 'karte aufloesung', 'aria-live': 'polite' }, ...teile)];
  }

  // --- Freitext ----------------------------------------------------------

  function eingabefeld() {
    const feld = el('textarea', {
      id: 'antwort', class: 'antwortfeld', rows: '5',
      'aria-label': t('freitext.eingabeLabel'), placeholder: t('freitext.platzhalter'),
      autocomplete: 'off', spellcheck: 'true',
      oninput: (e) => {
        antwort = e.target.value;
        if (leerNachfragen && !istLeer(antwort)) {
          // Nur Hinweis und Knopf ändern; das Feld bleibt, damit die Tastatur offen bleibt.
          leerNachfragen = false;
          ziel.querySelector('#leerhinweis')?.remove();
          const knopf = ziel.querySelector('#pruefknopf');
          if (knopf) knopf.textContent = t('freitext.pruefen');
        }
      },
    });
    feld.value = antwort;
    return el('div', { class: 'eingabe' },
      el('label', { for: 'antwort', class: 'etikett' }, t('freitext.eingabeLabel')),
      feld);
  }

  function pruefeAntwort() {
    if (istLeer(antwort) && !leerNachfragen) { leerNachfragen = true; zeichneFrage(); return; }
    aufgedeckt = true;
    zeichneFrage();
  }

  function freitextAufloesung(frage) {
    const eigene = el('section', { class: 'karte eigene' },
      el('p', { class: 'etikett' }, t('freitext.deineAntwort')),
      istLeer(antwort)
        ? el('p', { class: 'antworttext leise' }, t('freitext.keineAntwort'))
        : el('p', { class: 'antworttext' }, antwort));

    const muster = el('section', { class: 'karte aufloesung', 'aria-live': 'polite' },
      el('p', { class: 'etikett' }, t('runde.musterantwort')),
      el('p', { class: 'antworttext' }, frage.musterantwort),
      ...erklaerungUndQuelle(frage));

    const punkte = el('ul', { class: 'kernpunkte', role: 'list' });
    frage.kernpunkte.forEach((text, i) => {
      const id = `kp-${i}`;
      punkte.append(el('li', {},
        el('input', {
          type: 'checkbox', id, checked: abgehakt.has(i),
          onchange: (e) => {
            if (e.target.checked) abgehakt.add(i); else abgehakt.delete(i);
            aktualisiereVorschlag(frage);
          },
        }),
        el('label', { for: id }, text)));
    });
    const checkliste = el('section', { class: 'karte checkliste' },
      el('p', { class: 'etikett' }, t('freitext.kernpunkte')),
      el('p', { class: 'hinweis oben' }, t('freitext.kernpunkteAnleitung')),
      punkte,
      frage.kernpunkteStatus === 'ungeprueft' ? el('p', { class: 'hinweis' }, t('freitext.ungeprueft')) : null);

    return [eigene, muster, checkliste];
  }

  function vorschlagszeile(frage) {
    return el('p', { class: 'vorschlag', id: 'vorschlag', role: 'status' }, vorschlagstext(frage));
  }

  function vorschlagstext(frage) {
    const v = freitextVorschlag(frage, abgehakt);
    return t(v.gewusst ? 'freitext.vorschlagGewusst' : 'freitext.vorschlagNicht', v);
  }

  function bewertungsknoepfe(frage) {
    const gewusst = freitextVorschlag(frage, abgehakt).gewusst;
    return el('div', { class: 'aktionen nebeneinander', id: 'bewertung' },
      el('button', {
        type: 'button', class: `knopf falsch${gewusst ? '' : ' vorgeschlagen'}`, onclick: () => bewerteUndWeiter(false),
      }, t('runde.nichtGewusst')),
      el('button', {
        type: 'button', class: `knopf richtig${gewusst ? ' vorgeschlagen' : ''}`, onclick: () => bewerteUndWeiter(true),
      }, t('runde.gewusst')),
    );
  }

  /** Nur Vorschlag und Knöpfe erneuern, damit die Seite beim Abhaken nicht springt. */
  function aktualisiereVorschlag(frage) {
    ziel.querySelector('#vorschlag')?.replaceChildren(vorschlagstext(frage));
    ziel.querySelector('#bewertung')?.replaceWith(bewertungsknoepfe(frage));
  }

  // --- gemeinsam ---------------------------------------------------------

  function erklaerungUndQuelle(frage) {
    const teile = [];
    // Herkunft der Antwort (F-30): amtlich, Buch oder eigen; andere Angaben aus dem Modul unverändert.
    const herkunft = herkunftVon(frage, runde.modul);
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

  function zeichneAuswertung() {
    const gewusst = ergebnisse.filter((e) => e.richtig).length;
    const fehler = ergebnisse.filter((e) => !e.richtig).map((e) => e.frage);
    const faecher = runde.holeFaecher();

    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t(`runde.titel.${runde.modus}`)),
      el('h2', {}, ergebnisse.length === 0 ? t('auswertung.keineAntwort')
        : t('auswertung.gewusst', { gewusst, gesamt: ergebnisse.length })),
      fehler.length === 0 && ergebnisse.length > 0 ? el('p', {}, t('auswertung.ohneFehler')) : null,
      uebung && ergebnisse.length > 0 ? el('p', { class: 'hinweis' }, t('runde.uebungHinweis')) : null,
      faecherleiste(faecher),
    );

    const aktionen = el('div', { class: 'aktionen' });
    if (fehler.length > 0) {
      aktionen.append(el('button', {
        type: 'button', class: 'knopf',
        onclick: () => zeigeRunde(ziel, { ...runde, fragen: fehler, modus: 'fehler' }),
      }, t('auswertung.fehlerWiederholen', { anzahl: fehler.length })));
    }
    aktionen.append(el('button', {
      type: 'button', class: fehler.length > 0 ? 'knopf zweitrangig' : 'knopf', onclick: runde.onFertig,
    }, t('auswertung.zurStartseite')));

    ziel.replaceChildren(el('div', { class: 'inhalt' }, karte), aktionen);
    window.scrollTo(0, 0);
  }

  if (runde.fragen.length === 0) zeichneAuswertung();
  else neueFrage();
}

/** Anzahl der Fragen in Fach 1 bis 5 als Leiste. */
export function faecherleiste(faecher) {
  return el('div', { class: 'faecher' },
    el('p', { class: 'etikett' }, t('lernen.faecher')),
    el('ol', {}, ...faecher.map((anzahl, i) =>
      el('li', { 'aria-label': t('lernen.fachLabel', { fach: i + 1, anzahl }) },
        el('span', { class: 'fachnr' }, String(i + 1)),
        el('span', { class: 'zahl' }, String(anzahl))))),
  );
}
