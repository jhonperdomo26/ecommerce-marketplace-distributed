// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, registro } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/registro  (alta pública de clientes)
router.post('/registro', registro);

export default router;
