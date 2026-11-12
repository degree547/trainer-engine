# Projektplan Trainer Engine

Nov 12, 2026 · @Alex

## Ziel und Rahmen

Version 1 ist am 20.12.2026 fertig, gelernt wird aber schon ab dem 22.11.2026 mit dem amtlichen Fragenkatalog. Danach gilt ein Feature-Stopp bis zur Prüfung.

- **Prüfung:** Januar oder Februar 2027. Geplant wird für den frühen Termin.
- **Inhalt:** Grundlage ist der amtliche SKS-Fragenkatalog mit den offiziellen Antworten von ELWIS. Das Buch (Sportküstenschifferschein & Sportbootführerschein See, Delius Klasing) ist bestellt und wird vor der Endabnahme eingearbeitet.
- **Nutzung:** zunächst nur privat, später auch für andere Kursteilnehmer.
- **Annahme:** Umsetzung abends und am Wochenende, ohne festes Stundenbudget. Jeder Meilenstein umfasst etwa eine Woche.

## Entscheidungen

Die Umsetzung läuft in Claude Code auf dem Notebook. Planung und Inhalte bleiben im Chat.

| Thema | Festlegung | Grund |
| --- | --- | --- |
| Technologie | HTML, CSS und JavaScript (ES-Module), kein Framework, kein Build-Schritt | Plattformunabhängig; jedes Engine-Modul ist eine eigene Datei |
| Arbeitsumgebung | Claude Code auf dem Notebook für Code, Chat für Plan und Fragen | Viele kleine Dateien, Tests und Git direkt im Projektordner |
| Versionierung und Hosting | Git-Repo und GitHub Pages mit https | Kostenlos, reicht für eine statische PWA |
| Inhalte aus dem Buch | Werden nur lokal auf dem Gerät importiert, nicht gehostet | Privatnutzung erlaubt, ein öffentlich erreichbares Hosting wäre eine Veröffentlichung |
| Datenhaltung | IndexedDB, Export und Import als Datensicherung | Browser können Daten selten genutzter Seiten löschen |
| Freitextbewertung | Selbstbewertung gegen Kernpunkte (Weg 1), KI-Bewertung erst nach Version 1 | Offline, ohne Kosten, ohne Proxy |
| Sprache | Oberfläche Deutsch und Englisch umschaltbar | Laut Nutzungskontext im Lastenheft; die Zeile unter den nichtfunktionalen Anforderungen nennt noch nur Deutsch |
| Lernerinnerung | Hinweis beim App-Start, Kalender später | Ohne Server keine verlässlichen Benachrichtigungen |

## Meilensteine

Vier Meilensteine bis zum 20.12.2026; das tägliche Lernen beginnt mit MS1 am 22.11. und läuft bis zur Prüfung.

&#91;embedded content: Zeitplan Version 1 · 4 Meilensteine, Lernen ab MS1\]

MS1 liefert eine lernbare App mit dem amtlichen Katalog, MS2 die Motivation, MS3 die Navigationsaufgaben und MS4 Simulation, Buchinhalte und Abnahme. Ab dem 21.12. wird nur noch gelernt und repariert.

## Arbeitspakete

Elf Arbeitspakete decken alle Muss-Anforderungen ab, dazu die Soll-Anforderungen, die für den SKS gebraucht werden. Jedes Paket ist eine abgeschlossene Claude-Code-Sitzung mit eigenem Commit.

