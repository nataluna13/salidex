// Punto de entrada: decide qué pantalla mostrar (config / login / app) y conecta botones.
import { firebaseConfig } from "./firebase-config.js";
import { $, $$ } from "./utils.js";

const pantallaConfig = $("#pantalla-config");
const pantallaLogin = $("#pantalla-login");
const app = $("#app");

// ¿Ya pegaron la configuración de Firebase?
const configLista = Object.values(firebaseConfig).every((v) => v && !String(v).includes("PEGA_AQUI"));

if (!configLista) {
  pantallaConfig.hidden = false;
} else {
  iniciar();
}

async function iniciar() {
  // Se cargan los módulos de Firebase solo cuando la configuración existe.
  const auth = await import("./auth.js");
  const salidas = await import("./salidas.js");

  /* ----- Cierre de ventanas (botones ✕ / Cancelar) ----- */
  document.addEventListener("click", (e) => {
    const cerrar = e.target.closest("[data-cerrar]");
    if (cerrar) cerrar.closest("dialog").close();
  });

  /* ----- Login / registro ----- */
  let modo = "ingresar";
  const formAuth = $("#form-auth");
  const errorAuth = $("#auth-error");

  $$(".tabs button").forEach((tab) => tab.addEventListener("click", () => {
    modo = tab.dataset.modo;
    $$(".tabs button").forEach((t) => {
      t.classList.toggle("activo", t === tab);
      t.setAttribute("aria-selected", String(t === tab));
    });
    $("#auth-submit").textContent = modo === "ingresar" ? "Ingresar" : "Crear mi cuenta";
    $("#auth-pass").autocomplete = modo === "ingresar" ? "current-password" : "new-password";
    errorAuth.hidden = true;
  }));

  formAuth.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorAuth.hidden = true;
    const boton = $("#auth-submit");
    boton.disabled = true;
    try {
      const usuario = $("#auth-usuario").value;
      const pass = $("#auth-pass").value;
      await (modo === "ingresar" ? auth.ingresar(usuario, pass) : auth.registrar(usuario, pass));
      $("#nombre-usuario").textContent = auth.nombreActual();   // ya con el displayName guardado
      formAuth.reset();
    } catch (err) {
      errorAuth.textContent = auth.mensajeError(err);
      errorAuth.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });

  $("#btn-salir").addEventListener("click", () => auth.salir());
  $("#btn-nueva").addEventListener("click", () => salidas.abrirFormulario());

  /* ----- Sesión: muestra login o dashboard ----- */
  let reloj = null;
  auth.escucharSesion((usuario) => {
    pantallaLogin.hidden = !!usuario;
    app.hidden = !usuario;

    if (usuario) {
      $("#nombre-usuario").textContent = auth.nombreActual();
      salidas.detenerSalidas();          // evita escuchas duplicadas
      salidas.escucharSalidas();
      // Recalcula las alertas cada 30 s sin recargar la página.
      clearInterval(reloj);
      reloj = setInterval(salidas.refrescar, 30_000);
    } else {
      salidas.detenerSalidas();
      clearInterval(reloj);
    }
  });

  // Al volver a la pestaña, se actualizan las alertas de inmediato.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) salidas.refrescar(); });
}
