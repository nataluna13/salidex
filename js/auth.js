// Acceso con "nombre de usuario + contraseña".
// Firebase Auth pide un correo, así que internamente usamos usuario@salidas-amigos.app.
// El usuario nunca lo ve ni necesita un correo real.
import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const DOMINIO = "@salidas-amigos.app";
const PATRON_USUARIO = /^[a-z0-9._-]{3,20}$/i;

const aCorreo = (usuario) => usuario.trim().toLowerCase() + DOMINIO;

function validar(usuario, pass) {
  if (!PATRON_USUARIO.test(usuario.trim())) {
    throw Object.assign(new Error("usuario"), { code: "app/usuario-invalido" });
  }
  if (pass.length < 6) {
    throw Object.assign(new Error("pass"), { code: "auth/weak-password" });
  }
}

/** Nombre visible del usuario conectado (el que escribió al registrarse). */
export function nombreActual() {
  const u = auth.currentUser;
  return u ? (u.displayName || u.email.split("@")[0]) : "";
}

export const uidActual = () => auth.currentUser?.uid ?? null;

export const escucharSesion = (callback) => onAuthStateChanged(auth, callback);

export async function registrar(usuario, pass) {
  validar(usuario, pass);
  const cred = await createUserWithEmailAndPassword(auth, aCorreo(usuario), pass);
  await updateProfile(cred.user, { displayName: usuario.trim() });
}

export async function ingresar(usuario, pass) {
  validar(usuario, pass);
  await signInWithEmailAndPassword(auth, aCorreo(usuario), pass);
}

export const salir = () => signOut(auth);

/** Traduce los errores de Firebase a mensajes claros en español. */
export function mensajeError(e) {
  const mensajes = {
    "app/usuario-invalido": "El usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo (sin espacios ni tildes).",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/email-already-in-use": "Ese nombre de usuario ya existe. Elige otro o ingresa.",
    "auth/invalid-credential": "Usuario o contraseña incorrectos.",
    "auth/user-not-found": "Ese usuario no existe. Crea tu cuenta primero.",
    "auth/wrong-password": "Usuario o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a probar.",
    "auth/network-request-failed": "No hay conexión con Firebase. Revisa tu internet.",
    "auth/operation-not-allowed": "Falta activar «Correo/contraseña» en Firebase → Authentication → Método de acceso.",
    "auth/invalid-api-key": "La apiKey de firebase-config.js no es válida.",
  };
  return mensajes[e.code] ?? `Error: ${e.code || e.message}`;
}
