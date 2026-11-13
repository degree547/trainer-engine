// Einstieg der App: Texte laden, Service Worker registrieren, Standardmodul laden,
// zwischen Startseite und Runde wechseln.

import { ladeModulAusUrl, ladeModulAusDatei } from './engine/m1-kern.js';
import {
  neuerLernstand, bewerte, bildeRunde, bildeVorgezogeneRunde, lernUebersicht, datumVon,
} from './engine/m2-lernlogik.js';
import {
  neuesProfil, vergibAntwort, schliesseRundeAb, setzeTagesziel, fortschritt, startHinweis,
} from './engine/m4-gamification.js';
import {
  oeffneSpeicher, bitteUmDauerhaftenSpeicher, fuehreZusammen, SpeicherFehler,
} from './engine/m7-speicherung.js';
import { ladeTexte, t } from './ui/i18n.js';
import { zeigeStart } from './ui/start.js';
import { zeigeRunde } from './ui/runde.js';

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
};

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

function zurStartseite() {
  const { modul, fehler, dateiname, lernstand } = zustand;
  zeigeStart(hauptbereich, {
    modul, fehler, dateiname,
    lernen: modul ? lernUebersicht(modul, lernstand, heute()) : null,
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
  });
  window.scrollTo(0, 0);
}

function starteRunde(modus) {
  const { modul } = zustand;
  const bilde = modus === 'vorziehen' ? bildeVorgezogeneRunde : bildeRunde;
  zeigeRunde(hauptbereich, {
    fragen: bilde(modul, zustand.lernstand, heute()),
    modus,
    modul,
    themenTitel: new Map(modul.themen.map((thema) => [thema.id, thema.titel])),
    onBewertung: (frage, richtig, uebung, rundenModus) => {
      zustand.lernstand = bewerte(zustand.lernstand, frage.id, richtig, heute(), { uebung });
      speichere();
      return aendereProfil((profil) => vergibAntwort(profil, { richtig, modus: rundenModus }, heute())).xp;
    },
    onRundenende: (runde) => {
      const { zaehlt, bonus } = aendereProfil((profil) => schliesseRundeAb(profil, runde, heute()));
      return { zaehlt, bonus, fortschritt: fortschritt(zustand.profil, heute()), hinweis: startHinweis(zustand.profil, heute()) };
    },
    holeFaecher: () => lernUebersicht(modul, zustand.lernstand, heute()).faecher,
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
  Object.assign(zustand, { lernstand: neuerLernstand(), verworfen: 0 });
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

async function start() {
  await ladeTexte('de');
  document.title = t('app.titel');
  document.getElementById('titel').textContent = t('app.titel');

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
