// Álbum de recuerdos: subir fotos, verlas en Tarjetas o Carrusel, borrarlas.
// Las imágenes van a Firebase Storage; en Firestore se guarda un documento por foto
// (colección "fotos") con su URL y a qué salida pertenece.
// Si Storage no está disponible, la foto se guarda comprimida dentro de Firestore.
import { db, storage } from "./firebase.js";
import { USAR_STORAGE } from "./firebase-config.js";
import { nombreActual, uidActual } from "./auth.js";
import { $, $$, esc, toast } from "./utils.js";
import {
  collection, addDoc, deleteDoc, doc, getDocs, onSnapshot, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const dlg = $("#dlg-album");
const contenido = $("#album-contenido");
const progreso = $("#album-progreso");

let salidaActual = null;
let fotos = [];
let vista = "cards";      // "cards" | "carrusel"
let indice = 0;           // foto visible en el carrusel
let cancelarEscucha = null;
let storageFunciona = USAR_STORAGE;

/* ---------------------------------------------------------------- Abrir / cerrar */

export function abrirAlbum(salida) {
  salidaActual = salida;
  fotos = [];
  indice = 0;
  $("#album-titulo").textContent = salida.lugar;
  $("#album-sub").textContent = "Cargando fotos…";
  // Solo las salidas cumplidas pueden recibir fotos nuevas.
  $("#album-subir").hidden = salida.estado !== "cumplida";
  cambiarVista("cards");
  pintar();
  dlg.showModal();

  // Escucha en tiempo real: si un amigo sube una foto, aparece al instante.
  const q = query(collection(db, "fotos"), where("salidaId", "==", salida.id));
  cancelarEscucha = onSnapshot(q, (snap) => {
    fotos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.creadoEn?.toMillis?.() ?? Infinity) - (b.creadoEn?.toMillis?.() ?? Infinity));
    indice = Math.min(indice, Math.max(fotos.length - 1, 0));
    $("#album-sub").textContent = fotos.length
      ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"}`
      : "Aún no hay fotos";
    pintar();
  }, (e) => toast(`No se pudo cargar el álbum: ${e.code}`, "error"));
}

dlg.addEventListener("close", () => {
  cancelarEscucha?.();
  cancelarEscucha = null;
  salidaActual = null;
});

// Cerrar al tocar fuera del recuadro.
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

/* ---------------------------------------------------------------- Vistas */

function cambiarVista(nueva) {
  vista = nueva;
  $$("[data-vista]", dlg).forEach((b) => {
    const activo = b.dataset.vista === nueva;
    b.classList.toggle("on", activo);
    b.setAttribute("aria-pressed", String(activo));
  });
}

$$("[data-vista]", dlg).forEach((b) =>
  b.addEventListener("click", () => { cambiarVista(b.dataset.vista); pintar(); }));

function pintar() {
  if (!fotos.length) {
    const puede = salidaActual?.estado === "cumplida";
    contenido.innerHTML = `<div class="vacio"><div class="vacio-emoji">🖼️</div>
      <p>${puede ? "Sube la primera foto de esta salida." : "Marca la salida como «Cumplida» para subir fotos."}</p></div>`;
    return;
  }
  contenido.innerHTML = vista === "cards" ? htmlTarjetas() : htmlCarrusel();
  if (vista === "carrusel") activarCarrusel();
}

const htmlBorrar = (f) => f.subidoPorUid === uidActual()
  ? `<button class="icon-btn foto-borrar" data-borrar="${esc(f.id)}" aria-label="Borrar foto" title="Borrar mi foto">🗑️</button>` : "";

function htmlTarjetas() {
  return `<div class="fotos-grid">${fotos.map((f, i) => `
    <figure class="foto-card">
      <img src="${esc(f.url)}" alt="Recuerdo de ${esc(salidaActual.lugar)}" loading="lazy" data-abrir="${i}">
      <figcaption>📷 ${esc(f.subidoPor ?? "")}</figcaption>
      ${htmlBorrar(f)}
    </figure>`).join("")}</div>`;
}

function htmlCarrusel() {
  return `<div class="carrusel" tabindex="0" aria-roledescription="carrusel">
    <div class="car-viewport">
      <div class="car-track" style="transform:translateX(-${indice * 100}%)">
        ${fotos.map((f, i) => `
          <figure class="car-slide" aria-hidden="${i !== indice}">
            <img src="${esc(f.url)}" alt="Foto ${i + 1} de ${fotos.length}" draggable="false">
            <figcaption>📷 ${esc(f.subidoPor ?? "")}</figcaption>
            ${i === indice ? htmlBorrar(f) : ""}
          </figure>`).join("")}
      </div>
    </div>
    <button class="car-nav prev" aria-label="Anterior" ${fotos.length < 2 ? "hidden" : ""}>‹</button>
    <button class="car-nav next" aria-label="Siguiente" ${fotos.length < 2 ? "hidden" : ""}>›</button>
    <div class="car-dots">${fotos.map((_, i) =>
      `<button class="${i === indice ? "on" : ""}" data-ir="${i}" aria-label="Ir a la foto ${i + 1}"></button>`).join("")}</div>
    <div class="car-count">${indice + 1} / ${fotos.length}</div>
  </div>`;
}

/* ---------------------------------------------------------------- Carrusel */

function irA(n) {
  indice = (n + fotos.length) % fotos.length;
  pintar();
  $(".carrusel", dlg)?.focus({ preventScroll: true });
}

