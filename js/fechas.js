// Lógica de tiempo restante. Todo se calcula con objetos Date estándar
// (milisegundos desde 1970), así no hay problemas de zonas horarias ni de formato.

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// Umbrales (fáciles de ajustar):
const UMBRAL_URGENTE = 6 * HORA;   // "pocas horas"
const UMBRAL_AVISO = 2 * DIA;      // hasta 48 h → avisos de "falta 1 día"

/**
 * Analiza cuánto falta para una salida.
 * @param {Date} fecha  Fecha y hora de la salida.
 * @param {Date} ahora  Momento actual (se puede inyectar para pruebas).
 * @returns {{nivel: "pasada"|"urgente"|"aviso"|"lejana", texto: string, ms: number}}
 *   - pasada:  la hora ya pasó y sigue pendiente
 *   - urgente: faltan pocas horas (≤ 6 h)
 *   - aviso:   falta aproximadamente 1 día (≤ 48 h)
 *   - lejana:  falta más tiempo
 */
export function analizarTiempo(fecha, ahora = new Date()) {
  const ms = fecha.getTime() - ahora.getTime();

  if (ms < 0) {
    return { nivel: "pasada", ms, texto: "La hora ya pasó: ¿se cumplió?" };
  }
  if (ms <= UMBRAL_URGENTE) {
    const horas = Math.floor(ms / HORA);
    const min = Math.floor((ms % HORA) / 60000);
    if (horas === 0) {
      return { nivel: "urgente", ms, texto: min <= 1 ? "¡Es ahora mismo!" : `¡Faltan ${min} min!` };
    }
    return { nivel: "urgente", ms, texto: `¡Faltan ${horas} h ${min} min!` };
  }
  if (ms <= DIA) {
    return { nivel: "aviso", ms, texto: `Es hoy · faltan ${Math.floor(ms / HORA)} h` };
  }
  if (ms <= UMBRAL_AVISO) {
    return { nivel: "aviso", ms, texto: "Falta 1 día" };
  }
  const dias = Math.ceil(ms / DIA);
  return { nivel: "lejana", ms, texto: `En ${dias} días` };
}
