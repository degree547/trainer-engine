// Einstieg der App: Texte laden, Service Worker registrieren, Standardmodul laden,
// zwischen Startseite und Runde wechseln.

import { ladeModulAusUrl, ladeModulAusDatei } from './engine/m1-kern.js';
import {
  neuerLernstand, bewerte, bildeRunde, bildeVorgezogeneRunde, lernUebersicht, datumVon,
} from './engine/m2-lernlogik.js';
import {
  neuesProfil, vergibAntwort, schliesseRundeAb, setzeTagesziel, fortschritt as profilFortschritt, startHinweis,
  rangVon, aufstiegVon,
} from './engine/m4-gamification.js';
import {
  oeffneSpeicher, bitteUmDauerhaftenSpeicher, fuehreZusammen, SpeicherFehler, antwortEintrag, istLeereSicherung,
  pruefeSicherung, dateinameSicherung, neuerPruefstatus, setzePruefstatus,
} from './engine/m7-speicherung.js';
import { fortschrittJeThema, schwaechenliste, pruefstandJeThema } from './engine/m5-statistik.js';
import { pruefungsregeln, bildePruefbogen } from './engine/m6-pruefung.js';
import { mitGeneratoren, erneuere } from './engine/m9-generatoren.js';
import { ladeTexte, t, bevorzugteSprache, merkeSprache, sprache, zahltext } from './ui/i18n.js';
import { zeigeStart } from './ui/start.js';
import { zeigeRunde } from './ui/runde.js';
import { zeigeStatistik } from './ui/statistik.js';
import { zeigePruefung } from './ui/pruefung.js';

// Welches Inhaltsmodul beim Start geladen wird (amtlicher SKS-Katalog, AP2).
const STANDARDMODUL = 'content/sks/sks.json';

const hauptbereich = document.getElementById('app');
const statuszeile = document.getElementById('status');

// Zustand der App. Der Lernstand wird nach jeder Bewertung in der IndexedDB gespeichert (M7).
// speicherFehler: Code, falls nicht gespeichert werden kann; dauerhaft: Antwort des Browsers auf persist().
// profil: XP, Streak und Tagesziel (M4) für die ganze App; profilSpeichern: false, wenn das
// gespeicherte Profil nicht gelesen werden konnte (dann wird es auch nicht überschrieben).
const zustand = {
  modul: null, fehler: null, dateiname: '', lernstand: neuerLernstand(),
  speicher: null, speicherFehler: null, dauerhaft: 'unbekannt', verworfen: 0,
  profil: neuesProfil(), profilSpeichern: true, profilVerworfen: 0, profilFehler: null, offeneProfilAenderungen: 0,
  thema: null, // gewähltes Thema für Runden (F-06), null = alle Themen
  sicherungMeldung: null, // Rückmeldung nach Export oder Import (F-22), wird einmal angezeigt
  pruefstatus: neuerPruefstatus(), // Prüfstatus der Kernpunkte des geladenen Moduls (F-39)
  leererStart: false, // nichts gespeichert: Laden einer Sicherung anbieten (F-42)
};

// Datum der letzten exportierten Sicherung, nur als Hinweis für diesen Browser (localStorage).
const SICHERUNG_SCHLUESSEL = 'trainer-engine.letzteSicherung';

function letzteSicherung() {
  try {
    return localStorage.getItem(SICHERUNG_SCHLUESSEL);
  } catch {
    return null;
  }
}

// Das gewählte Thema wird je Modul im Browser gemerkt (localStorage). Es ist nur eine
// Einstellung der Oberfläche, kein Lernstand; geht sie verloren, gilt wieder „Alle Themen“.
const THEMA_SCHLUESSEL = 'trainer-engine.thema.';

/** Gemerktes Thema zum Modul; null, wenn keines gemerkt ist oder es das Thema nicht mehr gibt. */
function ladeThema(modul) {
  try {
    const id = localStorage.getItem(THEMA_SCHLUESSEL + modul.meta.id);
    return modul.themen.some((thema) => thema.id === id) ? id : null;
  } catch {
    return null;
  }
}

function waehleThema(id) {
  const { modul } = zustand;
  zustand.thema = id;
  try {
    if (id == null) localStorage.removeItem(THEMA_SCHLUESSEL + modul.meta.id);
    else localStorage.setItem(THEMA_SCHLUESSEL + modul.meta.id, id);
  } catch {
    // Ohne localStorage (z. B. privates Fenster) gilt die Wahl nur bis zum Schließen.
  }
}

