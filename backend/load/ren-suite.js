// load/ren-suite.js
// Fase 4 · Pruebas de rendimiento. Implementa los perfiles REN-01 a REN-06 del Plan de
// Pruebas de Evaluación de Calidad (casos PT-REN-01 a PT-REN-08) en un solo script k6;
// el perfil se elige con la variable PERFIL. Se reutiliza el modelo de carga de
// pedidos-load.js (misma rampa y misma pausa de 1 s entre iteraciones).
//
//   PERFIL=REN-01  login, 5 VU, 1 min                          (umbral p95 ≤ 500 ms)
//   PERFIL=REN-02  catálogo, 50 VU, 10 s + 60 s + 10 s          (p95 ≤ 600 ms)
//   PERFIL=REN-03  panel del vendedor, 30 VU, 10 s + 60 s + 10 s (p95 ≤ 800 ms)
//   PERFIL=REN-04  compra, 50 VU, 20 s + 30 s + 10 s            (p95 ≤ 800 ms)
//   PERFIL=REN-05  estrés, 0→200 VU en 5 min, 2 min, 1 min      (solo observación)
//   PERFIL=REN-06  resistencia, 30 VU, SOAK_MIN minutos (30 por defecto; admite decimales)
//   PERFIL=BASE    catálogo, 5 VU, 30 s: línea base de PT-REN-08 (antes y después del estrés)
//
// Requisitos: backend y BD con la semilla (database/02_seed.sql); para REN-02/03 cargar además
// load/datos-volumen.sql (60 productos y 300 pedidos). Si el backend corre con NODE_ENV=production
// hay que subir LOGIN_RATE_LIMIT y CHAT_RATE_LIMIT, o el limitador de login bloquea el setup.
//
// Ejemplo:  k6 run --summary-export=resultados/ren-04.json -e PERFIL=REN-04 load/ren-suite.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PERFIL = (__ENV.PERFIL || 'REN-04').toUpperCase();
const SOAK_MIN = Number(__ENV.SOAK_MIN || 30);
// Para ejecutar un perfil por tramos (p. ej. si el entorno limita la duración de cada ejecución),
// STAGES="75s:50,75s:100" reemplaza las etapas del perfil y START_VUS indica desde cuántos VU arranca.
const STAGES_ENV = __ENV.STAGES
  ? __ENV.STAGES.split(',').map((t) => {
      const [duration, target] = t.split(':');
      return { duration, target: Number(target) };
    })
  : null;
const N_PRODUCTOS = Number(__ENV.N_PRODUCTOS || 1);
const JSON_HDR = { 'Content-Type': 'application/json' };
const USUARIOS_SEMILLA = [
  'admin@tutienda.com',
  'vendedor1@tutienda.com',
  'vendedor2@tutienda.com',
  'cliente@correo.com',
];

const rampa = (subida, sostenido, bajada, vu) => [
  { duration: subida, target: vu },
  { duration: sostenido, target: vu },
  { duration: bajada, target: 0 },
];
const umbrales = (p95, p99) => ({
  http_req_failed: ['rate<0.01'],
  http_req_duration: [`p(95)<${p95}`, `p(99)<${p99}`],
  checks: ['rate>0.99'],
});

