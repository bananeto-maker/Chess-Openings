# Eröffnungstrainer – Anleitung

Die App enthält 30 Eröffnungen (14 mit Weiß, 16 mit Schwarz) mit 95 Varianten, je 8–10 eigene Züge tief.
Sie hat drei Bereiche: **Theorie** (Varianten durchgehen), **Training** (die richtige Antwort ziehen) und **Statistik**.

## Zwei Wege, die App zu nutzen

**A) Schnell ausprobieren (Windows, ohne Installation)**
Öffne `Eroeffnungstrainer-Einzeldatei.html` mit Doppelklick im Browser. Alles steckt in dieser einen Datei.
Sie funktioniert auch offline, ist aber keine installierte App.

**B) Als App installieren (Android und Windows)**
Eine PWA muss einmal über eine `https://`-Adresse aufgerufen werden. Danach läuft sie offline.
Dafür lädst du den Ordner `app` einmal kostenlos ins Netz, zum Beispiel so:

1. Gehe auf **app.netlify.com/drop** (kostenloses Konto nötig).
2. Ziehe den kompletten Ordner `app` in das Feld auf der Seite.
3. Du bekommst eine Adresse wie `https://irgendwas.netlify.app`. Die öffnest du auf deinen Geräten.

Alternative: GitHub Pages (Ordnerinhalt in ein Repository hochladen, unter *Settings → Pages* aktivieren).

### Auf Android installieren
1. Öffne die Adresse in **Chrome**.
2. Tippe auf das Menü **⋮** oben rechts.
3. Wähle **App installieren** (bei manchen Geräten: **Zum Startbildschirm hinzufügen**).
4. Die App liegt jetzt auf dem Startbildschirm und startet ohne Browserleiste.

### Auf Windows installieren
1. Öffne die Adresse in **Edge** oder **Chrome**.
2. Klicke rechts in der Adressleiste auf das Symbol **App installieren** (Bildschirm mit Pfeil).
   In Edge geht es auch über **⋯ → Apps → Diese Website als App installieren**.
3. Die App erscheint im Startmenü und kann an die Taskleiste angeheftet werden.

Nach dem ersten Öffnen funktioniert die App ohne Internet.

## Bedienung

- **Theorie:** Eröffnung wählen, mit ▶ / ◀ durch die Züge gehen (am PC auch mit den Pfeiltasten).
  An Verzweigungen wählst du die Antwort des Gegners. Du kannst auch selbst auf dem Brett ziehen.
- **Training:** Farbe und Modus wählen. Im Modus *Zufall* wählt die App die Varianten, im Modus *Gezielt* du.
  Ziehe per Antippen (Figur, dann Zielfeld) oder per Ziehen. Bei einem Fehler zeigt ein Pfeil den richtigen Zug plus Begründung.
  Varianten mit Fehlern kommen sofort wieder dran; fehlerfreie erst nach Stunden bzw. Tagen (4 h, 1 Tag, 3 Tage, 1 Woche …).
- **Statistik:** Eine Variante „sitzt“, wenn du sie zweimal hintereinander fehlerfrei gespielt hast.

## Fortschritt sichern

Der Fortschritt wird nur im jeweiligen Browser gespeichert, Handy und PC sind also getrennt.
Unter **Statistik → Fortschritt exportieren** sicherst du ihn als Datei; mit **importieren** holst du ihn auf ein anderes Gerät.
Mach das am besten, bevor du Browserdaten löschst oder die App deinstallierst.

## Eröffnungen erweitern

Die Daten stehen in `openings.json`. Jede Eröffnung sieht so aus:

```json
{
  "id": "italienisch",
  "name": "Italienische Partie",
  "side": "w",
  "eco": "C50–C54",
  "group": "1.e4 e5",
  "idea": "Kurze Erklärung …",
  "lines": [
    { "name": "Giuoco Pianissimo", "moves": ["e4", "e5", "Nf3", "Nc6"], "comments": { "3": "Kommentar zum 3. Halbzug" } }
  ]
}
```

- `side`: `"w"` = du spielst Weiß, `"b"` = du spielst Schwarz.
- `moves`: Züge in englischer Notation (K, Q, R, B, N; Rochade `O-O`). Angezeigt wird automatisch deutsch.
- `comments`: Schlüssel ist die Nummer des Halbzugs (1 = erster weißer Zug).
- Wichtig: An jeder Stellung darf es für deine Seite nur **einen** richtigen Zug geben. Verzweigungen nur bei Gegnerzügen.

Nach einer Änderung in `sw.js` die Zeile `const VERSION = 'v1.0.0'` hochzählen (z. B. `v1.0.1`) und neu hochladen.
Die App zeigt dann „Eine neue Version ist da“.

Hinweis: Die Einzeldatei-Version enthält die Daten fest eingebaut; Änderungen an `openings.json` wirken nur in der installierten Version.
