// src/routes/resenas.routes.ts
import { Router } from 'express';
import { verificarToken } from '../middleware/auth';
import {
  crearResena,
  listarPorProducto,
  listarDeMisProductos,
} from '../controllers/resenas.controller';

const router = Router();

// El cliente califica un pedido suyo entregado.
router.post('/', verificarToken(['cliente']), crearResena);

// Reseñas de un producto: cualquier usuario autenticado (las ve la app).
router.get(
  '/producto/:producto_id',
  verificarToken(['cliente', 'vendedor', 'administrador']),
  listarPorProducto
);

// Reseñas de los productos de la tienda del vendedor.
router.get('/mis-productos', verificarToken(['vendedor']), listarDeMisProductos);

export default router;
