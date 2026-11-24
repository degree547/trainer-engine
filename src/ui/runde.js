// Rundenbildschirm: Frage → Antwort → Auflösung mit Erklärung (F-07) → Bewertung.
// Multiple Choice (F-08): Option antippen, die App bewertet selbst.
// Freitext (F-29, F-30): Antwort tippen, Musterantwort mit Herkunft sehen,
// Kernpunkte abhaken, selbst bewerten. Die Regeln stehen in M3.
// Enter schickt die Freitext-Antwort ab, Shift+Enter macht einen Zeilenumbruch (F-33).
// Zahleneingabe (F-09): Zahl tippen, die App bewertet mit Toleranz und zeigt die Lösung.

import { t } from './i18n.js';
import { el } from './dom.js';
import { hinweistext, levelbalken, rangaufstieg } from './fortschritt.js';
import {
  optionsReihenfolge, buchstabe, bewerteMc, istLeer, freitextVorschlag, herkunftVon,
  bewerteZahl, istMehrfach, richtigeOptionen, kernpunkteGeprueft,
} from '../engine/m3-fragetypen.js';
import { zahlfeld, zahlUngueltig, zahlAufloesung } from './zahl.js';
import { mcLoesung, mehrfachHinweis } from './mc.js';
import { pruefstatusZeile } from './pruefstatus.js';
import { sicherungskarte } from './sichern.js';

/**
 * @param {HTMLElement} ziel
 * @param {{
 *   fragen: object[],
 *   modus: 'normal' | 'vorziehen' | 'fehler',
 *   modul: object,
 *   themenTitel: Map<string, string>,
 *   onBewertung: (frage: object, richtig: boolean, uebung: boolean, modus: string, antwort: object) => number,
 *     antwort (F-43): Freitext {text, abgehakt}, Multiple Choice {gewaehlt}, Zahl {eingabe}
 *   onRundenende?: (runde: {modus: string, beantwortet: number, gesamt: number, fehler: number, xp: number}) =>
 *     {zaehlt: boolean, bonus: number, fortschritt: object, hinweis: object, aufstieg?: object},
 *   holeFaecher: () => number[],
 *   onFertig: () => void,
 *   holePruefstatus?: () => object | null,               // Prüfstatus der Kernpunkte (F-39) aus M7
 *   onPruefstatus?: (frage: object, geprueft: boolean) => void, // fehlt: Status nur anzeigen
 *   onSichern?: () => Promise<object>,                    // Sicherung am Rundenende (F-41); fehlt: kein Knopf
 * }} runde
 */