function zeigeStatus() {
  const offlineBereit = navigator.serviceWorker?.controller != null;
  const text = navigator.onLine ? t('status.online') : t('status.offline');
  statuszeile.textContent = offlineBereit && navigator.onLine ? `${text} · ${t('status.offlineBereit')}` : text;
  statuszeile.dataset.online = String(navigator.onLine);
}

/** Textschlüssel zu einem Fehler beim Speichern (Browserfehler bekommen einen allgemeinen Text). */
function speicherCode(fehler, standard) {
  return fehler instanceof SpeicherFehler ? fehler.code : standard;
}

function heute() {
  return datumVon(new Date());
}

/**
 * Ändert das Profil (M4): sofort im Speicher der App, damit die Anzeige nicht warten muss,
 * und danach in der IndexedDB. Dort wird die Änderung auf den gespeicherten Stand angewendet,
 * damit XP aus einem zweiten Tab nicht verloren gehen.
 * @param {(profil: object) => {profil: object}} aenderung Funktion aus M4
 * @returns {object} Ergebnis der Änderung im Speicher der App
 */
function aendereProfil(aenderung) {
  const ergebnis = aenderung(zustand.profil);
  zustand.profil = ergebnis.profil;
  const { speicher } = zustand;
  if (speicher && zustand.profilSpeichern) {
    zustand.offeneProfilAenderungen += 1;
    speicher.aendereProfil(aenderung)
      .then((gespeichert) => {
        zustand.offeneProfilAenderungen -= 1;
        // Erst übernehmen, wenn keine weitere Änderung unterwegs ist, sonst fehlte sie kurz.
        if (zustand.offeneProfilAenderungen === 0) zustand.profil = gespeichert.profil;
        zustand.profilFehler = null;
      })
      .catch((fehler) => {
        zustand.offeneProfilAenderungen -= 1;
        zustand.profilFehler = speicherCode(fehler, 'speicher.schreibfehler');
      });
  }
  return ergebnis;
}

/** Kennzahlen aus M4, dazu der Rang aus dem geladenen Modul (F-36, F-37). */
function fortschritt(profil, tag) {
  const f = profilFortschritt(profil, tag);
  return { ...f, rang: rangVon(zustand.modul?.raenge, f.level.level) };
}

/** Speichert eine Antwort mit Ergebnis, Eingabe und der Frage, wie sie galt (F-34, F-43, F-44). */
function speichereAntwort(frage, gewusst, modus, antwort) {
  const { speicher, modul } = zustand;
  if (!speicher || !modul) return;
  speicher.speichereAntwort(antwortEintrag({ modul, frage, gewusst, modus, antwort }))
    .catch((fehler) => { zustand.speicherFehler = speicherCode(fehler, 'speicher.schreibfehler'); });
}

/**
 * Setzt den Prüfstatus der Kernpunkte einer Frage (F-39): sofort in der App, danach in der
 * IndexedDB. Dort wird mit dem gespeicherten Stand zusammengeführt (zweiter Tab).
 */
function aenderePruefstatus(frage, geprueft) {
  const { speicher, modul } = zustand;
  if (!modul) return;
  zustand.pruefstatus = setzePruefstatus(zustand.pruefstatus, frage.id, geprueft);
  if (!speicher) return;
  speicher.setzePruefstatus(modul.meta.id, frage.id, geprueft)
    .then((gespeichert) => { if (zustand.modul === modul) zustand.pruefstatus = gespeichert; })
    .catch((fehler) => { zustand.speicherFehler = speicherCode(fehler, 'speicher.schreibfehler'); });
}

/** Ob der Prüfknopf gezeigt wird: nur mit Speicher, sonst wäre die Wahl beim Neuladen weg. */
function pruefknopf() {
  return zustand.speicher ? aenderePruefstatus : undefined;
}

