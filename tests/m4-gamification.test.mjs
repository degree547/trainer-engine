// Tests für M4 Gamification: XP (F-12), Streak und Tagesziel (F-13), Level (F-14),
// Kennzahlen am Rundenende (F-15), Hinweis beim Start, Zusammenführen zweier Profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neuesProfil, vergibAntwort, schliesseRundeAb, setzeTagesziel, gesamtXp, levelVon, levelStart,
  streakVon, startHinweis, fortschritt, pruefeProfil, fuehreProfileZusammen, ProfilFehler,
  XP_RICHTIG, XP_RICHTIG_FEHLER, XP_BONUS, TAGESZIEL_MAX,
} from '../src/engine/m4-gamification.js';

const HEUTE = '2026-11-22';

/** Spielt eine Runde mit `richtig` richtigen von `gesamt` Antworten. */
function runde(profil, heute, { richtig = 10, gesamt = 10, modus = 'normal', beantwortet = gesamt } = {}) {
  let p = profil;
  let xp = 0;
  for (let i = 0; i < beantwortet; i += 1) {
    const r = vergibAntwort(p, { richtig: i < richtig, modus }, heute);
    p = r.profil;
    xp += r.xp;
  }
  const ende = schliesseRundeAb(p, { modus, beantwortet, gesamt, fehler: beantwortet - Math.min(richtig, beantwortet) }, heute);
  return { profil: ende.profil, xp: xp + ende.bonus, ...ende };
}

test('F-12: XP je richtiger Antwort, keine für falsche', () => {
  const p = neuesProfil('a');
  assert.equal(vergibAntwort(p, { richtig: true, modus: 'normal' }, HEUTE).xp, XP_RICHTIG);
  assert.equal(vergibAntwort(p, { richtig: true, modus: 'vorziehen' }, HEUTE).xp, XP_RICHTIG);
  assert.equal(vergibAntwort(p, { richtig: true, modus: 'fehler' }, HEUTE).xp, XP_RICHTIG_FEHLER);
  const falsch = vergibAntwort(p, { richtig: false, modus: 'normal' }, HEUTE);
  assert.equal(falsch.xp, 0);
  assert.equal(falsch.profil, p);
  assert.equal(gesamtXp(vergibAntwort(p, { richtig: true, modus: 'normal' }, HEUTE).profil), XP_RICHTIG);
  assert.deepEqual(p.geraete, {}, 'das alte Profil bleibt unverändert');
});

test('F-12: Bonus nur für eine vollständige Runde ohne Fehler', () => {
  const p = neuesProfil('a');
  const fehlerfrei = runde(p, HEUTE);
  assert.equal(fehlerfrei.bonus, XP_BONUS);
  assert.equal(gesamtXp(fehlerfrei.profil), 10 * XP_RICHTIG + XP_BONUS);
  assert.equal(runde(p, HEUTE, { richtig: 9 }).bonus, 0);
  assert.equal(runde(p, HEUTE, { richtig: 5, beantwortet: 5 }).bonus, 0, 'abgebrochen');
  assert.equal(runde(p, HEUTE, { modus: 'fehler', gesamt: 2 }).bonus, 0, 'Fehler-Wiederholung');
  assert.equal(runde(p, HEUTE, { gesamt: 3 }).bonus, XP_BONUS, 'auch kürzere Runden am Ende des Katalogs');
});

test('F-13: Was als Runde für das Tagesziel zählt', () => {
  const p = neuesProfil('a');
  assert.equal(runde(p, HEUTE).zaehlt, true);
  assert.equal(runde(p, HEUTE, { modus: 'vorziehen', richtig: 3 }).zaehlt, true);
  assert.equal(runde(p, HEUTE, { beantwortet: 9 }).zaehlt, false, 'mit „Beenden“ abgebrochen');
  assert.equal(runde(p, HEUTE, { modus: 'fehler', gesamt: 3 }).zaehlt, false);
  assert.equal(schliesseRundeAb(p, { modus: 'normal', beantwortet: 0, gesamt: 0, fehler: 0 }, HEUTE).zaehlt, false);
  // XP aus einer abgebrochenen Runde bleiben.
  assert.equal(gesamtXp(runde(p, HEUTE, { beantwortet: 4 }).profil), 4 * XP_RICHTIG);
});

