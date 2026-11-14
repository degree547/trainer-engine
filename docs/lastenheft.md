# Lastenheft Trainer Engine (modulare Lern-App)

Nov 10, 2026 · @Alex

## Ausgangslage und Zweck

Die Trainer Engine ist eine offline nutzbare Lern-App, die Prüfungsinhalte als austauschbare Module lädt und mit Wiederholung und Spielmechanik zum täglichen Lernen bringt.

Anlass ist ein SKS-Präsenzkurs (Sportküstenschifferschein), der im November 2026 begonnen hat. Es gibt kein Kursmaterial, man soll sich ein Buch kaufen. Beim SBF hat das Lernen mit Bootsschule1 gut funktioniert, vor allem wegen der Gamification. Beim Selbstlernen ist das Durchhalten die Schwachstelle.

Die Engine selbst enthält keine Prüfungsinhalte. Der SKS ist das erste Inhaltsmodul. Weitere Module, etwa für IAPP-Prüfungen, sollen ohne Eingriff in die Engine ergänzt werden können.

## Ziele und Nicht-Ziele

Version 1 soll erreichen, dass täglich gelernt wird, auch ohne Disziplin, und dass das Gelernte sitzt.

**Ziele**

- Tägliche Kurzrunde von 5 bis 10 Minuten, die sich jederzeit am Smartphone starten lässt
- Falsch beantwortete Fragen kommen automatisch wieder, bis sie sitzen
- Spielmechanik, die zum Weitermachen motiviert: Streak, XP, Level, Tagesziel
- Inhalte lassen sich ohne Programmierung austauschen und erweitern
- Die Engine ist so gebaut, dass ein zweites Inhaltsmodul ohne Umbau läuft

**Nicht-Ziele in Version 1**

- Kein Backend, keine Benutzerkonten, keine Ranglisten
- Keine Abzeichen-Sammlung, keine Mehrspieler-Funktionen
- Keine Kartenarbeit (Navigation mit Zirkel und Kursdreieck), nur Rechen- und Wissensaufgaben
- Keine automatische Bereitstellung urheberrechtlich geschützter Buchinhalte
- Keine KI-Bewertung in Version 1: Freitext wird per Selbstbewertung gegen die Musterantwort geprüft

## Nutzer und Nutzungskontext

Einziger Nutzer ist der Auftraggeber selbst, der die App vor allem am Smartphone für kurze Lernpausen nutzt.

- Einzelnutzer, ein Gerät als Hauptgerät, ein weiteres optional (Fortschritt per Export und Import übertragbar)
- Nutzung unterwegs und ohne Netz, etwa in der Bahn
- Typische Sitzung: eine Runde mit 10 Fragen, 3 bis 8 Minuten
- Sprache der Oberfläche: umschaltbar Deutsch/Englisch; Inhaltsmodule dürfen Deutsch oder Englisch sein
- Technisches Vorwissen vorhanden: Inhalte dürfen als Textdateien gepflegt werden

## Systemübersicht und Modulschnitt

Die Engine nimmt Inhalt nur als Datei über das Inhaltsformat auf, und ihre neun Module lassen sich einzeln ändern.

&#91;embedded content: Modulschnitt der Engine · 9 Module, Inhalt als Datei\]

Ein Inhaltsmodul gelangt nur über M8 in die Engine. Die übrigen Module kennen keine Prüfungsinhalte und lassen sich einzeln ändern oder ersetzen.

## Funktionale Anforderungen

Die Engine besteht aus neun Modulen, die sich einzeln ändern lassen. Jede Anforderung trägt eine ID für den späteren Projektplan. Priorität: Muss gehört in Version 1, Soll folgt danach, Kann ist optional.

