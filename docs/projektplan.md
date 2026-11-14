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

Elf Arbeitspakete und die Nachträge AP6A und AP7A decken alle Muss-Anforderungen ab, dazu die Soll-Anforderungen, die für den SKS gebraucht werden. Jedes Paket ist eine abgeschlossene Claude-Code-Sitzung mit eigenem Commit.

| AP | Inhalt | Module | Anforderungen | Ergebnis | Meilenstein |
| --- | --- | --- | --- | --- | --- |
| AP1 | Repo, Hosting, PWA-Grundgerüst mit Manifest und Service Worker | M1 | F-01 | App lädt offline auf dem Smartphone | MS1 |
| AP2 | Inhaltsformat und Import des amtlichen Katalogs | M8 | F-24, F-25, F-26, F-32 | Katalog als JSON mit offiziellen Antworten | MS1 |
| AP3 | Leitner-Fächer und Rundenbildung | M2 | F-03, F-05, F-07 | Runden mit 10 Fragen, fällige zuerst | MS1 |
| AP4 | Freitext mit Kernpunkten, Multiple Choice | M3 | F-29, F-30, F-08 | Antwort tippen, Musterantwort sehen, selbst bewerten | MS1 |
| AP5 | Lernstand speichern | M7 | F-21 | Fortschritt bleibt nach Neustart erhalten | MS1 |
| AP6 | XP, Streak, Level, Tagesziel, Hinweis beim Start | M4 | F-12, F-13, F-14, F-15 | Tagesziel eine Runde, mehr erlaubt | MS2 |
| AP6A | Nachträge: Enter bestätigt die Freitexteingabe, Freitext-Antworten speichern und exportieren, Ränge mit Bild (Rangfolge im SKS-Modul) | M3, M4, M7, M8 | F-33, F-34, F-36, F-37 | Enter schickt ab, Antworten samt Selbstbewertung liegen im Export, Rang mit Platzhalterbild erscheint je Level | MS2 |
| AP6B | Optional: Rangbilder einbauen, sobald sie fertig sind (Kann, jederzeit vorziehbar) | Inhalt | F-38 | Zwölf eigene Bilder statt Platzhalter, offline verfügbar | offen |
| AP7 | Statistik und Schwächenliste | M5 | F-17, F-18 | Fortschritt je Thema sichtbar | MS2 |
| AP7A | Nachtrag (vorgezogen aus der Zeit nach Version 1): Runde auf ein Thema beschränken | M2 | F-06 | Thema auf der Startseite wählbar, z. B. nur Navigation oder nur Wetterkunde | MS2 |
| AP8 | Export, Import, Sprachumschaltung | M7 | F-22, F-23 | Datensicherung, Oberfläche Deutsch und Englisch | MS2 |
| AP9 | Kurs- und Peilaufgaben mit Wind- und Stromversatz | M9, M3 | F-28, F-09 | Generierte Rechenaufgaben mit geprüften Lösungen | MS3 |
| AP10 | Prüfungssimulation | M6 | F-20 | Simulation mit Auswertung je Thema | MS4 |
| AP11 | Buchinhalte einarbeiten, Abnahme | Inhalt | Abnahmekriterien | Version 1 abgenommen | MS4 |

**Status der Arbeitspakete**

