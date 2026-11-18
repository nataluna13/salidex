// Salidas: lectura en tiempo real, tarjetas, filtros, alertas, formulario y cancelación.
import { db } from "./firebase.js";
import { nombreActual, uidActual } from "./auth.js";
import { analizarTiempo } from "./fechas.js";
import { abrirAlbum, borrarAlbum } from "./recuerdos.js";
import {
  $, esc, toast, urlSegura, urlMaps, formatearFecha, aInputFecha, TIPOS, ESTADOS,
} from "./utils.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy,
  serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const lista = $("#lista-salidas");
const dlgSalida = $("#dlg-salida");
const formSalida = $("#form-salida");

let salidas = [];                 // copia local, siempre sincronizada con Firestore
let filtroEstado = "todas";
let filtroTipo = "todos";
let cancelarEscucha = null;
let primeraCarga = true;
const estadosPrevios = new Map(); // id → estado anterior (para avisar de cambios de otros)
let editandoId = null;

/* ---------------------------------------------------------------- Tiempo real */

export function escucharSalidas() {
  const q = query(collection(db, "salidas"), orderBy("fechaHora", "asc"));

  cancelarEscucha = onSnapshot(q, (snap) => {
    // Avisos cuando OTRO usuario cambia algo (los cambios propios no se anuncian).
    if (!primeraCarga) {
      snap.docChanges().forEach((c) => {
        if (c.doc.metadata.hasPendingWrites) return;
        const d = c.doc.data();
        if (c.type === "added") {
          toast(`🆕 ${d.creadoPor} planeó «${d.lugar}»`, "info");
        } else if (c.type === "modified" && estadosPrevios.get(c.doc.id) !== d.estado) {
          if (d.estado === "cancelada") toast(`🚫 ${d.modificadoPor} canceló «${d.lugar}»`, "alerta", 7000);
          if (d.estado === "cumplida") toast(`🎉 «${d.lugar}» se marcó como cumplida`, "ok");
        }
      });
    }
    primeraCarga = false;

    salidas = snap.docs.map((d) => {
      const datos = d.data();
      estadosPrevios.set(d.id, datos.estado);
      return { id: d.id, ...datos, fecha: datos.fechaHora.toDate() };
    });
    pintar();
  }, (e) => {
    console.error(e);
    toast(`No se pudieron leer las salidas (${e.code}). Revisa las reglas de Firestore.`, "error", 8000);
  });
}

export function detenerSalidas() {
  cancelarEscucha?.();
  cancelarEscucha = null;
  salidas = [];
  primeraCarga = true;
  estadosPrevios.clear();
}

/** Vuelve a dibujar (se llama cada 30 s para que las alertas se actualicen solas). */
export function refrescar() {
  if (cancelarEscucha) pintar();
}

/* ---------------------------------------------------------------- Pintar */

const ORDEN_ESTADO = { pendiente: 0, cumplida: 1, cancelada: 2 };

function pintar() {
  const ahora = new Date();
  pintarFiltros();
  pintarBanner(ahora);

  const visibles = salidas
    .filter((s) => (filtroEstado === "todas" || s.estado === filtroEstado)
      && (filtroTipo === "todos" || s.tipo === filtroTipo))
    .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]
      // pendientes: la más próxima primero; el resto: la más reciente primero
      || (a.estado === "pendiente" ? a.fecha - b.fecha : b.fecha - a.fecha));

  lista.innerHTML = visibles.map((s) => tarjeta(s, ahora)).join("");
  $("#vacio").hidden = visibles.length > 0;
}

function pintarFiltros() {
  const cuenta = (id) => id === "todas" ? salidas.length : salidas.filter((s) => s.estado === id).length;
  const opciones = [{ id: "todas", label: "Todas" }, ...ESTADOS];
  $("#filtro-estado").innerHTML = opciones.map((o) =>
    `<button type="button" class="${o.id === filtroEstado ? "on" : ""}" data-filtro="${o.id}">${o.label} <span>${cuenta(o.id)}</span></button>`
  ).join("");
}