| AP | Inhalt | Module | Anforderungen | Ergebnis | Meilenstein |
| --- | --- | --- | --- | --- | --- |
| AP1 | Repo, Hosting, PWA-Grundgerüst mit Manifest und Service Worker | M1 | F-01 | App lädt offline auf dem Smartphone | MS1 |
| AP2 | Inhaltsformat und Import des amtlichen Katalogs | M8 | F-24, F-25, F-26, F-32 | Katalog als JSON mit offiziellen Antworten | MS1 |
| AP3 | Leitner-Fächer und Rundenbildung | M2 | F-03, F-05, F-07 | Runden mit 10 Fragen, fällige zuerst | MS1 |
| AP4 | Freitext mit Kernpunkten, Multiple Choice | M3 | F-29, F-30, F-08 | Antwort tippen, Musterantwort sehen, selbst bewerten | MS1 |
| AP5 | Lernstand speichern | M7 | F-21 | Fortschritt bleibt nach Neustart erhalten | MS1 |
| AP6 | XP, Streak, Level, Tagesziel, Hinweis beim Start | M4 | F-12, F-13, F-14, F-15 | Tagesziel eine Runde, mehr erlaubt | MS2 |
| AP7 | Statistik und Schwächenliste | M5 | F-17, F-18 | Fortschritt je Thema sichtbar | MS2 |
| AP8 | Export, Import, Sprachumschaltung | M7 | F-22, F-23 | Datensicherung, Oberfläche Deutsch und Englisch | MS2 |
| AP9 | Kurs- und Peilaufgaben mit Wind- und Stromversatz | M9, M3 | F-28, F-09 | Generierte Rechenaufgaben mit geprüften Lösungen | MS3 |
| AP10 | Prüfungssimulation | M6 | F-20 | Simulation mit Auswertung je Thema | MS4 |
| AP11 | Buchinhalte einarbeiten, Abnahme | Inhalt | Abnahmekriterien | Version 1 abgenommen | MS4 |

Nach Version 1 offen: F-02 (mehrere Module, nötig für IAPP), F-04, F-06, F-10, die Kann-Anforderungen sowie Kalender-Erinnerung und KI-Bewertung.

## Inhaltsarbeit SKS

Die Inhaltsarbeit läuft parallel zum Code. Weil es die offiziellen Antworten gibt, entfällt das Schreiben eigener Musterantworten weitgehend.

1. **Amtlicher Katalog (MS1):** Den aktuellen Katalog von ELWIS herunterladen, als JSON importieren und Fragenzahl und Themen mit dem Original abgleichen. Herkunft: amtlich, mit Stand des Katalogs.
2. **Kernpunkte (MS1 bis MS2):** Claude zerlegt jede offizielle Antwort in Kernpunkte für die Checkliste. Du prüfst die Kernpunkte stichprobenartig, vor allem bei Recht und Seemannschaft.
3. **Navigationsaufgaben (MS3):** Die Rechenwege für Kurs, Peilung, Missweisung, Deviation sowie Wind- und Stromversatz werden gegen Beispielaufgaben aus dem Buch getestet. Erst wenn alle Beispiele stimmen, gehen die Generatoren in die App.
4. **Buch (MS4):** Ergänzende Erklärungen aus dem Buch in eigenen Worten, als lokales Zusatzmodul. Herkunft: Buch, mit Kapitelangabe.

Kartenaufgaben in der Übungskarte bleiben Papierarbeit im Kurs.

## Risiken

Das größte Risiko ist nicht technisch: Das Bauen verdrängt das Lernen.

| Risiko | Folge | Gegenmaßnahme |
| --- | --- | --- |
| Bauen verdrängt Lernen | Prüfung mit schöner App, aber wenig Wissen | Lernstart nach MS1, tägliche Runde vor jeder Bausitzung, Feature-Stopp ab 21.12. |
| Prüfung schon im Januar | Wenig Zeit nach Version 1 | Version 1 bis 20.12., Puffer über die Feiertage |
| Fehler in den Rechenwegen | Falsches wird gelernt | Tests gegen Beispiele aus dem Buch, keine Freigabe ohne grüne Tests |
| Import des Katalogs unvollständig | Fragen fehlen oder sind verstümmelt | Abgleich der Fragenzahl je Thema, Stichproben gegen das Original |
| Kernpunkte ungenau | Selbstbewertung zu großzügig | Stichproben, offizielle Antwort immer sichtbar |
| Datenverlust im Browser | Streak und Fächer weg | Regelmäßiger Export, Erinnerung beim App-Start |
| Katalog wird geändert | Veraltete Fragen | Stand des Katalogs im Modul vermerken, vor der Prüfung bei ELWIS prüfen |

## Nächste Schritte

- [ ] Lastenheft als Markdown exportieren und ins Repo legen
- [ ] GitHub-Repo anlegen und GitHub Pages aktivieren
- [ ] Claude Code auf dem Notebook einrichten und den Tarif prüfen
- [ ] Aktuellen SKS-Fragenkatalog bei ELWIS herunterladen
- [ ] Erste Claude-Code-Sitzung: AP1 und AP2
