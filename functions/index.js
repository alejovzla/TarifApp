const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/* Misma formula que index.html (mantener sincronizado si cambian las tarifas) */
const PRECIO_KM = 0.50;
const PRECIO_MIN = 0.09;
const VEHICULOS = {
  moto: { banderazo: 0.75, minimo: 1.50 },
  carro: { banderazo: 1.25, minimo: 2.50 },
};
const DEMANDA_FACTORS = { regular: 1.0, alta: 1.5, pico: 2.0 };

/* Codigos WMO de lluvia/tormenta (igual que en index.html) */
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

async function demandaPorClima(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "regular";
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`
    );
    const data = await res.json();
    const code = data.current?.weather_code;
    const temp = data.current?.temperature_2m;
    if (RAIN_WEATHER_CODES.has(code)) return "pico";
    if (typeof temp === "number" && temp >= 30) return "alta";
    return "regular";
  } catch (e) {
    return "regular";
  }
}

/**
 * Calcula la tarifa final del lado del servidor -- el chofer no puede alterar
 * banderazo, precio por km/minuto ni el factor de demanda editando el JavaScript
 * de su navegador, porque el numero que se cobra sale de aqui, no del telefono.
 */
exports.calcularTarifa = onCall({ region: "southamerica-east1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const driverSnap = await db.collection("drivers").doc(request.auth.uid).get();
  const paidUntil = driverSnap.data()?.paidUntil?.toDate?.();
  if (!paidUntil || paidUntil < new Date()) {
    throw new HttpsError("permission-denied", "Suscripción vencida.");
  }

  const { vehiculo, km, min, lat, lng } = request.data || {};
  const veh = VEHICULOS[vehiculo];
  if (!veh) {
    throw new HttpsError("invalid-argument", "Vehículo inválido.");
  }

  const kmNum = Number(km);
  const minNum = Number(min);
  if (!Number.isFinite(kmNum) || !Number.isFinite(minNum) || kmNum < 0 || minNum < 0 || kmNum > 500 || minNum > 1440) {
    throw new HttpsError("invalid-argument", "Distancia o tiempo fuera de rango.");
  }

  const demanda = await demandaPorClima(Number(lat), Number(lng));
  const factor = DEMANDA_FACTORS[demanda];
  const precio = Math.max((veh.banderazo + kmNum * PRECIO_KM + minNum * PRECIO_MIN) * factor, veh.minimo);

  return { precio: Math.round(precio * 100) / 100, demanda, factor };
});