function pintarBanner(ahora) {
  const alertas = salidas
    .filter((s) => s.estado === "pendiente")
    .map((s) => ({ s, t: analizarTiempo(s.fecha, ahora) }))
    .filter(({ t }) => t.nivel === "urgente" || t.nivel === "aviso");

  const banner = $("#banner-alertas");
  banner.hidden = alertas.length === 0;
  banner.innerHTML = alertas.length ? `
    <div class="banner-titulo">🔔 Se acercan salidas</div>
    <ul>${alertas.map(({ s, t }) => `
      <li class="${t.nivel}"><strong>${TIPOS[s.tipo].emoji} ${esc(s.lugar)}</strong><span>${esc(t.texto)}</span></li>`).join("")}
    </ul>` : "";
}

function tarjeta(s, ahora) {
  const tipo = TIPOS[s.tipo] ?? TIPOS.comer;
  const t = s.estado === "pendiente" ? analizarTiempo(s.fecha, ahora) : null;
  const clases = ["card", `tipo-${s.tipo}`, `estado-${s.estado}`];
  if (t && t.nivel !== "lejana") clases.push(`alerta-${t.nivel}`);

  const enlace = urlSegura(s.enlace);
  const esCreador = s.creadoPorUid === uidActual();

  return `
  <article class="${clases.join(" ")}" data-id="${esc(s.id)}">
    <div class="card-top">
      <span class="chip chip-tipo">${tipo.emoji} ${tipo.label}</span>
      ${t && t.nivel !== "lejana" ? `<span class="pill pill-${t.nivel}">${esc(t.texto)}</span>`
        : t ? `<span class="pill pill-lejana">${esc(t.texto)}</span>` : ""}
    </div>

    <h3>${esc(s.lugar)}</h3>
    <p class="fecha">🗓️ ${formatearFecha(s.fecha)}</p>

    ${s.estado === "cancelada" ? `<p class="ribbon">🚫 Cancelada por <strong>${esc(s.canceladoPor ?? s.modificadoPor ?? "alguien")}</strong></p>` : ""}

    <ul class="datos">
      <li>📍 <a href="${esc(s.mapsUrl)}" target="_blank" rel="noopener">${esc(s.direccion)}</a></li>
      ${s.telefono ? `<li>📞 <a href="tel:${esc(s.telefono.replace(/[^\d+]/g, ""))}">${esc(s.telefono)}</a></li>` : ""}
      ${enlace ? `<li>🔗 <a href="${esc(enlace)}" target="_blank" rel="noopener">Ver referencia</a></li>` : ""}
    </ul>

    ${s.descripcion ? `<p class="desc">${esc(s.descripcion)}</p>` : ""}

    <div class="seg" role="group" aria-label="Estado de la salida">
      ${ESTADOS.map((e) => `
        <button type="button" class="seg-btn seg-${e.id} ${e.id === s.estado ? "on" : ""}"
                data-accion="estado" data-valor="${e.id}" aria-pressed="${e.id === s.estado}">${e.emoji} ${e.label}</button>`).join("")}
    </div>

    <div class="card-pie">
      <span class="autor">por <strong>${esc(s.creadoPor ?? "?")}</strong></span>
      <div class="acciones">
        ${s.estado === "cumplida" ? `<button type="button" class="btn btn-crema btn-sm" data-accion="album">📸 Álbum</button>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" data-accion="editar">✏️ Editar</button>
        ${esCreador ? `<button type="button" class="icon-btn" data-accion="eliminar" aria-label="Eliminar salida" title="Eliminar">🗑️</button>` : ""}
      </div>
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- Eventos de la lista y filtros */

$("#filtro-estado").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filtro]");
  if (!b) return;
  filtroEstado = b.dataset.filtro;
  pintar();
});

$("#filtro-tipo").addEventListener("change", (e) => {
  filtroTipo = e.target.value;
  pintar();
});

lista.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-accion]");
  if (!boton) return;
  const id = boton.closest("[data-id]").dataset.id;
  const s = salidas.find((x) => x.id === id);
  if (!s) return;

  switch (boton.dataset.accion) {
    case "estado": return cambiarEstado(s, boton.dataset.valor);
    case "editar": return abrirFormulario(s);
    case "album": return abrirAlbum(s);
    case "eliminar": return eliminar(s);
  }
});

/* ---------------------------------------------------------------- Cambiar estado / cancelar */

