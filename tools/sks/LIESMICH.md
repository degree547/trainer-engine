# Arbeitsdateien für den Import des SKS-Katalogs

Aus diesen Dateien und dem amtlichen PDF erzeugt `node tools/import-sks.mjs` das Inhaltsmodul `content/sks/sks.json`.
Die Moduldatei wird nie von Hand bearbeitet. Korrekturen kommen hierher, dann wird der Import neu gestartet.

| Datei | Inhalt |
| --- | --- |
| `korrekturen.json` | Handkorrekturen je Frage-ID: `frage`, `musterantwort`, `hinweis` (`"bild"` = Standardtext für fehlende Abbildung, `""` = kein Hinweis) und `grund`. Ein Eintrag ohne Änderung bedeutet, dass die Trennung von Frage und Antwort von Hand geprüft wurde. |
| `kernpunkte-<bereich>.json` | Kernpunkte je Frage-ID, aus den amtlichen Musterantworten abgeleitet. Status im Modul: „ungeprüft“. |
| `raenge.json` | Die zwölf nautischen Ränge (F-36, F-37): `ab` (Level), `name`, optional `bild` (Pfad relativ zur App). Ohne `bild` zeigt die App einen Platzhalter. |

Ablauf bei Änderungen:

1. Datei hier ändern.
2. `node tools/import-sks.mjs` ausführen. Das Skript prüft die Fragenzahl je Bereich und das Format (M8) und schreibt das Modul nur, wenn alles stimmt.
3. `node --test` ausführen. Ein Test vergleicht den Neu-Import mit der gespeicherten Moduldatei.
4. In `sw.js` die Cache-Version erhöhen, damit Geräte den neuen Stand laden.

## Rangbilder (F-38, optional)

Die Anforderungen stehen im Lastenheft unter „Anforderungen an die Rangbilder“. Kurz: zwölf quadratische Bilder im selben Stil, rund beschnitten noch gut erkennbar, ohne Schrift, für Hell- und Dunkelmodus, SVG oder PNG/WebP mit 256 × 256 Pixeln, höchstens 30 KB je Bild, keine Kopien echter Abzeichen.

Vorlage für den Auftrag an Copilot:

> Erstelle eine Serie von zwölf Rang-Abzeichen für eine Lern-App zum Sportküstenschifferschein, als runde Icons im flachen, einheitlichen Stil. Quadratisch, Motiv mittig, transparenter Hintergrund, keine Schrift, gut erkennbar bei 40 Pixeln, kontrastreich auf hellem und dunklem Hintergrund. Keine echten Dienstgradabzeichen nachbilden. Der Aufstieg soll von Bild zu Bild sichtbar werden (zum Beispiel mehr Streifen, dann Sterne). Ränge in dieser Reihenfolge: Süßwassermatrose, Schiffsjunge, Leichtmatrose, Matrose, Vollmatrose, Bootsmann, Steuermann, Zweiter Offizier, Erster Offizier, Kapitän, Konteradmiral, Admiral.

Einbau (AP6B, Claude Code):

1. Bilder als `content/sks/raenge/01-suesswassermatrose.svg` bis `12-admiral.svg` ablegen (oder `.png`/`.webp`), Herkunft in `content/sks/raenge/HERKUNFT.md` vermerken.
2. In `raenge.json` je Rang `"bild": "content/sks/raenge/…"` eintragen und den Import neu starten.
3. Die Bilder in `sw.js` unter `DATEIEN` eintragen und die Cache-Version erhöhen, damit sie offline verfügbar sind.

## Voraussetzung

Voraussetzung für den Import ist `pdftotext` (Poppler). Es liegt Git für Windows bei. Die App selbst braucht es nicht.
