// Utilidades pequeñas y constantes compartidas.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

export const TIPOS = {
  comer: { label: "Salir a comer", emoji: "🍽️" },
  casa: { label: "Hacer en casa", emoji: "🏠" },
  jugar: { label: "Salida para jugar", emoji: "🎮" },
};

export const ESTADOS = [
  { id: "pendiente", label: "Pendiente", emoji: "⏳" },
  { id: "cumplida", label: "Cumplida", emoji: "✅" },
  { id: "cancelada", label: "Cancelada", emoji: "🚫" },
];

/** Escapa texto para insertarlo de forma segura en HTML (evita inyección). */
export function esc(texto = "") {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** Devuelve la URL solo si es http(s); si no, cadena vacía. */
export function urlSegura(valor = "") {
  try {
    const u = new URL(String(valor).trim());
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

/** Enlace a Google Maps: usa el pegado por el usuario o lo genera con la dirección. */
export function urlMaps(direccion, enlaceManual) {
  return urlSegura(enlaceManual)
    || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

/** "mar, 18 nov · 19:30" en horario local. */
export function formatearFecha(fecha) {
  const dia = fecha.toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" });
  const hora = fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia} · ${hora}`;
}

/** Date → valor para <input type="datetime-local"> (hora local, sin zona). */
export function aInputFecha(fecha) {
  const p = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}

/** Aviso flotante temporal. tipo: "info" | "ok" | "error" | "alerta". */
export function toast(mensaje, tipo = "info", ms = 4500) {
  const caja = $("#toasts");
  if ([...caja.children].some((t) => t.textContent === mensaje)) return;   // evita avisos repetidos
  const el = document.createElement("div");
  el.className = `toast toast-${tipo}`;
  el.textContent = mensaje;
  caja.appendChild(el);
  setTimeout(() => {
    el.classList.add("saliendo");
    setTimeout(() => el.remove(), 300);
  }, ms);
}