async function cambiarEstado(s, estado) {
  if (s.estado === estado) return;
  if (estado === "cancelada" && !confirm(`¿Cancelar «${s.lugar}»?\nTodo el grupo verá la cancelación al instante.`)) return;

  try {
    await updateDoc(doc(db, "salidas", s.id), {
      estado,
      modificadoPor: nombreActual(),
      modificadoEn: serverTimestamp(),
      canceladoPor: estado === "cancelada" ? nombreActual() : null,
    });
    if (estado === "cumplida") toast("🎉 ¡Cumplida! Ya puedes subir fotos al álbum.", "ok");
    if (estado === "cancelada") toast("Salida cancelada. Tus amigos ya lo ven.", "alerta");
  } catch (e) {
    toast(`No se pudo actualizar: ${e.code || e.message}`, "error");
  }
}

async function eliminar(s) {
  if (!confirm(`¿Eliminar «${s.lugar}» para siempre?\nTambién se borrarán sus fotos.`)) return;
  try {
    await borrarAlbum(s.id);
    await deleteDoc(doc(db, "salidas", s.id));
    toast("Salida eliminada", "ok");
  } catch (e) {
    toast(`No se pudo eliminar: ${e.code || e.message}`, "error");
  }
}

/* ---------------------------------------------------------------- Formulario crear / editar */

export function abrirFormulario(s = null) {
  editandoId = s?.id ?? null;
  formSalida.reset();
  $("#salida-error").hidden = true;
  $("#salida-titulo").textContent = s ? "Editar salida" : "Nueva salida";
  $("#salida-guardar").textContent = s ? "Guardar cambios" : "Guardar salida";

  const f = formSalida.elements;
  if (s) {
    f.lugar.value = s.lugar;
    f.direccion.value = s.direccion;
    f.mapsLink.value = s.mapsLink ?? "";
    f.fechaHora.value = aInputFecha(s.fecha);
    f.tipo.value = s.tipo;
    f.telefono.value = s.telefono ?? "";
    f.estado.value = s.estado;
    f.descripcion.value = s.descripcion ?? "";
    f.enlace.value = s.enlace ?? "";
    f.fechaHora.removeAttribute("min");
  } else {
    f.fechaHora.min = aInputFecha(new Date());   // no se pueden planear salidas en el pasado
  }
  dlgSalida.showModal();
}

formSalida.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = formSalida.elements;
  const errorEl = $("#salida-error");
  errorEl.hidden = true;

  const fecha = new Date(f.fechaHora.value);   // objeto Date estándar (hora local)
  if (Number.isNaN(fecha.getTime())) return mostrarError("Elige una fecha y hora válidas.");

  const datos = {
    lugar: f.lugar.value.trim(),
    direccion: f.direccion.value.trim(),
    mapsLink: f.mapsLink.value.trim(),
    mapsUrl: urlMaps(f.direccion.value.trim(), f.mapsLink.value),
    telefono: f.telefono.value.trim(),
    fechaHora: Timestamp.fromDate(fecha),
    tipo: f.tipo.value,
    estado: f.estado.value,
    descripcion: f.descripcion.value.trim(),
    enlace: f.enlace.value.trim(),
    modificadoPor: nombreActual(),
    modificadoEn: serverTimestamp(),
  };
  datos.canceladoPor = datos.estado === "cancelada" ? nombreActual() : null;

  const boton = $("#salida-guardar");
  boton.disabled = true;
  try {
    if (editandoId) {
      await updateDoc(doc(db, "salidas", editandoId), datos);
      toast("✏️ Salida actualizada", "ok");
    } else {
      await addDoc(collection(db, "salidas"), {
        ...datos,
        creadoPor: nombreActual(),          // se captura solo, no se escribe a mano
        creadoPorUid: uidActual(),
        creadoEn: serverTimestamp(),
      });
      toast("🎉 ¡Salida creada! Tus amigos ya la ven.", "ok");
    }
    dlgSalida.close();
  } catch (err) {
    mostrarError(`No se pudo guardar: ${err.code || err.message}`);
  } finally {
    boton.disabled = false;
  }
});

function mostrarError(texto) {
  const el = $("#salida-error");
  el.textContent = texto;
  el.hidden = false;
}
