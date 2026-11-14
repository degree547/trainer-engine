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
  oeffneSpeicher, bitteUmDauerhaftenSpeicher, fuehreZusammen, SpeicherFehler, freitextEintrag,
  pruefeSicherung, dateinameSicherung,
} from './engine/m7-speicherung.js';
import { fortschrittJeThema, schwaechenliste } from './engine/m5-statistik.js';
import { ladeTexte, t, bevorzugteSprache, merkeSprache, sprache } from './ui/i18n.js';
import { zeigeStart } from './ui/start.js';
import { zeigeRunde } from './ui/runde.js';
import { zeigeStatistik } from './ui/statistik.js';

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

/** Speichert eine getippte Freitext-Antwort mit Selbstbewertung (F-34). */
function speichereFreitext(frage, text, gewusst, modus) {
  const { speicher, modul } = zustand;
  if (!speicher || !modul) return;
  speicher.speichereAntwort(freitextEintrag({ modul: modul.meta.id, frage: frage.id, text, gewusst, modus }))
    .catch((fehler) => { zustand.speicherFehler = speicherCode(fehler, 'speicher.schreibfehler'); });
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
    einstellungen: {
      sprache: sprache(),
      onSprache: wechsleSprache,
      sicherung: { verfuegbar: zustand.speicher != null, letzte: letzteSicherung(), meldung: zustand.sicherungMeldung },
      onExport: exportiereSicherung,
      onImport: importiereSicherung,
    },
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

/** Speichert die Sicherungsdatei auf dem Gerät (F-22). */
async function exportiereSicherung() {
  try {
    const inhalt = await zustand.speicher.ladeSicherung();
    const name = dateinameSicherung(heute());
    const url = URL.createObjectURL(new Blob([JSON.stringify(inhalt, null, 1)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    try { localStorage.setItem(SICHERUNG_SCHLUESSEL, heute()); } catch { /* nur ein Hinweis */ }
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
    onZurueck: zurStartseite,
    onThema: (id) => { waehleThema(id); zurStartseite(); },
  });
}

function starteRunde(modus) {
  const { modul } = zustand;
  const bilde = modus === 'vorziehen' ? bildeVorgezogeneRunde : bildeRunde;
  zeigeRunde(hauptbereich, {
    fragen: bilde(modul, zustand.lernstand, heute(), { thema: zustand.thema }),
    modus,
    modul,
    themenTitel: new Map(modul.themen.map((thema) => [thema.id, thema.titel])),
    onBewertung: (frage, richtig, uebung, rundenModus, antwort) => {
      zustand.lernstand = bewerte(zustand.lernstand, frage.id, richtig, heute(), { uebung });
      speichere();
      if (frage.typ === 'freitext') speichereFreitext(frage, antwort, richtig, rundenModus);
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
  Object.assign(zustand, { lernstand: neuerLernstand(), verworfen: 0, thema: zustand.modul ? ladeThema(zustand.modul) : null });
  const { speicher, modul } = zustand;
  if (!speicher || !modul) return;
  try {
    const { lernstand, verworfen } = await speicher.lade(modul.meta.id);
    Object.assign(zustand, { lernstand, verworfen });
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

async function ladeStandard() {
  statuszeile.textContent = t('status.laedt');
  try {
    Object.assign(zustand, { modul: await ladeModulAusUrl(STANDARDMODUL), fehler: null, dateiname: '' });
  } catch (fehler) {
    Object.assign(zustand, { modul: null, fehler, dateiname: '' });
  }
  await ladeLernstand();
  zurStartseite();
  zeigeStatus();
}

async function ladeDatei(datei) {
  try {
    Object.assign(zustand, { modul: await ladeModulAusDatei(datei), fehler: null, dateiname: datei.name });
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

  await ladeStandard();
}

start();
