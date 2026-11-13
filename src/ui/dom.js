// Kleine Hilfe zum Erzeugen von HTML-Elementen für die Bildschirme.

/**
 * el('button', { class: 'knopf', onclick: fn }, 'Text', kindElement)
 * Attribute mit Wert null oder false werden weggelassen.
 */
export function el(tag, attribute = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(attribute)) {
    if (wert === null || wert === false || wert === undefined) continue;
    if (name.startsWith('on')) knoten.addEventListener(name.slice(2), wert);
    else knoten.setAttribute(name, wert === true ? '' : wert);
  }
  for (const kind of kinder) if (kind !== null && kind !== undefined && kind !== false) knoten.append(kind);
  return knoten;
}