function zurStartseite() {
  const { modul, fehler, dateiname, lernstand, thema } = zustand;
  const lernen = modul ? lernUebersicht(modul, lernstand, heute(), { thema }) : null;
  const alle = modul && thema ? lernUebersicht(modul, lernstand, heute()) : lernen;
  zeigeStart(hauptbereich, {
    modul, fehler, dateiname, lernen,
    thema, anderswoFaellig: lernen ? alle.faellig - lernen.faellig : 0,
    onThema: (id) => { waehleThema(id); zurStartseite(); },
    fortschritt: fortschritt(zustand.profil, heute()),
    hinweis: startHinweis(zustand.profil, heute()),
    onTagesziel: (wert) => {
      aendereProfil((profil) => ({ profil: setzeTagesziel(profil, wert, heute()) }));
      zurStartseite();
    },
    speicherung: {
      fehler: zustand.speicherFehler ?? zustand.profilFehler, dauerhaft: zustand.dauerhaft,
      verworfen: zustand.verworfen + zustand.profilVerworfen,
    },
    onDatei: ladeDatei, onStandard: ladeStandard,
    onRunde: () => starteRunde('normal'),
    onVorziehen: () => starteRunde('vorziehen'),
    onStatistik: zurStatistik,
    onSimulation: modul && pruefungsregeln(modul) ? zurPruefung : null,
    einstellungen: {
      sprache: sprache(),
      onSprache: wechsleSprache,
      sicherung: { verfuegbar: zustand.speicher != null, letzte: letzteSicherung(), meldung: zustand.sicherungMeldung },
      onExport: exportiereSicherung,
      onImport: importiereSicherung,
    },
    leererStart: zustand.leererStart && zustand.speicher
      ? { onImport: importiereSicherung, onSpaeter: () => { zustand.leererStart = false; zurStartseite(); } }
      : null,
  });
  if (zustand.sicherungMeldung) {
    // Nach Export oder Import die Rückmeldung zeigen statt nach oben zu springen.
    zustand.sicherungMeldung = null;
    hauptbereich.querySelector('.meldung')?.scrollIntoView({ block: 'center' });
  } else {
    window.scrollTo(0, 0);
  }
}

/** Schaltet die Oberfläche um und merkt die Wahl in diesem Browser. */
async function wechsleSprache(neu) {
  merkeSprache(neu);
  await ladeTexte(neu);
  zeigeTitel();
  zeigeStatus();
  zurStartseite();
  document.getElementById('sprachwahl')?.focus();
}

/** Bietet eine Datei zum Herunterladen an. */
function ladeHerunter(json, name) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function merkeSicherung() {
  try { localStorage.setItem(SICHERUNG_SCHLUESSEL, heute()); } catch { /* nur ein Hinweis */ }
}

/**
 * Sicherung am Rundenende (F-41): über das Teilen-Menü, wenn der Browser Dateien teilen kann
 * (Smartphone), sonst als Download. Schließt der Lernende das Teilen-Menü, ist das kein Fehler.
 * @returns {Promise<{art: 'ok'|'fehler'|'abgebrochen', text?: string}>}
 */
async function sichereNachRunde() {
  try {
    // ladeSicherung reiht sich hinter die letzten Schreibvorgänge ein: die letzte Antwort ist dabei.
    const inhalt = await zustand.speicher.ladeSicherung();
    const name = dateinameSicherung(heute());
    const json = JSON.stringify(inhalt, null, 1);
    const datei = typeof File === 'function' ? new File([json], name, { type: 'application/json' }) : null;
    if (datei && navigator.canShare?.({ files: [datei] })) {
      try {
        await navigator.share({ files: [datei], title: name });
        merkeSicherung();
        return { art: 'ok', text: t('sicherung.geteilt', { name }) };
      } catch (fehler) {
        if (fehler?.name === 'AbortError') return { art: 'abgebrochen' };
        // Teilen verweigert (z. B. zu lange nach dem Tipp): als Download weiter.
      }
    }
    ladeHerunter(json, name);
    merkeSicherung();
    return { art: 'ok', text: t('sicherung.exportiert', { name }) };
  } catch (fehler) {
    return { art: 'fehler', text: t(speicherCode(fehler, 'sicherung.exportFehler')) };
  }
}

/** Knopf zum Sichern am Rundenende nur mit Speicher im Browser. */
function sichernKnopf() {
  return zustand.speicher ? sichereNachRunde : undefined;
}

/** Speichert die Sicherungsdatei auf dem Gerät (F-22). */
async function exportiereSicherung() {
  try {
    const inhalt = await zustand.speicher.ladeSicherung();
    const name = dateinameSicherung(heute());
    ladeHerunter(JSON.stringify(inhalt, null, 1), name);
    merkeSicherung();
    zustand.sicherungMeldung = { art: 'ok', text: t('sicherung.exportiert', { name }) };
  } catch (fehler) {
    zustand.sicherungMeldung = { art: 'fehler', text: t(speicherCode(fehler, 'sicherung.exportFehler')) };
  }
  zurStartseite();
}

