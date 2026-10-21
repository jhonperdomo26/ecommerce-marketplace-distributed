// docs/practica_validacion/rendimiento/pedidos-breakpoint-k6.js
//
// Segunda corrida del Módulo 1 (Rendimiento): la corrida anterior
// (pedidos-stress-k6.js) llegó a 300 VUs sin errores (0% fallidas, p95=775ms).
// Esta sube más agresivo (hasta 900 VUs) para encontrar el punto real de
// quiebre de POST /api/pedidos y confirmar la hipótesis: el pool de
// conexiones de pg (`new Pool({...})` en src/db.ts, SIN `max` configurado →
// por defecto 10) se agota antes que la base de datos o el `FOR UPDATE`.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '20s', target: 300 },
    { duration: '20s', target: 600 },
    { duration: '30s', target: 900 },
    { duration: '20s', target: 0 },
  ],
};

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    throw new Error(`Login falló para ${email} (${res.status}).`);
  }
  return res.json('token');
}

export function setup() {
  const tokenVendedor = login('vendedor1@tutienda.com', 'Password123');
  const sku = `SKU-BRK-${Math.floor(Math.random() * 1e6)}`;
  const prod = http.post(
    `${BASE_URL}/api/productos`,
    JSON.stringify({ nombre: 'Producto breakpoint', sku, precio: 1000, stock: 10000000 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVendedor}`,
      },
    }
  );
  check(prod, { 'producto creado': (r) => r.status === 201 });

  const tokenCliente = login('cliente@correo.com', 'Password123');
  return { tokenCliente, productoId: prod.json('id') };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/api/pedidos`,
    JSON.stringify({ producto_id: data.productoId, cantidad: 1 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.tokenCliente}`,
      },
      timeout: '10s',
    }
  );
  check(res, { 'pedido creado (201)': (r) => r.status === 201 });
  sleep(0.3);
}