| ID | Modul | Anforderung | Prio |
| --- | --- | --- | --- |
| F-01 | M1 Kern | Die Engine lädt ein Inhaltsmodul aus einer Datei, ohne dass die App neu gebaut wird | Muss |
| F-02 | M1 Kern | Mehrere Module sind installiert, die Startseite bietet die Auswahl | Soll |
| F-03 | M2 Lernlogik | Fünf Fächer nach Leitner: richtig = ein Fach höher, falsch = zurück in Fach 1 | Muss |
| F-04 | M2 Lernlogik | Die Wiederholungsabstände je Fach sind in Tagen einstellbar | Soll |
| F-05 | M2 Lernlogik | Eine Runde hat 10 Fragen: zuerst fällige, dann neue | Muss |
| F-06 | M2 Lernlogik | Eine Runde lässt sich auf ein Thema beschränken | Soll |
| F-07 | M2 Lernlogik | Nach jeder Antwort erscheint sofort die Auflösung mit Erklärung | Muss |
| F-08 | M3 Fragetypen | Multiple Choice mit einer richtigen Antwort | Muss |
| F-09 | M3 Fragetypen | Zahleneingabe mit Toleranz und Einheit | Muss |
| F-10 | M3 Fragetypen | Karteikarte mit Selbstbewertung (gewusst / nicht gewusst) | Soll |
| F-11 | M3 Fragetypen | Mehrfachauswahl und Zuordnung | Kann |
| F-29 | M3 Fragetypen | Freitext: Die Antwort wird getippt, danach erscheinen Musterantwort und Kernpunkte als Checkliste. Die Selbstbewertung bestimmt das Leitner-Fach | Muss |
| F-30 | M3 Fragetypen | Nach jeder Freitext-Antwort wird die Musterantwort angezeigt, mit Angabe ihrer Herkunft (amtlich, Buch oder eigen) | Muss |
| F-31 | M3 Fragetypen | KI-Bewertung des Freitexts gegen die Musterantwort über einen Proxy; nur online und nicht Teil von Version 1 | Kann |
| F-33 | M3 Fragetypen | Freitext: Die Enter-Taste bestätigt die Eingabe, Shift+Enter erzeugt einen Zeilenumbruch (Nachtrag) | Soll |
| F-12 | M4 Gamification | XP pro richtiger Antwort, Bonus für eine Runde ohne Fehler | Muss |
| F-13 | M4 Gamification | Tages-Streak mit einstellbarem Tagesziel (Standard: eine Runde) | Muss |
| F-14 | M4 Gamification | Level mit Fortschrittsbalken | Soll |
| F-15 | M4 Gamification | Rundenende zeigt XP, Trefferquote und aktuellen Streak | Muss |
| F-16 | M4 Gamification | Lernerinnerung per Benachrichtigung (ohne Backend technisch begrenzt, siehe offene Fragen) | Kann |
| F-36 | M4 Gamification | Jedes Level hat einen Rang mit Namen und kleinem Bild; der Rang erscheint bei der Level-Anzeige und beim Aufstieg; fehlt das Bild, erscheint ein Platzhalter (Nachtrag) | Soll |
| F-17 | M5 Statistik | Fortschritt je Thema: Anteil der Fragen in Fach 4 und 5 | Muss |
| F-18 | M5 Statistik | Schwächenliste mit den Fragen der höchsten Fehlerquote | Soll |
| F-19 | M5 Statistik | Lernkalender mit Lerntagen und Runden | Kann |
| F-35 | M5 Statistik | KI-Auswertung der gespeicherten Freitext-Antworten, um wiederkehrende Schwächen zu erkennen; nicht Teil von Version 1 (Nachtrag) | Kann |
| F-20 | M6 Prüfungssimulation | Simulation mit Fragenzahl, Zeitlimit und Bestehensgrenze aus dem Modul, Auswertung je Thema | Soll |
| F-21 | M7 Speicherung | Fortschritt wird lokal im Browser gespeichert | Muss |
| F-22 | M7 Speicherung | Export und Import des Fortschritts als Datei | Muss |
| F-23 | M7 Speicherung | Der Fortschritt bleibt erhalten, wenn ein Modul aktualisiert wird (stabile Frage-IDs) | Muss |
| F-34 | M7 Speicherung | Jede Freitext-Antwort wird mit Frage-ID, Zeitstempel, eingegebenem Text und Selbstbewertung lokal gespeichert und ist im Export (F-22) enthalten (Nachtrag) | Muss |
| F-24 | M8 Inhaltsformat | Ein Modul ist eine JSON-Datei mit Metadaten, Themen und Fragen | Muss |
| F-25 | M8 Inhaltsformat | Jede Frage hat ID, Thema, Typ, richtige Antwort, Erklärung und Quellenangabe | Muss |
| F-32 | M8 Inhaltsformat | Freitextfragen haben Pflichtfelder für Musterantwort, Kernpunkte, Herkunft der Antwort und Quelle | Muss |
| F-26 | M8 Inhaltsformat | Beim Laden wird das Modul geprüft, Fehler erscheinen mit Zeile und Klartext | Soll |
| F-27 | M8 Inhaltsformat | Fragen lassen sich aus einer CSV-Datei importieren | Kann |
| F-37 | M8 Inhaltsformat | Ränge (Name, Bild, ab welchem Level) legt das Inhaltsmodul fest, nicht die Engine; jedes Modul bringt eigene Ränge mit (Nachtrag) | Soll |
| F-38 | M8 Inhaltsformat | Eigene Bilder für die zwölf SKS-Ränge ersetzen die Platzhalter; sie entstehen außerhalb der App und werden über das Feld „bild“ (F-37) eingebunden; kann jederzeit vorgezogen werden (Nachtrag) | Kann |
| F-28 | M9 Generatoren | Ein Modul kann Rechenaufgaben mit Zufallswerten erzeugen, die Lösung wird berechnet | Soll |