/** Liest eine Sicherungsdatei, prüft sie vollständig und führt sie mit dem Gespeicherten zusammen. */
async function importiereSicherung(datei) {
  let geprueft;
  try {
    let daten;
    try {
      daten = JSON.parse(await datei.text());
    } catch {
      throw new SpeicherFehler('sicherung.keinJson');
    }
    geprueft = pruefeSicherung(daten);
  } catch (fehler) {
    zustand.sicherungMeldung = { art: 'fehler', text: t(speicherCode(fehler, 'sicherung.unlesbar')) };
    zurStartseite();
    return;
  }
  try {
    const ergebnis = await zustand.speicher.importiere(geprueft.sicherung);
    zustand.leererStart = false;
    // Gespeicherten Stand neu laden, damit Startseite, Statistik und Profil ihn zeigen.
    await ladeProfil();
    await ladeLernstand();
    const zeilen = [t('sicherung.importiert', ergebnis)];
    if (geprueft.verworfen > 0) zeilen.push(t('sicherung.verworfen', { anzahl: geprueft.verworfen }));
    zustand.sicherungMeldung = { art: 'ok', text: zeilen.join(' ') };
  } catch (fehler) {
    zustand.sicherungMeldung = { art: 'fehler', text: t(speicherCode(fehler, 'sicherung.importFehler')) };
  }
  zurStartseite();
}

/** Fortschritt je Thema und Schwächenliste (M5). */
function zurStatistik() {
  const { modul, lernstand } = zustand;
  zeigeStatistik(hauptbereich, {
    modul,
    fortschritt: fortschrittJeThema(modul, lernstand),
    schwaechen: schwaechenliste(modul, lernstand),
    pruefstand: pruefstandJeThema(modul, zustand.pruefstatus),
    onZurueck: zurStartseite,
    onThema: (id) => { waehleThema(id); zurStartseite(); },
  });
}

/**
 * Prüfungssimulation (M6, F-20). Sie ändert weder Leitner-Fächer noch XP oder Tagesziel;
 * erst das anschließende Üben der Fehler wirkt wie „Fehler gleich wiederholen“.
 */
function zurPruefung() {
  const { modul } = zustand;
  zeigePruefung(hauptbereich, {
    modul,
    regeln: pruefungsregeln(modul),
    bildeBogen: () => bildePruefbogen(modul),
    onZurueck: zurStartseite,
    onFehlerUeben: (fragen) => starteRunde('fehler', fragen),
    holePruefstatus: () => zustand.pruefstatus,
    onPruefstatus: pruefknopf(),
    // Antworten der Simulation werden gespeichert (F-43), ändern aber weder Fächer noch XP.
    onAntworten: (liste) => liste.forEach(({ frage, richtig, antwort }) => speichereAntwort(frage, richtig, 'simulation', antwort)),
    onSichern: sichernKnopf(),
  });
}

/**
 * Rechenaufgaben aus freigegebenen Generatoren (M9, F-28) kommen wie Fragen ins Modul;
 * gesperrte Generatoren bleiben draußen. Zu Beginn jeder Runde gibt es neue Zahlenwerte.
 */
function mitAufgaben(modul) {
  return mitGeneratoren(modul, { zahlText: zahltext });
}

/**
 * @param {'normal'|'vorziehen'|'fehler'} modus
 * @param {object[]} [fragen] feste Fragen (nur für „fehler“ nach der Prüfungssimulation)
 */
function starteRunde(modus, fragen) {
  const { modul } = zustand;
  const bilde = modus === 'vorziehen' ? bildeVorgezogeneRunde : bildeRunde;
  zeigeRunde(hauptbereich, {
    fragen: fragen ?? erneuere(bilde(modul, zustand.lernstand, heute(), { thema: zustand.thema }), modul, { zahlText: zahltext }),
    modus,
    modul,
    themenTitel: new Map(modul.themen.map((thema) => [thema.id, thema.titel])),
    onBewertung: (frage, richtig, uebung, rundenModus, antwort) => {
      zustand.leererStart = false;
      zustand.lernstand = bewerte(zustand.lernstand, frage.id, richtig, heute(), { uebung });
      speichere();
      speichereAntwort(frage, richtig, rundenModus, antwort);
      return aendereProfil((profil) => vergibAntwort(profil, { richtig, modus: rundenModus }, heute())).xp;
    },
    onRundenende: (runde) => {
      const { zaehlt, bonus } = aendereProfil((profil) => schliesseRundeAb(profil, runde, heute()));
      const f = fortschritt(zustand.profil, heute());
      // XP vor der Runde: so zeigt das Rundenende einen Rang, der in dieser Runde erreicht wurde.
      const aufstieg = aufstiegVon(Math.max(f.xp - runde.xp - bonus, 0), f.xp, modul.raenge);
      return { zaehlt, bonus, fortschritt: f, hinweis: startHinweis(zustand.profil, heute()), aufstieg };
    },
    holeFaecher: () => lernUebersicht(modul, zustand.lernstand, heute(), { thema: zustand.thema }).faecher,
    onFertig: zurStartseite,
    holePruefstatus: () => zustand.pruefstatus,
    onPruefstatus: pruefknopf(),
    onSichern: sichernKnopf(),
  });
}

