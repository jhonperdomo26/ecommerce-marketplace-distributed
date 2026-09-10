// test/db-constraints.test.ts
// Punto 5.3 del manual: "confirmar que los CHECK realmente rechazan datos
// inválidos, insertando casos límite a propósito". Se prueba también el
// UNIQUE(pedido_id) de resenas añadido en 03_constraints.sql.
//
// Códigos de error de PostgreSQL:
//   23514 = check_violation   23505 = unique_violation   23503 = foreign_key_violation
import { pool, resetDb, crearTienda, crearUsuario, crearProducto, crearPedido }
  from './helpers/fixtures';

beforeEach(resetDb);
afterAll(() => pool.end());

async function esperarErrorPg(promesa: Promise<unknown>, code: string) {
  await expect(promesa).rejects.toMatchObject({ code });
}

describe('Restricciones CHECK', () => {
  it('productos.stock no puede ser negativo', async () => {
    const tienda = await crearTienda();
    await esperarErrorPg(
      pool.query(
        `INSERT INTO productos (nombre, sku, precio, stock, tienda_id)
         VALUES ('X', 'SKU-NEG-1', 100, -1, $1)`,
        [tienda]
      ),
      '23514'
    );
  });

  it('productos.precio no puede ser negativo', async () => {
    const tienda = await crearTienda();
    await esperarErrorPg(
      pool.query(
        `INSERT INTO productos (nombre, sku, precio, stock, tienda_id)
         VALUES ('X', 'SKU-NEG-2', -50, 1, $1)`,
        [tienda]
      ),
      '23514'
    );
  });

  it('pedidos.cantidad debe ser > 0', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'c@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda });
    await esperarErrorPg(
      pool.query(
        `INSERT INTO pedidos (cliente_id, producto_id, cantidad)
         VALUES ($1, $2, 0)`,
        [cliente, producto]
      ),
      '23514'
    );
  });

  it('pedidos.estado solo admite los valores del manual', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'c@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda });
    await esperarErrorPg(
      pool.query(
        `INSERT INTO pedidos (cliente_id, producto_id, cantidad, estado)
         VALUES ($1, $2, 1, 'en_camino')`,
        [cliente, producto]
      ),
      '23514'
    );
  });

  it('resenas.calificacion debe estar entre 1.0 y 5.0', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'c@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda });
    const pedido = await crearPedido({
      cliente_id: cliente,
      producto_id: producto,
      estado: 'entregado',
    });
    await esperarErrorPg(
      pool.query(
        `INSERT INTO resenas (pedido_id, calificacion) VALUES ($1, 5.5)`,
        [pedido]
      ),
      '23514'
    );
  });

  it('usuarios.rol solo admite administrador/vendedor/cliente', async () => {
    await esperarErrorPg(
      pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES ('X', 'rol@test.com', 'h', 'superadmin')`
      ),
      '23514'
    );
  });
});

describe('Restricciones UNIQUE', () => {
  it('usuarios.email es único', async () => {
    await crearUsuario({ email: 'dup@test.com', rol: 'cliente' });
    await esperarErrorPg(
      pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES ('Y', 'dup@test.com', 'h', 'cliente')`
      ),
      '23505'
    );
  });

  it('productos.sku es único', async () => {
    const tienda = await crearTienda();
    await crearProducto({ tienda_id: tienda, sku: 'SKU-UNICO' });
    await esperarErrorPg(
      pool.query(
        `INSERT INTO productos (nombre, sku, precio, stock, tienda_id)
         VALUES ('Z', 'SKU-UNICO', 10, 1, $1)`,
        [tienda]
      ),
      '23505'
    );
  });

  it('resenas.pedido_id es único (una reseña por pedido)', async () => {
    const tienda = await crearTienda();
    const cliente = await crearUsuario({ email: 'c@test.com', rol: 'cliente' });
    const producto = await crearProducto({ tienda_id: tienda });
    const pedido = await crearPedido({
      cliente_id: cliente,
      producto_id: producto,
      estado: 'entregado',
    });
    await pool.query(
      `INSERT INTO resenas (pedido_id, calificacion) VALUES ($1, 4)`,
      [pedido]
    );
    await esperarErrorPg(
      pool.query(
        `INSERT INTO resenas (pedido_id, calificacion) VALUES ($1, 2)`,
        [pedido]
      ),
      '23505'
    );
  });
});