## Inhaltsmodule

Das SKS-Modul ist das erste Inhaltsmodul und der Test, ob die Engine wirklich inhaltsfrei ist.

**SKS (Version 1)**

- Themen nach den vier Prüfungsbereichen: Navigation, Seemannschaft, Wetterkunde, Schifffahrtsrecht
- Die Feinstruktur der Themen richtet sich nach Kursplan und Buch und steht noch aus
- Fragen stammen aus eigenen Kursnotizen und eigenen Formulierungen, nicht aus kopierten Buchtexten
- Jede Frage nennt ihre Quelle (Buchkapitel oder Kursdatum), damit sie sich prüfen lässt
- Generatoren für Rechenaufgaben, die ohne Karte lösbar sind (Kurs, Distanz, Zeit, Geschwindigkeit, Missweisung, Deviation, Versatz durch a) Wind und b) Strömung)
- Nautische Ränge, zwölf Stufen von Süßwassermatrose bis Admiral (Tabelle unten); Bilder folgen später (selbst erstellt oder frei lizenziert), bis dahin Platzhalter (Nachtrag)

| Ab Level | Rang |
| --- | --- |
| 1 | Süßwassermatrose |
| 3 | Schiffsjunge |
| 5 | Leichtmatrose |
| 8 | Matrose |
| 11 | Vollmatrose |
| 14 | Bootsmann |
| 18 | Steuermann |
| 22 | Zweiter Offizier |
| 26 | Erster Offizier |
| 30 | Kapitän |
| 35 | Konteradmiral |
| 40 | Admiral |

Kapitän markiert die Prüfungsreife, die beiden Admiralsränge belohnen das Weiterüben. Die Level-Grenzen sind vorläufig und werden an die XP-Kurve aus AP6 angepasst.

**Anforderungen an die Rangbilder (F-38)**

