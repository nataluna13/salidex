// ============================================================
//  CONFIGURACIÓN DE FIREBASE
//  Pega aquí los datos de tu proyecto (README.md → sección 2).
//  Firebase Console → ⚙️ Configuración del proyecto → "Tus apps" → Web.
//  Nota: estas claves NO son secretas; la seguridad la dan las reglas.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDJE_42nHKrS7ly4btBBDp6o0XKvQE2X_g",
  authDomain: "salidex.firebaseapp.com",
  projectId: "salidex",
  storageBucket: "salidex.firebasestorage.app",
  messagingSenderId: "3042177046",
  appId: "1:3042177046:web:24919b0d3195a434040537"
};

// true  → las fotos se suben a Firebase Storage (lo que pide la práctica).
// false → se guardan comprimidas dentro de Firestore (plan gratis sin tarjeta).
// Si Storage falla (p. ej. no está activado), la app cambia sola a Firestore.
export const USAR_STORAGE = true;