function activarCarrusel() {
  const car = $(".carrusel", dlg);
  $(".prev", car).onclick = () => irA(indice - 1);
  $(".next", car).onclick = () => irA(indice + 1);

  // Deslizar con el dedo / mouse.
  const visor = $(".car-viewport", car);
  let inicioX = null;
  visor.onpointerdown = (e) => { inicioX = e.clientX; };
  visor.onpointerup = (e) => {
    if (inicioX === null) return;
    const dx = e.clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 40 && fotos.length > 1) irA(indice + (dx < 0 ? 1 : -1));
  };
  visor.onpointercancel = () => { inicioX = null; };
}

// Teclado: ← → cambian de foto en el carrusel.
dlg.addEventListener("keydown", (e) => {
  if (vista !== "carrusel" || fotos.length < 2) return;
  if (e.key === "ArrowRight") irA(indice + 1);
  if (e.key === "ArrowLeft") irA(indice - 1);
});

// Clicks dentro del contenido (delegación de eventos).
contenido.addEventListener("click", (e) => {
  const borrar = e.target.closest("[data-borrar]");
  if (borrar) return borrarFoto(borrar.dataset.borrar);

  const punto = e.target.closest("[data-ir]");
  if (punto) return irA(Number(punto.dataset.ir));

  const img = e.target.closest("[data-abrir]");   // tocar una tarjeta abre el carrusel en esa foto
  if (img) { indice = Number(img.dataset.abrir); cambiarVista("carrusel"); pintar(); }
});

/* ---------------------------------------------------------------- Subida de fotos */

$("#album-subir").addEventListener("click", () => $("#album-input").click());

$("#album-input").addEventListener("change", async (e) => {
  const archivos = [...e.target.files];
  e.target.value = "";
  if (!archivos.length || !salidaActual) return;

  const salida = salidaActual;
  progreso.hidden = false;
  let subidas = 0;

  for (const [i, archivo] of archivos.entries()) {
    actualizarProgreso(i, archivos.length, `Subiendo ${i + 1} de ${archivos.length}…`);
    try {
      await subirFoto(archivo, salida);
      subidas++;
    } catch (err) {
      console.error(err);
      toast(`No se pudo subir «${archivo.name}»: ${err.message}`, "error");
    }
  }

  actualizarProgreso(archivos.length, archivos.length, "¡Listo!");
  setTimeout(() => { progreso.hidden = true; }, 1200);
  if (subidas) toast(`📸 ${subidas} foto${subidas === 1 ? "" : "s"} guardada${subidas === 1 ? "" : "s"} en el álbum`, "ok");
});

function actualizarProgreso(hechas, total, texto) {
  $(".barra span", progreso).style.width = `${(hechas / total) * 100}%`;
  $("small", progreso).textContent = texto;
}

async function subirFoto(archivo, salida) {
  if (!archivo.type.startsWith("image/")) throw new Error("no es una imagen");

  const datos = {
    salidaId: salida.id,
    subidoPor: nombreActual(),
    subidoPorUid: uidActual(),
    creadoEn: serverTimestamp(),
  };

  // 1) Firebase Storage (lo normal)
  if (storageFunciona) {
    try {
      const blob = await comprimir(archivo, 1600, 0.82);
      const ruta = `recuerdos/${salida.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const referencia = ref(storage, ruta);
      await uploadBytes(referencia, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(referencia);
      await addDoc(collection(db, "fotos"), { ...datos, url, ruta });
      return;
    } catch (err) {
      console.warn("Storage falló, se usa Firestore:", err);
      storageFunciona = false;   // no insistir con el resto de fotos
      toast("Storage no está disponible: guardo las fotos dentro de Firestore.", "alerta", 6000);
    }
  }

  // 2) Plan B: foto pequeña en base64 dentro de Firestore (límite 1 MB por documento)
  const blob = await comprimir(archivo, 900, 0.7);
  const url = await blobADataURL(blob);
  if (url.length > 950_000) throw new Error("la foto es demasiado grande");
  await addDoc(collection(db, "fotos"), { ...datos, url, ruta: null });
}

/** Reduce la imagen (máx. `lado` px) y la convierte a JPEG para ahorrar datos. */
async function comprimir(archivo, lado, calidad) {
  const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" })
    .catch(() => { throw new Error("formato de imagen no compatible"); });
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((ok, fallo) =>
    canvas.toBlob((b) => (b ? ok(b) : fallo(new Error("no se pudo procesar la imagen"))), "image/jpeg", calidad));
}

const blobADataURL = (blob) => new Promise((ok, fallo) => {
  const lector = new FileReader();
  lector.onload = () => ok(lector.result);
  lector.onerror = () => fallo(lector.error);
  lector.readAsDataURL(blob);
});

/* ---------------------------------------------------------------- Borrar */

async function borrarFoto(id) {
  const foto = fotos.find((f) => f.id === id);
  if (!foto || !confirm("¿Borrar esta foto del álbum?")) return;
  try {
    await deleteDoc(doc(db, "fotos", id));
    if (foto.ruta) await deleteObject(ref(storage, foto.ruta)).catch(() => {});
    toast("Foto borrada", "ok");
  } catch (e) {
    toast(`No se pudo borrar: ${e.code || e.message}`, "error");
  }
}

/** Borra todas las fotos de una salida (se usa al eliminar la salida). */
export async function borrarAlbum(salidaId) {
  const snap = await getDocs(query(collection(db, "fotos"), where("salidaId", "==", salidaId)));
  await Promise.all(snap.docs.map(async (d) => {
    const { ruta } = d.data();
    if (ruta) await deleteObject(ref(storage, ruta)).catch(() => {});
    await deleteDoc(d.ref);
  }));
}
