// load/pedidos-load.js
// Prueba de carga (Manual Técnico, Punto 5.3) sobre el endpoint crítico de
// creación de pedidos: POST /api/pedidos.
//
// Simula un pico tipo "Black Friday": rampa hasta 50 usuarios virtuales,
// sostiene la carga y baja. Cada iteración crea un pedido real (descuenta
// stock), por eso en setup() se crea un producto con stock enorme.
//
// Ejecutar (con el backend + la BD con datos semilla corriendo):
//   Docker : docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 \
//              -v "${PWD}/load:/load" grafana/k6 run /load/pedidos-load.js
//   Nativo : k6 run load/pedidos-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '20s', target: 50 }, // rampa de subida
    { duration: '30s', target: 50 }, // pico sostenido
    { duration: '10s', target: 0 }, // rampa de bajada
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% de peticiones fallidas
    http_req_duration: ['p(95)<800'], // 95% por debajo de 800 ms
    checks: ['rate>0.99'],
  },
};

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    throw new Error(
      `Login falló para ${email} (${res.status}). ¿Backend y datos semilla arriba?`
    );
  }
  return res.json('token');
}

// Se ejecuta una vez. Prepara un producto con stock de sobra y el token del
// cliente que hará las compras.
export function setup() {
  const tokenVendedor = login('vendedor1@tutienda.com', 'Password123');
  // sku es VARCHAR(20): mantenerlo corto.
  const sku = `SKU-LOAD-${Math.floor(Math.random() * 1e6)}`;
  const prod = http.post(
    `${BASE_URL}/api/productos`,
    JSON.stringify({ nombre: 'Producto de carga', sku, precio: 1000, stock: 10000000 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVendedor}`,
      },
    }
  );
  check(prod, { 'producto de carga creado': (r) => r.status === 201 });

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
    }
  );
  check(res, {
    'pedido creado (201)': (r) => r.status === 201,
  });
  sleep(1);
}