test('F-13: Streak zählt Tage in Folge mit erreichtem Tagesziel', () => {
  let p = neuesProfil('a');
  assert.deepEqual(streakVon(p, HEUTE), { tage: 0, heuteErreicht: false, heuteRunden: 0, ziel: 1, gelernt: false });
  for (const tag of ['2026-11-19', '2026-11-20', '2026-11-21']) p = runde(p, tag).profil;
  // Heute noch offen: Streak von gestern bleibt stehen.
  assert.equal(streakVon(p, HEUTE).tage, 3);
  assert.equal(streakVon(p, HEUTE).heuteErreicht, false);
  p = runde(p, HEUTE).profil;
  assert.equal(streakVon(p, HEUTE).tage, 4);
  assert.equal(streakVon(p, HEUTE).heuteErreicht, true);
  // Ein ausgelassener Tag beendet den Streak.
  assert.equal(streakVon(p, '2026-11-24').tage, 0);
  // Über den Monatswechsel.
  let q = neuesProfil('a');
  for (const tag of ['2026-11-30', '2026-12-01']) q = runde(q, tag).profil;
  assert.equal(streakVon(q, '2026-12-01').tage, 2);
});

test('F-13: Tagesziel einstellbar, mehr Runden erlaubt', () => {
  let p = setzeTagesziel(neuesProfil('a'), 2, HEUTE, 1);
  assert.equal(p.tagesziel.wert, 2);
  p = runde(p, HEUTE).profil;
  assert.equal(streakVon(p, HEUTE).heuteErreicht, false);
  assert.equal(startHinweis(p, HEUTE).werte.offen, 1);
  p = runde(p, HEUTE).profil;
  assert.equal(streakVon(p, HEUTE).heuteErreicht, true);
  p = runde(p, HEUTE).profil;
  assert.equal(streakVon(p, HEUTE).heuteRunden, 3);
  assert.equal(setzeTagesziel(p, 0, HEUTE).tagesziel.wert, 1);
  assert.equal(setzeTagesziel(p, 99, HEUTE).tagesziel.wert, TAGESZIEL_MAX);
});

test('F-13: Ein höheres Tagesziel ändert frühere Tage nicht, gilt aber sofort für heute', () => {
  let p = neuesProfil('a');
  p = runde(p, '2026-11-21').profil;
  p = runde(p, HEUTE).profil;
  p = setzeTagesziel(p, 2, HEUTE, 5);
  const s = streakVon(p, HEUTE);
  assert.equal(s.heuteErreicht, false);
  assert.equal(s.tage, 1, 'gestern bleibt mit dem damaligen Ziel erreicht');
  p = setzeTagesziel(p, 1, HEUTE, 6);
  assert.equal(streakVon(p, HEUTE).tage, 2);
});

test('F-14: Level mit Fortschritt', () => {
  assert.equal(levelStart(1), 0);
  assert.equal(levelStart(2), 100);
  assert.equal(levelStart(3), 250);
  assert.equal(levelStart(4), 450);
  assert.deepEqual(levelVon(0), { level: 1, imLevel: 0, fuerNaechstes: 100, anteil: 0 });
  assert.deepEqual(levelVon(99), { level: 1, imLevel: 99, fuerNaechstes: 100, anteil: 0.99 });
  assert.equal(levelVon(100).level, 2);
  assert.deepEqual(levelVon(175), { level: 2, imLevel: 75, fuerNaechstes: 150, anteil: 0.5 });
  assert.equal(levelVon(250).level, 3);
});

