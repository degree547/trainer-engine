// Einstieg der App: Texte laden, Service Worker registrieren, Standardmodul laden,
// zwischen Startseite und Runde wechseln.

import { ladeModulAusUrl, ladeModulAusDatei } from './engine/m1-kern.js';
import {
  neuerLernstand, bewerte, bildeRunde, bildeVorgezogeneRunde, lernUebersicht, datumVon,
} from './engine/m2-lernlogik.js';
import { ladeTexte, t } from './ui/i18n.js';
import { zeigeStart } from './ui/start.js';
import { zeigeRunde } from './ui/runde.js';

// Welches Inhaltsmodul beim Start geladen wird (amtlicher SKS-Katalog, AP2).
const STANDARDMODUL = 'content/sks/sks.json';

const hauptbereich = document.getElementById('app');
const statuszeile = document.getElementById('status');

// Zustand der App. Der Lernstand lebt bis AP5 nur im Speicher.
const zustand = { modul: null, fehler: null, dateiname: '', lernstand: neuerLernstand() };

function zeigeStatus() {
  const offlineBereit = navigator.serviceWorker?.controller != null;
  const text = navigator.onLine ? t('status.online') : t('status.offline');
  statuszeile.textContent = offlineBereit && navigator.onLine ? `${text} · ${t('status.offlineBereit')}` : text;
  statuszeile.dataset.online = String(navigator.onLine);
}

function heute() {
  return datumVon(new Date());
}

function zurStartseite() {
  const { modul, fehler, dateiname, lernstand } = zustand;
  zeigeStart(hauptbereich, {
    modul, fehler, dateiname,
    lernen: modul ? lernUebersicht(modul, lernstand, heute()) : null,
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
    onBewertung: (frage, richtig, uebung) => {
      zustand.lernstand = bewerte(zustand.lernstand, frage.id, richtig, heute(), { uebung });
    },
    holeFaecher: () => lernUebersicht(modul, zustand.lernstand, heute()).faecher,
    onFertig: zurStartseite,
  });
}

async function ladeStandard() {
  statuszeile.textContent = t('status.laedt');
  try {
    Object.assign(zustand, { modul: await ladeModulAusUrl(STANDARDMODUL), fehler: null, dateiname: '' });
  } catch (fehler) {
    Object.assign(zustand, { modul: null, fehler, dateiname: '' });
  }
  zurStartseite();
  zeigeStatus();
}

async function ladeDatei(datei) {
  try {
    Object.assign(zustand, { modul: await ladeModulAusDatei(datei), fehler: null, dateiname: datei.name });
  } catch (fehler) {
    Object.assign(zustand, { modul: null, fehler, dateiname: '' });
  }
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

  await ladeStandard();
}

start();