const PERFILES = {
  'REN-01': { stages: [{ duration: '5s', target: 5 }, { duration: '55s', target: 5 }], thresholds: umbrales(500, 1000), prod: false },
  'REN-02': { stages: rampa('10s', '60s', '10s', 50), thresholds: umbrales(600, 1200), prod: false },
  'REN-03': { stages: rampa('10s', '60s', '10s', 30), thresholds: umbrales(800, 1500), prod: false },
  'REN-04': { stages: rampa('20s', '30s', '10s', 50), thresholds: umbrales(800, 1500), prod: true },
  'REN-05': {
    stages: [
      { duration: '5m', target: 200 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {},
    prod: true,
  },
  'REN-06': {
    stages: [
      { duration: '10s', target: 30 },
      { duration: `${Math.max(1, Math.round(SOAK_MIN * 60) - 10)}s`, target: 30 },
    ], thresholds: umbrales(800, 1500), prod: true },
  BASE: { stages: [{ duration: '30s', target: 5 }], thresholds: {}, prod: false },
};
if (!PERFILES[PERFIL]) throw new Error(`PERFIL desconocido: ${PERFIL}`);
const cfg = PERFILES[PERFIL];

export const options = {
  scenarios: {
    perfil: {
      executor: 'ramping-vus',
      startVUs: Number(__ENV.START_VUS || 0),
      stages: STAGES_ENV || cfg.stages,
      gracefulRampDown: '0s',
    },
  },
  thresholds: cfg.thresholds,
  // Con los umbrales de REN-05 vacíos no se aborta nunca: el objetivo es ver dónde se quiebra.
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function login(email) {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password: 'Password123' }), {
    headers: JSON_HDR,
  });
  if (res.status !== 200) throw new Error(`Login falló para ${email} (${res.status}).`);
  return res.json('token');
}

export function setup() {
  if (PERFIL === 'REN-01') return {};
  const data = { tokenCliente: login('cliente@correo.com') };
  if (PERFIL === 'REN-03') data.tokenVendedor = login('vendedor1@tutienda.com');
  if (cfg.prod) {
    const tokenVendedor = login('vendedor1@tutienda.com');
    // N_PRODUCTOS=1 (por defecto) concentra todas las compras en una sola fila de producto, el peor
    // caso para el bloqueo FOR UPDATE; con N_PRODUCTOS>1 las compras se reparten entre productos.
    data.productos = [];
    for (let i = 0; i < N_PRODUCTOS; i++) {
      const sku = `SKU-LOAD-${Math.floor(Math.random() * 1e6)}`; // VARCHAR(20)
      const prod = http.post(
        `${BASE_URL}/api/productos`,
        JSON.stringify({ nombre: `Producto de carga ${PERFIL}`, sku, precio: 1000, stock: 10000000 }),
        { headers: { ...JSON_HDR, Authorization: `Bearer ${tokenVendedor}` } }
      );
      check(prod, { 'producto de carga creado': (r) => r.status === 201 });
      data.productos.push(prod.json('id'));
    }
  }
  return data;
}

export default function (data) {
  if (PERFIL === 'REN-01') {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: USUARIOS_SEMILLA[(__VU + __ITER) % USUARIOS_SEMILLA.length], password: 'Password123' }),
      { headers: JSON_HDR }
    );
    check(res, { 'login 200': (r) => r.status === 200, 'devuelve token': (r) => !!r.json('token') });
  } else if (PERFIL === 'REN-02' || PERFIL === 'BASE') {
    const res = http.get(`${BASE_URL}/api/productos`, {
      headers: { Authorization: `Bearer ${data.tokenCliente}` },
    });
    check(res, { 'catálogo 200': (r) => r.status === 200, 'lista no vacía': (r) => r.json().length > 0 });
  } else if (PERFIL === 'REN-03') {
    const res = http.get(`${BASE_URL}/api/pedidos/por-tienda`, {
      headers: { Authorization: `Bearer ${data.tokenVendedor}` },
    });
    check(res, { 'panel 200': (r) => r.status === 200, 'trae pedidos': (r) => r.json('datos').length > 0 });
  } else {
    const res = http.post(
      `${BASE_URL}/api/pedidos`,
      JSON.stringify({
        producto_id: data.productos[Math.floor(Math.random() * data.productos.length)],
        cantidad: 1,
      }),
      { headers: { ...JSON_HDR, Authorization: `Bearer ${data.tokenCliente}` } }
    );
    check(res, { 'pedido creado (201)': (r) => r.status === 201 });
  }
  sleep(1);
}