| AP | Status | Datum | Bemerkung |
| --- | --- | --- | --- |
| AP1 | erledigt | 12.11.2026 | PWA-Grundgerüst, Modul-Lader M1 mit Beispielmodul, Testserver, 16 Tests grün. GitHub Pages aktiv unter https://degree547.github.io/trainer-engine/. Auf dem Smartphone (Android, Brave) installiert und im Flugmodus geprüft. Dunkelmodus nur im Browser getestet |
| AP2 | erledigt | 13.11.2026 | Inhaltsformat M8 mit vollständiger Prüfung (Fehler mit Zeile und Klartext, Deutsch und Englisch). Import-Skript `tools/import-sks.mjs` für den amtlichen Katalog (ELWIS, Stand 01.07.2006): 638 Fragen, Anzahl je Bereich stimmt mit dem Original überein (Navigation 118, Recht 110, Wetter 101, Seemannschaft I 163, Seemannschaft II 146). Alle Paare aus Frage und Antwort gelesen, 39 Handkorrekturen in `tools/sks/korrekturen.json`. Kernpunkte für alle 638 Antworten erstellt (vorgezogen aus der Inhaltsarbeit, Status „ungeprüft“). 13 Fragen verweisen auf Abbildungen, die noch fehlen; bei 3 davon besteht die amtliche Antwort nur aus einer Skizze. 34 Tests grün. Im Browser geprüft, noch nicht auf dem Smartphone |
| AP3 | erledigt | 13.11.2026 | Lernlogik M2: fünf Leitner-Fächer, Abstände 1, 2, 4, 8 und 16 Tage, falsch = Fach 1 und am nächsten Tag fällig. Runde mit 10 Fragen, zuerst fällige, dann neue Thema für Thema in Katalogreihenfolge. Nach jeder Runde „Fehler gleich wiederholen“, dazu „Wiederholung vorziehen“ auf der Startseite; beides gilt als Übung (richtig ändert das Fach nicht, falsch setzt auf Fach 1). Auflösung mit Musterantwort und Quelle; Selbstbewertung „Gewusst / Nicht gewusst“ als Übergang bis AP4. Lernstand nur im Speicher bis AP5. 51 Tests grün. Im Browser geprüft (hell und dunkel), noch nicht auf dem Smartphone |
| AP4 | erledigt | 13.11.2026 | Fragetypen M3. Freitext: Antwort tippen (leeres Feld nach Rückfrage erlaubt), danach eigene Antwort, Musterantwort mit Herkunft („amtlich“) und Quelle, Kernpunkte als Checkliste mit Hinweis „ungeprüft“. Vorschlag aus den Häkchen (alle abgehakt = Gewusst), die Entscheidung trifft der Lernende mit „Gewusst / Nicht gewusst“; sie bestimmt das Leitner-Fach. Multiple Choice: Optionen als große Tippflächen, für jede Anzeige gemischt (wichtig für Kataloge mit der richtigen Antwort immer an Stelle A, z. B. SBF), automatische Bewertung mit Markierung richtig/gewählt. Im Inhaltsformat neu und optional: `"mischen": false` für feste Reihenfolge (z. B. „Alle oben genannten“ bei IAPP/CIPP) und `"herkunft"` bei MC. Beispielmodul um je eine MC-Frage mit fester Reihenfolge und eine Freitextfrage ergänzt. 64 Tests grün. Im Browser in Smartphone-Größe geprüft (hell und dunkel), noch nicht auf dem Smartphone |
| AP5 | erledigt | 13.11.2026 | Parallel zu AP4 entstanden und danach zusammengeführt. Speicherung M7: Lernstand in IndexedDB (Datenbank `trainer-engine`, je Modul-ID ein Eintrag), gespeichert nach jeder Bewertung, geladen beim Start und beim Wechsel des Moduls. Versioniertes Schema mit Umstellung beim Laden; ein Stand aus einer neueren App-Version wird nicht überschrieben, beschädigte Einträge werden übersprungen und gemeldet. Jede Karte trägt jetzt den genauen Zeitpunkt `geaendert`; `fuehreZusammen` vereint zwei Stände je Frage (der jüngere gewinnt). Das nutzt schon das Speichern (zwei Tabs, App und Browser zugleich) und später der Import in AP8 (Abgleich zwischen Geräten über eine Exportdatei, z. B. in Proton Drive). Beim Start wird dauerhafter Speicher beantragt, sonst erscheint ein Hinweis. Daten gelten nur für diese Adresse und diesen Browser; der lokale Testserver hat einen eigenen Lernstand. Nach dem Zusammenführen mit AP4 alle Tests grün. Im Browser geprüft (Antworten überstehen das Neuladen). Auf dem Smartphone geprüft (13.11.2026): Lernstand bleibt online und offline nach dem Schließen erhalten. Nach einem Update läuft die erste Sitzung noch mit der alten Version; erst danach wird gespeichert |
| AP6 | erledigt | 13.11.2026 | Gamification M4: 10 XP je richtiger Antwort (5 XP bei „Fehler gleich wiederholen“), 20 XP Bonus für eine zu Ende gespielte Runde ohne Fehler. Für das Tagesziel zählt eine zu Ende gespielte normale oder vorgezogene Runde; bei „Beenden“ mittendrin bleiben die XP, die Runde zählt aber nicht. Tagesziel 1 bis 5 Runden (Standard 1) auf der Startseite einstellbar; ein späteres höheres Ziel ändert frühere Tage nicht. Streak = Tage in Folge mit erreichtem Ziel, ist es heute noch offen, zählt der Streak bis gestern. Level 2 ab 100 XP, jedes weitere Level braucht 50 XP mehr (100, 150, 200 …). Startseite: Lernerinnerung als Hinweis (zum Beispiel „Dein Streak endet heute …“), dazu Level mit Balken, Streak, Runden heute und XP. Rundenende: Trefferquote, gewonnene XP mit Bonus, Stand des Tagesziels und Levelbalken. Das Profil gilt für die ganze App, nicht je Modul, und liegt in der IndexedDB im neuen Bereich „profil“ (Datenbankversion 2; der Lernstand aus AP5 bleibt erhalten). Gezählt wird je Gerät und Tag, damit der Import in AP8 nichts doppelt zählt; Änderungen werden auf den gespeicherten Stand angewendet, damit auch zwei Tabs keine XP verlieren. 94 Tests grün. Im Browser in Smartphone-Größe geprüft (hell und dunkel, Neuladen). Auf dem Smartphone geprüft (14.11.2026): Erinnerung, Fortschritt und Rundenende funktionieren, XP und Streak bleiben nach dem Schließen erhalten |
| AP6A | erledigt | 14.11.2026 | Nachträge aus dem Lastenheft. F-33: Im Freitextfeld schickt Enter die Antwort ab, Shift+Enter macht einen Zeilenumbruch; bei leerem Feld fragt das erste Enter nach, das zweite löst auf; die Smartphone-Tastatur zeigt „Senden“. F-34: Jede Freitext-Antwort wird mit Frage-ID, Modul, Zeitpunkt, Text, Selbstbewertung und Rundenart in der IndexedDB gespeichert (neuer Bereich „antworten“, Datenbankversion 3; Lernstand und Profil bleiben erhalten). Einträge werden nur angehängt; `fuehreAntwortenZusammen` vereint die Antworten zweier Geräte ohne Doppelte. In den Export kommen sie mit AP8, wenn es den Export gibt. F-36: Rang mit Bild und Namen auf der Startseite über dem Levelbalken, mit dem nächsten Rang; am Rundenende ein Hinweis „Neuer Rang erreicht“. Ohne Bild erscheint ein Platzhalter mit dem Anfangsbuchstaben. F-37: Neues optionales Feld `raenge` im Inhaltsformat (Name, ab Level, optional Bild), von M8 geprüft (erster Rang ab Level 1, danach steigend). Das SKS-Modul hat die zwölf Ränge von Süßwassermatrose bis Admiral aus `tools/sks/raenge.json`, das Import-Skript übernimmt sie. Module ohne Ränge zeigen nur das Level. Die Level-Grenzen sind vorläufig: Kapitän (Level 30) braucht bei der jetzigen XP-Kurve gut 23.000 XP. 105 Tests grün. Im Browser in Smartphone-Größe geprüft (hell und dunkel): Enter, Shift+Enter, gespeicherte Antwort, Rangaufstieg. Auf dem Smartphone geprüft (14.11.2026): Rang auf der Startseite, „Senden“ im Freitextfeld und Zeilenumbruch funktionieren |
| AP7 | erledigt | 14.11.2026 | Statistik M5. F-17: neuer Bildschirm „Statistik“ (Knopf auf der Startseite) mit dem Fortschritt je Thema: Anteil der Fragen in Fach 4 und 5 als Prozent und Balken, der helle Teil des Balkens zeigt Fach 1 bis 3, darunter sicher, in Arbeit und neu; oben der Anteil über alle Themen. F-18: Schwächenliste mit den 10 Fragen mit der höchsten Fehlerquote, ab 2 Antworten und mindestens einer falschen; bei gleicher Quote zuerst mehr Fehler, dann niedrigeres Fach. Ein Tipp klappt Frage, richtige Antwort und Quelle auf. Dafür zählt jede Karte jetzt richtige und falsche Antworten, auch aus Übungen (Lernstand Version 2). Variante A: Beim ersten Laden nach dem Update werden die Zähler einmalig aus den gespeicherten Freitext-Antworten (AP6A) nachgetragen; Multiple-Choice-Fragen beginnen bei 0. Beim Zusammenführen gewinnt die jüngere Karte samt Zählern, beantworten zwei Geräte dieselbe Frage, fehlt deshalb eine Antwort in der Zählung. Service Worker v8. 114 Tests grün. Im Browser in Smartphone-Größe geprüft (hell und dunkel, mit einem nachgebildeten Lernstand der Version 1). Auf dem Smartphone geprüft (14.11.2026): Statistik, Schwächenliste und Fortschritt nach einer Runde funktionieren |
| AP7A | erledigt | 14.11.2026 | F-06, vorgezogen aus der Zeit nach Version 1. Auf der Startseite steht über den Lernknöpfen eine Auswahl „Thema“ (Alle Themen oder ein einzelnes, z. B. Navigation oder Wetterkunde). Runde und vorgezogene Wiederholung nehmen dann nur Fragen dieses Themas, nach denselben Regeln (zuerst fällige, dann neue); fällig, neu und die Fächer auf der Startseite gelten für das gewählte Thema. Sind in anderen Themen Fragen fällig, erscheint ein Hinweis mit der Anzahl. In der Statistik hat jedes Thema einen Knopf „Dieses Thema lernen“. Die Wahl wird je Modul im Browser gemerkt (localStorage, kein Teil des Lernstands und des Exports); gibt es das Thema nicht mehr, gilt wieder „Alle Themen“. Themenrunden zählen für XP und Tagesziel wie jede Runde. Service Worker v9. 115 Tests grün. Im Browser in Smartphone-Größe geprüft (Auswahl, Neuladen, Runde, Knopf in der Statistik, Hinweis). Auf dem Smartphone geprüft (14.11.2026): Themenwahl bleibt nach dem Schließen erhalten, Runde im gewählten Thema funktioniert |

