# Trainer Engine – Arbeitsanweisungen für Claude Code

## Projekt

Modulare Lern-App (PWA) mit Wiederholungssystem und Gamification. Die Engine enthält keine Prüfungsinhalte; Inhalte kommen als austauschbare JSON-Module. Erstes Inhaltsmodul: SKS (Sportküstenschifferschein) auf Basis des amtlichen Fragenkatalogs mit den offiziellen Antworten (ELWIS).

* Anforderungen: `docs/lastenheft.md` (Anforderungs-IDs F-01 bis F-32)
* Reihenfolge und Meilensteine: `docs/projektplan.md` (Arbeitspakete AP1 bis AP11)
* Bei Widersprüchen gilt das Lastenheft für den Inhalt, der Projektplan für die Reihenfolge. Im Zweifel nachfragen.
* Sprache der Oberfläche: Deutsch und Englisch umschaltbar (gilt vor der älteren Zeile „Oberfläche auf Deutsch“ im Lastenheft).

## Der Nutzer

Jurist, kein Entwickler, hat bisher nicht mit Git oder GitHub gearbeitet.

* Git-Befehle selbst ausführen und jeden Schritt in einem Satz erklären.
* Nie Dateien löschen, Historie umschreiben oder force-pushen, ohne vorher zu fragen.
* Am Ende jeder Sitzung sagen, was der Nutzer im Browser oder auf dem Smartphone prüfen soll.

## Arbeitsweise

1. Ein Arbeitspaket pro Sitzung, in der Reihenfolge des Projektplans.
2. Zu Beginn: AP nennen, zugehörige Anforderungs-IDs auflisten, kurzen Plan zeigen und Bestätigung abwarten.
3. Nur umsetzen, was zum aktuellen AP gehört. Ideen außerhalb davon in `docs/ideen.md` notieren, nicht bauen.
4. Zum Abschluss: Tests ausführen, im Projektplan den Status des AP vermerken, Commit mit der Nachricht `AP<n>: <kurze Beschreibung>`.
5. Ab dem 21.12.2026 gilt Feature-Stopp: nur noch Fehlerbehebung.

## Technische Regeln

* Reines HTML, CSS und JavaScript (ES-Module). Kein Framework, kein Build-Schritt, keine Laufzeit-Abhängigkeiten, keine CDNs.
* Node.js nur für Entwicklungswerkzeuge: Tests mit `node --test` und ein lokaler Testserver in `tools/serve.mjs` (nur `node:http`, keine Pakete).
* Jedes Engine-Modul ist eine eigene Datei. Module kennen keine Prüfungsinhalte.
* Frage-IDs sind stabil und folgen der amtlichen Nummerierung (z. B. `sks-nav-001`), damit der Lernstand Updates übersteht (F-23).
* Lernstand in IndexedDB mit versioniertem Schema; Export und Import als JSON-Datei (F-22).
* Alle Oberflächentexte in `src/i18n/de.json` und `src/i18n/en.json`.
* Mobile first, einhändig bedienbar, Hell- und Dunkelmodus.
* Keine Tracker, keine externen Dienste.
* Die App läuft auf GitHub Pages unter `/trainer-engine/`: alle Pfade relativ halten.
* Service Worker: Cache-Version bei jeder inhaltlichen Änderung erhöhen.

## Ordnerstruktur

```
index.html
manifest.webmanifest
sw.js
src/engine/   m1-kern.js, m2-lernlogik.js, m3-fragetypen.js, m4-gamification.js,
              m5-statistik.js, m6-pruefung.js, m7-speicherung.js,
              m8-inhaltsformat.js, m9-generatoren.js
src/ui/       Bildschirme (Start, Runde, Auswertung, Statistik)
src/i18n/     de.json, en.json
content/sks/  amtlicher Katalog als JSON
privat/       Buchinhalte – steht in .gitignore, wird nie committet
tests/
tools/        serve.mjs, Import-Skripte
docs/         lastenheft.md, projektplan.md, ideen.md
```

AP1 legt als Erstes eine `.gitignore` an mit mindestens: `privat/`, `node\_modules/`, `.DS\_Store`, `Thumbs.db`.

## Inhalte und Recht

* Das Repo ist öffentlich (GitHub Pages im kostenlosen Plan).
* Der amtliche SKS-Fragenkatalog mit den offiziellen Antworten darf genutzt werden. Stand des Katalogs im Modul vermerken, Herkunft „amtlich“.
* Inhalte aus dem Buch (Delius Klasing) nur in `privat/` und nur als lokaler Import auf dem Gerät. Nie committen, nie hosten.
* Kernpunkte, die aus offiziellen Antworten abgeleitet werden, tragen den Status „ungeprüft“, bis der Nutzer sie prüft.
* Navigationsgeneratoren (Kurs, Peilung, Missweisung, Deviation, Wind- und Stromversatz) erst freigeben, wenn Tests gegen Beispielaufgaben mit bekannter Lösung grün sind. Bei Unsicherheit über Formeln oder Vorzeichenregeln nachfragen, nicht raten.

