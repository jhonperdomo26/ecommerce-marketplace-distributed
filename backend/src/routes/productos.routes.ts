// src/routes/productos.routes.ts
import { Router } from 'express';
import { verificarToken } from '../middleware/auth';
import {
  listarCatalogo,
  listarMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from '../controllers/productos.controller';

const router = Router();

// Catálogo: cualquier usuario autenticado (cliente, vendedor o administrador).
router.get(
  '/',
  verificarToken(['cliente', 'vendedor', 'administrador']),
  listarCatalogo
);

// Gestión de productos: solo el vendedor de la tienda.
router.get('/mios', verificarToken(['vendedor']), listarMisProductos);
router.post('/', verificarToken(['vendedor']), crearProducto);
router.put('/:id', verificarToken(['vendedor']), actualizarProducto);
router.delete('/:id', verificarToken(['vendedor']), eliminarProducto);

export default router;
