// Einstieg der App: Texte laden, Service Worker registrieren, Standardmodul laden.

import { ladeModulAusUrl, ladeModulAusDatei } from './engine/m1-kern.js';
import { ladeTexte, t } from './ui/i18n.js';
import { zeigeStart } from './ui/start.js';

// Welches Inhaltsmodul beim Start geladen wird (amtlicher SKS-Katalog, AP2).
const STANDARDMODUL = 'content/sks/sks.json';

const hauptbereich = document.getElementById('app');
const statuszeile = document.getElementById('status');

function zeigeStatus() {
  const offlineBereit = navigator.serviceWorker?.controller != null;
  const text = navigator.onLine ? t('status.online') : t('status.offline');
  statuszeile.textContent = offlineBereit && navigator.onLine ? `${text} · ${t('status.offlineBereit')}` : text;
  statuszeile.dataset.online = String(navigator.onLine);
}

function rendere(zustand) {
  zeigeStart(hauptbereich, { ...zustand, onDatei: ladeDatei, onStandard: ladeStandard });
}

async function ladeStandard() {
  statuszeile.textContent = t('status.laedt');
  try {
    rendere({ modul: await ladeModulAusUrl(STANDARDMODUL) });
  } catch (fehler) {
    rendere({ fehler });
  }
  zeigeStatus();
}

async function ladeDatei(datei) {
  try {
    rendere({ modul: await ladeModulAusDatei(datei), dateiname: datei.name });
  } catch (fehler) {
    rendere({ fehler });
  }
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
