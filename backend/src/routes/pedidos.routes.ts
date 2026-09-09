// src/routes/pedidos.routes.ts
import { Router } from 'express';
import { verificarToken } from '../middleware/auth';
import {
  actualizarEstadoPedido,
  listarPorTienda,
  listarMios,
  crearPedido,
} from '../controllers/pedidos.controller';

const router = Router();

// GET /api/pedidos/por-tienda  -> panel de vendedor (Manual Técnico, Sección 4)
router.get('/por-tienda', verificarToken(['vendedor']), listarPorTienda);

// GET /api/pedidos/mios  -> app móvil del cliente (Manual Técnico, Sección 5)
router.get('/mios', verificarToken(['cliente']), listarMios);

// POST /api/pedidos  -> compra desde la app del cliente
router.post('/', verificarToken(['cliente']), crearPedido);

// PATCH /api/pedidos/estado  -> actualización de estado por el vendedor (Sección 3)
router.patch('/estado', verificarToken(['vendedor']), actualizarEstadoPedido);

export default router;