- Ein Bild je Rang, zwölf insgesamt, in einheitlichem Stil; der Aufstieg ist am Bild erkennbar (zum Beispiel mehr Streifen oder Sterne)
- Quadratisch mit Motiv in der Mitte; die App zeigt die Bilder rund beschnitten, nichts Wichtiges darf in den Ecken liegen
- Gut erkennbar bei 40 Pixeln (Startseite) und 64 Pixeln (Rangaufstieg): wenige Details, keine Schrift im Bild, der Name steht daneben
- Funktioniert im Hell- und Dunkelmodus: transparenter Hintergrund mit genug Kontrast oder ein eigener runder Hintergrund
- Format SVG, sonst PNG oder WebP mit 256 × 256 Pixeln
- Höchstens 30 KB je Bild, weil die App alle Bilder für den Offline-Betrieb speichert
- Dateinamen ohne Umlaute und Leerzeichen, abgelegt unter `content/sks/raenge/`, zum Beispiel `01-suesswassermatrose.svg`
- Rechte: selbst erstellt, mit einem KI-Werkzeug erzeugt, dessen Bedingungen die Nutzung erlauben (zum Beispiel Copilot), oder frei lizenziert. Keine Kopien echter Dienstgradabzeichen, Logos oder bekannter Figuren. Weil das Repo öffentlich ist, steht die Herkunft jedes Bilds in `content/sks/raenge/HERKUNFT.md`

**IAPP (später)**

- Zweisprachiges Modul für CIPP/E und AIGP, Spezifikation liegt bereits vor
- Dient als Gegenprobe: Läuft es ohne Änderung an der Engine, ist der Modulschnitt gelungen

## Nichtfunktionale Anforderungen

Die App muss auf dem Smartphone ohne Netz zuverlässig laufen und ohne laufende Kosten zu betreiben sein.

- **Plattform:** statische PWA, auf dem Startbildschirm installierbar, vollständig offline nutzbar
- **Betrieb:** statisches Hosting ohne Server und ohne Datenbank
- **Datenschutz:** Fortschritt bleibt auf dem Gerät, keine Tracker, keine externen Dienste
- **Performance:** Start in unter 2 Sekunden, Antwortwechsel ohne spürbare Verzögerung
- **Bedienung:** einhändig am Smartphone, große Tippflächen, Hell- und Dunkelmodus
- **Wartbarkeit:** jedes Engine-Modul ist einzeln austauschbar, Inhalte und Programmcode sind getrennt
- **Sprache:** Oberfläche auf Deutsch, Texte in einer Datei, damit eine zweite Sprache später möglich bleibt
- **Technologie (Architekturentscheidung):** reines HTML, CSS und JavaScript (ES-Module) ohne Framework und ohne Build-Schritt, plattformunabhängig im Browser; jedes Engine-Modul ist eine eigene Datei, jedes Inhaltsmodul eine JSON-Datei
- **Installation und Hosting:** Service Worker und Manifest für Offline-Betrieb und Installation, Auslieferung über statisches Hosting mit https
- **Datenhaltung:** IndexedDB für den Lernstand; Export und Import (F-22) dienen zugleich als Datensicherung, weil Browser Daten selten genutzter Seiten löschen können

## Rechtliche Rahmenbedingungen

Die App ist für den privaten Gebrauch gedacht, Inhalte aus dem Kursbuch dürfen da angeschafft und nur für Privatnutzung übernommen werden. Der offizielle Frangenkatalog beim SKS, und die vorgeschlagenen Antworten, dürfen ebenfalls genutzt werden.

- Buchtexte, Abbildungen und Fragensammlungen sind urheberrechtlich geschützt, Fragen entstehen deshalb in eigenen Worten
- Jede Frage trägt einen Prüfstatus (ungeprüft / gegen Buch geprüft), damit fehlerhafte KI-Entwürfe nicht unbemerkt gelernt werden
- Eine Weitergabe der App mit SKS-Inhalten an andere Kursteilnehmer ist vorab zu klären, die Engine ohne Inhalte kann unabhängig davon geteilt werden
- Amtliche Quellen (zum Beispiel Rechtstexte und amtliche Veröffentlichungen) können als Quelle genannt werden

## Abnahmekriterien

Version 1 gilt als abgenommen, wenn alle Muss-Anforderungen erfüllt sind und die folgenden Prüfungen bestanden werden. Die Zahlen sind Vorschläge und lassen sich ändern.