test('F-15: Kennzahlen für das Rundenende', () => {
  const p = runde(neuesProfil('a'), HEUTE).profil;
  const f = fortschritt(p, HEUTE);
  assert.equal(f.xp, 120);
  assert.equal(f.level.level, 2);
  assert.equal(f.streak.tage, 1);
});

test('Hinweis beim Start', () => {
  let p = neuesProfil('a');
  assert.equal(startHinweis(p, HEUTE).code, 'hinweis.ersteRunde');
  p = runde(p, '2026-11-21').profil;
  assert.deepEqual(startHinweis(p, HEUTE), { code: 'hinweis.streakEndet', werte: { tage: 1, offen: 1 } });
  assert.equal(startHinweis(p, '2026-11-25').code, 'hinweis.neuerStreak');
  assert.deepEqual(startHinweis(runde(p, HEUTE).profil, HEUTE), { code: 'hinweis.zielErreicht', werte: { tage: 2 } });
  const halb = runde(setzeTagesziel(neuesProfil('a'), 2, HEUTE), HEUTE).profil;
  assert.deepEqual(startHinweis(halb, HEUTE), { code: 'hinweis.nochOffen', werte: { offen: 1 } });
});

test('Profile zweier Geräte werden ohne Doppelzählung zusammengeführt', () => {
  const a = runde(neuesProfil('a'), HEUTE).profil;
  const b = runde(runde(neuesProfil('b'), '2026-11-21').profil, HEUTE, { richtig: 5 }).profil;
  const zusammen = fuehreProfileZusammen(a, b);
  assert.equal(zusammen.geraet, 'a');
  assert.equal(gesamtXp(zusammen), gesamtXp(a) + gesamtXp(b));
  assert.equal(streakVon(zusammen, HEUTE).tage, 2);
  assert.equal(streakVon(zusammen, HEUTE).heuteRunden, 2);
  // Dieselbe Datei zweimal importiert: nichts doppelt.
  assert.deepEqual(fuehreProfileZusammen(zusammen, b), zusammen);
  // Je Gerät und Tag gilt der größere Stand (z. B. zwei Tabs).
  const weiter = runde(a, HEUTE).profil;
  assert.equal(gesamtXp(fuehreProfileZusammen(a, weiter)), gesamtXp(weiter));
});

test('Tagesziel: der jüngere Stand gewinnt beim Zusammenführen', () => {
  const a = setzeTagesziel(neuesProfil('a'), 2, HEUTE, 10);
  const b = setzeTagesziel(neuesProfil('b'), 3, HEUTE, 20);
  assert.equal(fuehreProfileZusammen(a, b).tagesziel.wert, 3);
  assert.equal(fuehreProfileZusammen(b, a).tagesziel.wert, 3);
});

test('Profil prüfen: leer, gültig, beschädigt, neuere Version', () => {
  const neu = pruefeProfil(undefined);
  assert.equal(neu.verworfen, 0);
  assert.equal(typeof neu.profil.geraet, 'string');
  assert.ok(neu.profil.geraet.length > 0);

  const p = runde(neuesProfil('a'), HEUTE).profil;
  assert.deepEqual(pruefeProfil(structuredClone(p)), { profil: p, verworfen: 0 });

  const kaputt = structuredClone(p);
  kaputt.geraete.a['2026-11-23'] = { xp: -5, runden: 1 };
  kaputt.geraete.a['gestern'] = { xp: 1, runden: 0 };
  kaputt.geraete.x = 'quatsch';
  kaputt.tagesziel = { wert: 17 };
  const geprueft = pruefeProfil(kaputt);
  assert.equal(geprueft.verworfen, 3);
  assert.deepEqual(Object.keys(geprueft.profil.geraete.a), [HEUTE]);
  assert.equal(geprueft.profil.tagesziel.wert, 1);

  assert.throws(() => pruefeProfil({ ...p, version: 99 }), (f) => f instanceof ProfilFehler && f.code === 'speicher.neuereVersion');
  assert.throws(() => pruefeProfil({ version: 1 }), (f) => f.code === 'speicher.profilUnlesbar');
});
