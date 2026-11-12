# Arbeitsdateien für den Import des SKS-Katalogs

Aus diesen Dateien und dem amtlichen PDF erzeugt `node tools/import-sks.mjs` das Inhaltsmodul `content/sks/sks.json`.
Die Moduldatei wird nie von Hand bearbeitet. Korrekturen kommen hierher, dann wird der Import neu gestartet.

| Datei | Inhalt |
| --- | --- |
| `korrekturen.json` | Handkorrekturen je Frage-ID: `frage`, `musterantwort`, `hinweis` (`"bild"` = Standardtext für fehlende Abbildung, `""` = kein Hinweis) und `grund`. Ein Eintrag ohne Änderung bedeutet, dass die Trennung von Frage und Antwort von Hand geprüft wurde. |
| `kernpunkte-<bereich>.json` | Kernpunkte je Frage-ID, aus den amtlichen Musterantworten abgeleitet. Status im Modul: „ungeprüft“. |

Ablauf bei Änderungen:

1. Datei hier ändern.
2. `node tools/import-sks.mjs` ausführen. Das Skript prüft die Fragenzahl je Bereich und das Format (M8) und schreibt das Modul nur, wenn alles stimmt.
3. `node --test` ausführen. Ein Test vergleicht den Neu-Import mit der gespeicherten Moduldatei.
4. In `sw.js` die Cache-Version erhöhen, damit Geräte den neuen Stand laden.

Voraussetzung für den Import ist `pdftotext` (Poppler). Es liegt Git für Windows bei. Die App selbst braucht es nicht.
