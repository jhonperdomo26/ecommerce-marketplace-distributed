// docs/practica_validacion/rendimiento/pedidos-stress-k6.js
//
// Práctica "Estrategias de validación y pruebas de software" — Módulo 1
// (Rendimiento). A diferencia de la prueba de carga del Punto 5.3
// (backend/load/pedidos-load.js, que valida un SLA fijo con 50 VUs), esta es
// una prueba de ESTRÉS: sube de forma escalonada hasta 300 usuarios
// virtuales para encontrar el punto de quiebre de POST /api/pedidos, el
// endpoint elegido por usar una transacción con `FOR UPDATE` (bloquea la fila
// del producto hasta el COMMIT), el punto más sensible a la concurrencia de
// todo el backend.
//
// Ejecutar (con el backend + la BD con datos semilla corriendo):
//   docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 \
//     -v "${PWD}/docs/practica_validacion/rendimiento:/load" \
//     grafana/k6 run /load/pedidos-stress-k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 150 },
    { duration: '30s', target: 300 },
    { duration: '30s', target: 300 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
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

export function setup() {
  const tokenVendedor = login('vendedor1@tutienda.com', 'Password123');
  const sku = `SKU-STRS-${Math.floor(Math.random() * 1e6)}`;
  const prod = http.post(
    `${BASE_URL}/api/productos`,
    JSON.stringify({ nombre: 'Producto de estrés', sku, precio: 1000, stock: 10000000 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVendedor}`,
      },
    }
  );
  check(prod, { 'producto de estrés creado': (r) => r.status === 201 });

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
  check(res, { 'pedido creado (201)': (r) => r.status === 201 });
  sleep(0.5);
}