export function zeigeRunde(ziel, runde) {
  const uebung = runde.modus !== 'normal';
  const ergebnisse = [];
  let rundenXp = 0;          // XP aus den Antworten dieser Runde (M4)
  let abschluss = null;      // Ergebnis von onRundenende, nur einmal je Runde
  let nr = 0;
  // Zustand der aktuellen Frage
  let aufgedeckt = false;
  let reihenfolge = [];      // MC: Anzeigereihenfolge der Optionen
  let gewaehlt = null;       // MC: gewählte Option (Nummer im Modul); Mehrfachauswahl (F-40): Set der Nummern
  let antwort = '';          // Freitext: getippte Antwort
  let leerNachfragen = false; // Freitext: Rückfrage bei leerem Feld
  let abgehakt = new Set();  // Freitext: abgehakte Kernpunkte
  let ungueltig = false;     // Zahl: Eingabe ist keine Zahl

  function neueFrage() {
    const frage = runde.fragen[nr];
    aufgedeckt = false;
    gewaehlt = istMehrfach(frage) ? new Set() : null;
    antwort = '';
    leerNachfragen = false;
    abgehakt = new Set();
    ungueltig = false;
    reihenfolge = frage.typ === 'mc' ? optionsReihenfolge(frage) : [];
    zeichneFrage();
  }

  function bewerteUndWeiter(richtig) {
    const frage = runde.fragen[nr];
    // Eingabe für die gespeicherte Antwort (F-43): Text mit abgehakten Kernpunkten, Optionen oder Zahl.
    const eingabe = frage.typ === 'freitext' ? { text: antwort, abgehakt: [...abgehakt] }
      : frage.typ === 'mc' ? { gewaehlt } : { eingabe: antwort };
    rundenXp += runde.onBewertung(frage, richtig, uebung, runde.modus, eingabe) ?? 0;
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
      frage.typ === 'mc' && !aufgedeckt ? mehrfachHinweis(frage) : null,
      frage.typ === 'mc' ? optionen(frage) : null,
      frage.typ === 'freitext' && !aufgedeckt ? eingabefeld() : null,
      frage.typ === 'zahl' && !aufgedeckt ? zahleingabe(frage) : null,
    );

    const inhalt = [kopf, balken, karte];
    if (uebung && nr === 0 && !aufgedeckt) inhalt.push(el('p', { class: 'hinweis' }, t('runde.uebungHinweis')));
    if (aufgedeckt) {
      if (frage.typ === 'mc') inhalt.push(...mcAufloesung(frage));
      else if (frage.typ === 'zahl') inhalt.push(zahlKarte(frage));
      else inhalt.push(...freitextAufloesung(frage));
    }

    const aktionen = el('div', { class: 'aktionen' });
    if (frage.typ === 'mc') {
      // Vor der Wahl keine Knöpfe unten: die Optionen selbst sind die Knöpfe.
      // Mehrfachauswahl (F-40): erst alle zutreffenden antippen, dann prüfen.
      if (!aufgedeckt && istMehrfach(frage)) {
        aktionen.append(el('button', {
          type: 'button', class: 'knopf', id: 'pruefknopf', disabled: gewaehlt.size === 0,
          onclick: () => { aufgedeckt = true; zeichneFrage(); },
        }, t('mc.pruefen')));
      }
      if (aufgedeckt) {
        aktionen.append(el('button', {
          type: 'button', class: 'knopf', onclick: () => bewerteUndWeiter(bewerteMc(frage, gewaehlt)),
        }, t('runde.weiter')));
      }
    } else if (frage.typ === 'zahl') {
      if (aufgedeckt) {
        aktionen.append(el('button', {
          type: 'button', class: 'knopf', onclick: () => bewerteUndWeiter(bewerteZahl(frage, antwort).richtig),
        }, t('runde.weiter')));
      } else {
        if (leerNachfragen) aktionen.append(el('p', { class: 'hinweis mitte', id: 'leerhinweis', role: 'status' }, t('zahl.leerHinweis')));
        aktionen.append(el('button', {
          type: 'button', class: 'knopf', id: 'pruefknopf', onclick: () => pruefeZahl(frage),
        }, t(leerNachfragen ? 'zahl.ohneAntwort' : 'zahl.pruefen')));
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
    const mehrfach = istMehrfach(frage);
    const richtige = new Set(richtigeOptionen(frage));
    const istGewaehlt = (i) => (mehrfach ? gewaehlt.has(i) : i === gewaehlt);
    const liste = el('ul', { class: 'optionen', role: 'list', 'aria-labelledby': 'fragetext' });
    reihenfolge.forEach((i, position) => {
      let klasse = 'option';
      let zusatz = null;
      if (aufgedeckt) {
        if (richtige.has(i)) {
          klasse += ' korrekt';
          zusatz = t(mehrfach && !istGewaehlt(i) ? 'mc.markeFehlt' : 'mc.markeRichtig');
        } else if (istGewaehlt(i)) { klasse += ' daneben'; zusatz = t('mc.markeGewaehlt'); }
      } else if (mehrfach && istGewaehlt(i)) klasse += ' gewaehlt';
      liste.append(el('li', {},
        el('button', {
          type: 'button', class: klasse, disabled: aufgedeckt,
          'aria-pressed': aufgedeckt || mehrfach ? String(istGewaehlt(i)) : null,
          onclick: (e) => {
            if (!mehrfach) { gewaehlt = i; aufgedeckt = true; zeichneFrage(); return; }
            // Mehrfachauswahl (F-40): nur umschalten, ohne neu zu zeichnen (die Seite springt nicht).
            if (gewaehlt.has(i)) gewaehlt.delete(i); else gewaehlt.add(i);
            e.currentTarget.classList.toggle('gewaehlt', gewaehlt.has(i));
            e.currentTarget.setAttribute('aria-pressed', String(gewaehlt.has(i)));
            const knopf = ziel.querySelector('#pruefknopf');
            if (knopf) knopf.disabled = gewaehlt.size === 0;
          },
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
    if (!richtig) teile.push(...mcLoesung(frage));
    teile.push(...erklaerungUndQuelle(frage));
    return [el('section', { class: 'karte aufloesung', 'aria-live': 'polite' }, ...teile)];
  }

  // --- Freitext ----------------------------------------------------------

  function eingabefeld() {
    const feld = el('textarea', {
      id: 'antwort', class: 'antwortfeld', rows: '5',
      'aria-label': t('freitext.eingabeLabel'), placeholder: t('freitext.platzhalter'),
      autocomplete: 'off', spellcheck: 'true', enterkeyhint: 'send',
      onkeydown: (e) => {
        // F-33: Enter schickt ab, Shift+Enter bricht die Zeile um. Während einer
        // Wortauswahl der Tastatur (isComposing) gehört Enter noch zur Eingabe.
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        antwort = e.target.value;
        pruefeAntwort();
      },
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
    if (istLeer(antwort) && !leerNachfragen) {
      leerNachfragen = true;
      zeichneFrage();
      ziel.querySelector('#antwort')?.focus(); // Tastatur bleibt offen, zweites Enter löst auf
      return;
    }
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
      pruefzeile(frage));

    return [eigene, muster, checkliste];
  }

  /** Prüfstatus der Kernpunkte mit Knopf (F-39); beim Umschalten wird nur diese Zeile erneuert. */
  function pruefzeile(frage) {
    const geprueft = kernpunkteGeprueft(frage, runde.holePruefstatus?.() ?? null);
    const zeile = pruefstatusZeile({
      geprueft,
      onUmschalten: runde.onPruefstatus
        ? (neu) => {
          runde.onPruefstatus(frage, neu);
          const ersatz = pruefzeile(frage);
          zeile.replaceWith(ersatz);
          ersatz.querySelector('#pruefstatusknopf')?.focus();
        }
        : null,
    });
    return zeile;
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

  // --- Zahl (F-09) -------------------------------------------------------

  function zahleingabe(frage) {
    return zahlfeld({
      frage, wert: antwort, ungueltig,
      onInput: (text) => {
        antwort = text;
        if (leerNachfragen && !istLeer(antwort)) {
          // Nur Hinweis und Knopf ändern; das Feld bleibt, damit die Tastatur offen bleibt.
          leerNachfragen = false;
          ziel.querySelector('#leerhinweis')?.remove();
          const knopf = ziel.querySelector('#pruefknopf');
          if (knopf) knopf.textContent = t('zahl.pruefen');
        }
      },
      onEnter: (text) => { antwort = text; pruefeZahl(frage); },
    });
  }

  function pruefeZahl(frage) {
    if (zahlUngueltig(frage, antwort)) {
      ungueltig = true;
      zeichneFrage();
      ziel.querySelector('#antwort')?.focus();
      return;
    }
    ungueltig = false;
    if (istLeer(antwort) && !leerNachfragen) {
      leerNachfragen = true;
      zeichneFrage();
      ziel.querySelector('#antwort')?.focus();
      return;
    }
    aufgedeckt = true;
    zeichneFrage();
  }

  function zahlKarte(frage) {
    return el('section', { class: 'karte aufloesung', 'aria-live': 'polite' },
      ...zahlAufloesung(frage, antwort), ...erklaerungUndQuelle(frage));
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
    if (!abschluss && ergebnisse.length > 0 && runde.onRundenende) {
      abschluss = runde.onRundenende({
        modus: runde.modus, beantwortet: ergebnisse.length, gesamt: runde.fragen.length, fehler: fehler.length,
        xp: rundenXp,
      });
    }

    const karte = el('section', { class: 'karte' },
      el('p', { class: 'etikett' }, t(`runde.titel.${runde.modus}`)),
      el('h2', {}, ergebnisse.length === 0 ? t('auswertung.keineAntwort')
        : t('auswertung.gewusst', { gewusst, gesamt: ergebnisse.length })),
      ergebnisse.length > 0
        ? el('p', { class: 'trefferquote' }, t('auswertung.trefferquote', { prozent: Math.round((gewusst / ergebnisse.length) * 100) }))
        : null,
      fehler.length === 0 && ergebnisse.length > 0 ? el('p', {}, t('auswertung.ohneFehler')) : null,
      uebung && ergebnisse.length > 0 ? el('p', { class: 'hinweis' }, t('runde.uebungHinweis')) : null,
      faecherleiste(faecher),
    );

    // XP, Streak und Level am Rundenende (F-15), dazu ein neuer Rang (F-36).
    const belohnung = abschluss ? el('section', { class: 'karte belohnung' },
      el('p', { class: 'etikett' }, t('fortschritt.titel')),
      abschluss.aufstieg?.rang ? rangaufstieg(abschluss.aufstieg.rang) : null,
      el('p', { class: 'xp' }, t('auswertung.xp', { xp: rundenXp + abschluss.bonus })),
      abschluss.bonus > 0 ? el('p', { class: 'hinweis oben' }, t('auswertung.bonus', { bonus: abschluss.bonus })) : null,
      !abschluss.zaehlt && runde.modus !== 'fehler' ? el('p', { class: 'hinweis' }, t('auswertung.zaehltNicht')) : null,
      el('p', { class: `erinnerung${abschluss.fortschritt.streak.heuteErreicht ? ' erreicht' : ''}` }, hinweistext(abschluss.hinweis)),
      levelbalken(abschluss.fortschritt.level, abschluss.fortschritt.rang),
    ) : null;

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

    // Sichern mit einem Tipp (F-41), damit Browser, die beim Schließen löschen, nichts verlieren.
    const sichern = runde.onSichern && ergebnisse.length > 0 ? sicherungskarte(runde.onSichern) : null;
    ziel.replaceChildren(el('div', { class: 'inhalt' }, karte, belohnung, sichern), aktionen);
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
