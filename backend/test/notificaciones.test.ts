// test/notificaciones.test.ts
// Servicio externo de notificaciones (Fase 2): correo al cliente al crear el pedido y al
// cambiar su estado. Se reemplaza el transporte SMTP por uno simulado que guarda los envíos.
import request from 'supertest';
import { app } from '../src/app';
import {
  configurarTransporte,
  esperarNotificaciones,
} from '../src/servicios/notificaciones';
import {
  pool,
  resetDb,
  crearTienda,
  crearUsuario,
  crearProducto,
  tokenDe,
} from './helpers/fixtures';

const enviados: { to: string; subject: string; text: string }[] = [];
const transporteSimulado = {
  sendMail: jest.fn(async (msg: any) => {
    enviados.push({ to: msg.to, subject: msg.subject, text: msg.text });
    return {};
  }),
};

async function escenario() {
  const tienda = await crearTienda('Tienda Norte');
  const vendedor = await crearUsuario({ email: 'v@test.com', rol: 'vendedor', tienda_id: tienda });
  const cliente = await crearUsuario({ nombre: 'Ana', email: 'ana@test.com', rol: 'cliente' });
  const producto = await crearProducto({ tienda_id: tienda, vendedor_id: vendedor, stock: 5 });
  return {
    producto,
    tokCliente: tokenDe({ id: cliente, rol: 'cliente' }),
    tokVendedor: tokenDe({ id: vendedor, rol: 'vendedor', tienda_id: tienda }),
  };
}

beforeEach(async () => {
  await resetDb();
  enviados.length = 0;
  transporteSimulado.sendMail.mockClear();
  configurarTransporte(transporteSimulado as any);
});
afterAll(async () => {
  configurarTransporte(undefined);
  await pool.end();
});

test('al comprar, el cliente recibe un correo con su pedido', async () => {
  const e = await escenario();
  const res = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${e.tokCliente}`)
    .send({ producto_id: e.producto, cantidad: 2 });
  expect(res.status).toBe(201);
  await esperarNotificaciones();

  expect(enviados).toHaveLength(1);
  expect(enviados[0].to).toBe('ana@test.com');
  expect(enviados[0].subject).toBe(`Recibimos tu pedido #${res.body.datos.id}`);
  expect(enviados[0].text).toContain('2 × Producto Test de Tienda Norte');
});

test('al cambiar el estado, el cliente recibe el aviso', async () => {
  const e = await escenario();
  const compra = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${e.tokCliente}`)
    .send({ producto_id: e.producto, cantidad: 1 });
  await esperarNotificaciones();
  enviados.length = 0;

  const res = await request(app)
    .patch('/api/pedidos/estado')
    .set('Authorization', `Bearer ${e.tokVendedor}`)
    .send({ pedido_id: compra.body.datos.id, estado: 'entregado' });
  expect(res.status).toBe(200);
  await esperarNotificaciones();

  expect(enviados).toHaveLength(1);
  expect(enviados[0].subject).toBe(`Tu pedido #${compra.body.datos.id} fue entregado`);
  expect(enviados[0].text).toContain('calificar');
});

test('si el servidor de correo falla, el pedido se crea igual', async () => {
  const e = await escenario();
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  transporteSimulado.sendMail.mockRejectedValueOnce(new Error('SMTP caído'));

  const res = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${e.tokCliente}`)
    .send({ producto_id: e.producto, cantidad: 1 });
  await esperarNotificaciones();

  expect(res.status).toBe(201);
  const q = await pool.query('SELECT COUNT(*) FROM pedidos');
  expect(Number(q.rows[0].count)).toBe(1);
  expect(errorLog).toHaveBeenCalledWith(
    'No se pudo enviar la notificación por correo:',
    'SMTP caído'
  );
  errorLog.mockRestore();
});

test('una compra rechazada no envía correo', async () => {
  const e = await escenario();
  const res = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${e.tokCliente}`)
    .send({ producto_id: e.producto, cantidad: 99 });
  expect(res.status).toBe(409);
  await esperarNotificaciones();
  expect(enviados).toHaveLength(0);
});

test('sin SMTP_HOST el servicio queda apagado', async () => {
  const e = await escenario();
  delete process.env.SMTP_HOST;
  configurarTransporte(undefined); // vuelve a leer el entorno
  const res = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${e.tokCliente}`)
    .send({ producto_id: e.producto, cantidad: 1 });
  await esperarNotificaciones();
  expect(res.status).toBe(201);
  expect(transporteSimulado.sendMail).not.toHaveBeenCalled();
});
