// Kleine Nachbildung von IndexedDB für node --test (ohne Pakete).
// Sie kann nur, was M7 benutzt: open mit Upgrade, Objektspeicher mit eigenen
// Schlüsseln, get, getAll und put in Transaktionen über einen oder mehrere Speicher. Werte werden wie im
// Browser kopiert (structuredClone), damit Tests keine Referenzen teilen.

class Anfrage {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}

class Transaktion {
  constructor(speicher, { schreibfehler }) {
    this.speicher = speicher; // Map: Name -> Map der Einträge
    this.schreibfehler = schreibfehler;
    this.offen = 0;
    this.fertig = false;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
  }

  objectStore(name) {
    const daten = this.speicher.get(name);
    if (!daten) throw new Error(`Objektspeicher ${name} gehört nicht zur Transaktion`);
    return {
      get: (schluessel) => this.anfrage(() => structuredClone(daten.get(schluessel))),
      getAll: () => this.anfrage(() => structuredClone([...daten.values()])),
      put: (wert, schluessel) => this.anfrage(() => {
        if (this.schreibfehler) throw new Error('Kein Platz mehr');
        daten.set(schluessel, structuredClone(wert));
        return schluessel;
      }),
    };
  }

  anfrage(ausfuehren) {
    const anfrage = new Anfrage();
    this.offen += 1;
    setTimeout(() => {
      this.offen -= 1;
      try {
        anfrage.result = ausfuehren();
        anfrage.onsuccess?.();
      } catch (fehler) {
        anfrage.error = fehler;
        this.error = fehler;
        anfrage.onerror?.();
        this.onerror?.();
        this.fertig = true;
        this.onabort?.();
        return;
      }
      this.pruefeEnde();
    });
    return anfrage;
  }

  // Wie im Browser: Die Transaktion endet, wenn nach den Rückrufen keine Anfrage mehr offen ist.
  pruefeEnde() {
    setTimeout(() => {
      if (this.offen === 0 && !this.fertig) {
        this.fertig = true;
        this.oncomplete?.();
      }
    });
  }
}

export function erzeugeIndexedDB({ schreibfehler = false } = {}) {
  const datenbanken = new Map();
  const fabrik = {
    schreibfehler,
    open(name, version) {
      const anfrage = new Anfrage();
      setTimeout(() => {
        let eintrag = datenbanken.get(name);
        const upgrade = !eintrag || eintrag.version < version;
        if (!eintrag) {
          eintrag = { version, speicher: new Map() };
          datenbanken.set(name, eintrag);
        }
        const db = {
          objectStoreNames: { contains: (n) => eintrag.speicher.has(n) },
          createObjectStore: (n) => { eintrag.speicher.set(n, new Map()); },
          transaction: (namen) => {
            const liste = Array.isArray(namen) ? namen : [namen];
            const speicher = new Map(liste.map((n) => [n, eintrag.speicher.get(n)]));
            const tx = new Transaktion(speicher, { schreibfehler: fabrik.schreibfehler });
            tx.pruefeEnde();
            return tx;
          },
          close() {},
        };
        anfrage.result = db;
        if (upgrade) {
          eintrag.version = version;
          anfrage.onupgradeneeded?.();
        }
        anfrage.onsuccess?.();
      });
      return anfrage;
    },
    /** Für Tests: gespeicherten Wert direkt lesen oder setzen. */
    roh(name, speicher) {
      return datenbanken.get(name)?.speicher.get(speicher);
    },
  };
  return fabrik;
}
