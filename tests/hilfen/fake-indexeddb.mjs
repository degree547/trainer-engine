// Kleine Nachbildung von IndexedDB für node --test (ohne Pakete).
// Sie kann nur, was M7 benutzt: open mit Upgrade, ein Objektspeicher mit
// eigenen Schlüsseln, get und put in Transaktionen. Werte werden wie im
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
  constructor(daten, { schreibfehler }) {
    this.daten = daten;
    this.schreibfehler = schreibfehler;
    this.offen = 0;
    this.fertig = false;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
  }

  objectStore() {
    return {
      get: (schluessel) => this.anfrage(() => structuredClone(this.daten.get(schluessel))),
      put: (wert, schluessel) => this.anfrage(() => {
        if (this.schreibfehler) throw new Error('Kein Platz mehr');
        this.daten.set(schluessel, structuredClone(wert));
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
          transaction: (n) => {
            const tx = new Transaktion(eintrag.speicher.get(n), { schreibfehler: fabrik.schreibfehler });
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
