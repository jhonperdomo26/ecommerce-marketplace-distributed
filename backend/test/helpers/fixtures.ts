// test/helpers/fixtures.ts
// Utilidades compartidas por las pruebas: reinicio de tablas, inserción de datos
// y firma de tokens con la misma estructura que produce el login
// ({ id, rol, tienda_id }).
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../../src/db';

export { pool };

const SECRET = process.env.JWT_SECRET || 'FirmaSecretaPruebas';

export async function resetDb(): Promise<void> {
  await pool.query(
    'TRUNCATE resenas, pedidos, productos, usuarios, tiendas RESTART IDENTITY CASCADE'
  );
}

export async function crearTienda(nombre = 'Tienda Test'): Promise<number> {
  const r = await pool.query(
    'INSERT INTO tiendas (nombre) VALUES ($1) RETURNING id',
    [nombre]
  );
  return r.rows[0].id;
}

interface UsuarioTest {
  nombre?: string;
  email: string;
  password?: string;
  rol: 'administrador' | 'vendedor' | 'cliente';
  tienda_id?: number | null;
  activo?: boolean;
}

export async function crearUsuario(u: UsuarioTest): Promise<number> {
  const hash = await bcrypt.hash(u.password ?? 'Password123', 4);
  const r = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, tienda_id, activo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      u.nombre ?? 'Usuario Test',
      u.email,
      hash,
      u.rol,
      u.tienda_id ?? null,
      u.activo ?? true,
    ]
  );
  return r.rows[0].id;
}

export async function crearProducto(opts: {
  tienda_id: number;
  vendedor_id?: number;
  stock?: number;
  precio?: number;
  sku?: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO productos (nombre, sku, precio, stock, vendedor_id, tienda_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      'Producto Test',
      opts.sku ?? `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      opts.precio ?? 1000,
      opts.stock ?? 10,
      opts.vendedor_id ?? null,
      opts.tienda_id,
    ]
  );
  return r.rows[0].id;
}

export async function crearPedido(opts: {
  cliente_id: number;
  producto_id: number;
  cantidad?: number;
  estado?: string;
}): Promise<number> {
  const r = await pool.query(
    `INSERT INTO pedidos (cliente_id, producto_id, cantidad, estado)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      opts.cliente_id,
      opts.producto_id,
      opts.cantidad ?? 1,
      opts.estado ?? 'pendiente',
    ]
  );
  return r.rows[0].id;
}

// Firma un token como lo hace el backend en el login.
export function tokenDe(usuario: {
  id: number;
  rol: string;
  tienda_id?: number | null;
}): string {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, tienda_id: usuario.tienda_id ?? null },
    SECRET,
    { expiresIn: '1h' }
  );
}

export function tokenInvalido(): string {
  return jwt.sign({ id: 1, rol: 'vendedor' }, 'otra-firma-distinta');
}
