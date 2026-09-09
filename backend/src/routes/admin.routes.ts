// src/routes/admin.routes.ts
import { Router } from 'express';
import { verificarToken } from '../middleware/auth';
import {
  resumen,
  listarTiendas,
  crearTienda,
  listarUsuarios,
  crearUsuario,
  cambiarActivoUsuario,
} from '../controllers/admin.controller';

const router = Router();

// Todo el panel exige rol 'administrador'.
router.use(verificarToken(['administrador']));

router.get('/resumen', resumen);

router.get('/tiendas', listarTiendas);
router.post('/tiendas', crearTienda);

router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.patch('/usuarios/:id/activo', cambiarActivoUsuario);

export default router;