- Die App ist auf dem Smartphone installiert und läuft im Flugmodus vollständig
- Das SKS-Modul enthält je Themengebiet mindestens 30 gegen das Buch geprüfte Fragen
- Eine Runde mit 10 Fragen ist in unter 8 Minuten durchspielbar
- Falsch beantwortete Fragen erscheinen am Folgetag wieder
- Export und anschließender Import auf einem zweiten Gerät stellt Streak, XP und Fächer wieder her
- Ein Testmodul mit 20 IAPP-Beispielfragen läuft, ohne dass die Engine geändert wird
- Eine Freitextfrage lässt sich beantworten, mit Musterantwort und Kernpunkten abgleichen und bestimmt das Leitner-Fach

Nach Freigabe dieses Lastenhefts folgt der Projektplan mit Meilensteinen je Engine-Modul.

## Offene Fragen

- [ ] Welches Buch nutzt der SKS-Kurs, und wie sieht der Kursplan aus (Grundlage für die Themenstruktur)? Antwort: Sporküstenschifferschein und Sportbootführerschein See aus dem Delius Klasing Verlag
- [ ] Wann ist die Prüfung? Davon hängt ab, wie früh das SKS-Modul benutzbar sein muss. Antwort: Januar oder Februar 2027 (jetzt 12.11.26)
- [ ] Lernerinnerungen (F-16): Benachrichtigungen ohne Server sind auf Smartphones nur eingeschränkt möglich. Reicht ein Hinweis beim App-Start, oder soll ein einfacher Weg über den Kalender geprüft werden? Antwort: App-Start, spätere Version Kalender
- [ ] Wo wird die App gehostet, und soll sie nur privat oder auch für andere Kursteilnehmer erreichbar sein? Antwort: privat, später auch für andere
- [ ] Welche Kartenaufgaben sollen trotzdem abgebildet werden (zum Beispiel Kurs- und Peilungsberechnung als Rechenaufgabe)? Antwort: Ja, Kurs und Peilaufgaben auf SKS-Niveau. Dh mit Versatz Wind und Strömung.
- [ ] Welches Tagesziel ist realistisch: eine Runde oder zwei? Antwort: Ein, aber man sollte mehr machen dürfen.
- [ ] Gibt es zu den SKS-Freitextfragen eine amtliche Musterantwort, oder ist das Kursbuch die Quelle? Davon hängt die Kennzeichnung der Herkunft ab. Antwort: Wir starten nur mit den amtlichen, Buch ist bestellt. Also sollte vor Endabnahme noch eingearbeitet werden.
- [ ] KI-Bewertung (F-31): Welcher Proxy, welche Kosten, und lohnt sich der Aufwand erst nach Version 1? Antwort: Primär mal alles für mich.
- [x] Rangfolge im SKS-Modul: wie viele Ränge, ab welchem Level, welche Bilder?

## Nachträge während der Umsetzung

Diese Anforderungen sind erst während der Umsetzung entstanden und wurden nachträglich aufgenommen. In der Anforderungstabelle sind sie mit „(Nachtrag)“ markiert.

| Datum | ID | Nachtrag | Anlass |
| --- | --- | --- | --- |
| 14.11.2026 | F-33 | Enter bestätigt die Freitexteingabe | Bei der Nutzung der Freitexteingabe aufgefallen |
| 14.11.2026 | F-34 | Freitext-Antworten speichern und exportieren | Grundlage für eine spätere Schwächenanalyse; nicht gespeicherte Antworten fehlen später |
| 14.11.2026 | F-35 | KI-Auswertung der Freitext-Antworten | Idee für später, nicht Teil von Version 1 |
| 14.11.2026 | F-36 | Ränge mit kleinem Bild je Level | Wunsch während der Umsetzung, ergänzt die Level (F-14) |
| 14.11.2026 | F-37 | Ränge im Inhaltsmodul statt in der Engine | Ränge sollen je Modul verschieden sein: SKS nautisch, andere Module eigene |
| 14.11.2026 | F-36 | Platzhalter statt Rangbilder in Version 1 | Eigene Bilder brauchen Zeit und kommen später |
| 14.11.2026 | F-38 | Eigene Rangbilder als Kann-Anforderung, jederzeit vorziehbar | Bilder entstehen mit Copilot; wichtig erst, wenn die Platzhalter beim Lernen stören |