Nach Version 1 offen: F-02 (mehrere Module, nötig für IAPP), F-04, F-10, die Kann-Anforderungen sowie Kalender-Erinnerung und KI-Bewertung. Ausnahme ist F-38 (Rangbilder): Sie lässt sich jederzeit vorziehen, auch nach dem Feature-Stopp, weil sie nur Inhalt ändert und keinen Code.

## Inhaltsarbeit SKS

Die Inhaltsarbeit läuft parallel zum Code. Weil es die offiziellen Antworten gibt, entfällt das Schreiben eigener Musterantworten weitgehend.

1. **Amtlicher Katalog (MS1):** Den aktuellen Katalog von ELWIS herunterladen, als JSON importieren und Fragenzahl und Themen mit dem Original abgleichen. Herkunft: amtlich, mit Stand des Katalogs.
2. **Kernpunkte (MS1 bis MS2):** Claude zerlegt jede offizielle Antwort in Kernpunkte für die Checkliste. Du prüfst die Kernpunkte stichprobenartig, vor allem bei Recht und Seemannschaft.
3. **Navigationsaufgaben (MS3):** Die Rechenwege für Kurs, Peilung, Missweisung, Deviation sowie Wind- und Stromversatz werden gegen Beispielaufgaben aus dem Buch getestet. Erst wenn alle Beispiele stimmen, gehen die Generatoren in die App.
4. **Buch (MS4):** Ergänzende Erklärungen aus dem Buch in eigenen Worten, als lokales Zusatzmodul. Herkunft: Buch, mit Kapitelangabe.
5. **Rangbilder (optional, jederzeit):** Du erstellst die zwölf Bilder mit Copilot nach den Anforderungen im Lastenheft (F-38) und wählst sie aus. Danach baut Claude Code sie in einer kurzen Sitzung ein (AP6B): Dateien ablegen, `bild` in `tools/sks/raenge.json` eintragen, Import, Service Worker, Tests. Anlass ist, wenn die Platzhalter beim Lernen stören.

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

- [x] Lastenheft als Markdown exportieren und ins Repo legen
- [x] GitHub-Repo anlegen und GitHub Pages aktivieren
- [ ] Claude Code auf dem Notebook einrichten und den Tarif prüfen
- [x] Aktuellen SKS-Fragenkatalog bei ELWIS herunterladen (Stand 01.07.2006, vor der Prüfung bei ELWIS auf Aktualität prüfen)
- [x] Erste Claude-Code-Sitzung: AP1 und AP2
- [ ] Kernpunkte stichprobenartig prüfen, vor allem Recht und Seemannschaft (Status „ungeprüft“ in `tools/sks/kernpunkte-*.json`)
- [ ] Fehlende Abbildungen zu 13 Fragen nachtragen (Liste: Fragen mit Hinweis im Modul)
- [ ] Optional: Rangbilder mit Copilot erstellen (Anforderungen und Vorlage für den Auftrag in `tools/sks/LIESMICH.md`), danach AP6B