/** Speichert den Lernstand des geladenen Moduls und übernimmt Antworten aus anderen Tabs. */
async function speichere() {
  const { speicher, modul } = zustand;
  if (!speicher || !modul) return;
  try {
    const gespeichert = await speicher.speichere(modul.meta.id, zustand.lernstand);
    // Mit dem aktuellen Stand zusammenführen: Während des Speicherns kann schon die nächste Antwort gekommen sein.
    if (zustand.modul === modul) zustand.lernstand = fuehreZusammen(zustand.lernstand, gespeichert);
    zustand.speicherFehler = null;
  } catch (fehler) {
    zustand.speicherFehler = speicherCode(fehler, 'speicher.schreibfehler');
  }
}

/** Lädt den gespeicherten Lernstand zum gerade geladenen Modul. */
async function ladeLernstand() {
  Object.assign(zustand, {
    lernstand: neuerLernstand(), verworfen: 0, pruefstatus: neuerPruefstatus(),
    thema: zustand.modul ? ladeThema(zustand.modul) : null,
  });
  const { speicher, modul } = zustand;
  if (!speicher || !modul) return;
  try {
    const { lernstand, verworfen } = await speicher.lade(modul.meta.id);
    const geprueft = await speicher.ladePruefstatus(modul.meta.id);
    Object.assign(zustand, { lernstand, verworfen: verworfen + geprueft.verworfen, pruefstatus: geprueft.pruefstatus });
  } catch (fehler) {
    // Nicht speichern, damit ein unlesbarer oder neuerer Stand nicht überschrieben wird.
    Object.assign(zustand, { speicher: null, speicherFehler: speicherCode(fehler, 'speicher.lesefehler') });
  }
}

/** Lädt XP, Streak und Tagesziel. Ein unlesbares Profil wird nicht überschrieben. */
async function ladeProfil() {
  if (!zustand.speicher) return;
  try {
    const { profil, verworfen } = await zustand.speicher.ladeProfil();
    zustand.profil = profil;
    zustand.profilVerworfen = verworfen;
  } catch (fehler) {
    Object.assign(zustand, { profilSpeichern: false, profilFehler: speicherCode(fehler, 'speicher.lesefehler') });
  }
}

/** Prüft beim Start, ob weder Lernstand noch XP gespeichert sind (F-42). */
async function pruefeLeererStart() {
  if (!zustand.speicher) return;
  try {
    zustand.leererStart = istLeereSicherung(await zustand.speicher.ladeSicherung());
  } catch {
    zustand.leererStart = false; // Ein unlesbarer Stand ist nicht leer; dazu gibt es eigene Hinweise.
  }
}

async function ladeStandard() {
  statuszeile.textContent = t('status.laedt');
  try {
    Object.assign(zustand, { modul: mitAufgaben(await ladeModulAusUrl(STANDARDMODUL)), fehler: null, dateiname: '' });
  } catch (fehler) {
    Object.assign(zustand, { modul: null, fehler, dateiname: '' });
  }
  await ladeLernstand();
  zurStartseite();
  zeigeStatus();
}

async function ladeDatei(datei) {
  try {
    Object.assign(zustand, { modul: mitAufgaben(await ladeModulAusDatei(datei)), fehler: null, dateiname: datei.name });
  } catch (fehler) {
    Object.assign(zustand, { modul: null, fehler, dateiname: '' });
  }
  await ladeLernstand();
  zurStartseite();
}

function zeigeTitel() {
  document.title = t('app.titel');
  document.getElementById('titel').textContent = t('app.titel');
}

async function start() {
  await ladeTexte(bevorzugteSprache());
  zeigeTitel();

  window.addEventListener('online', zeigeStatus);
  window.addEventListener('offline', zeigeStatus);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', zeigeStatus);
  }

  try {
    zustand.speicher = await oeffneSpeicher();
    zustand.dauerhaft = await bitteUmDauerhaftenSpeicher();
  } catch (fehler) {
    zustand.speicherFehler = speicherCode(fehler, 'speicher.nichtVerfuegbar');
  }
  await ladeProfil();
  await pruefeLeererStart();

  await ladeStandard();
}

start();
