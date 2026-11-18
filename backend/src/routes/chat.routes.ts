// src/routes/chat.routes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verificarToken } from '../middleware/auth';
import { conversar } from '../controllers/chat.controller';

const router = Router();

// Límite de mensajes por IP: evita que el chat se use para inundar la base de
// datos con consultas (mismo criterio que el límite del login).
const limitadorChat = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados mensajes. Espera un momento e intenta de nuevo.' },
});

// POST /api/chat  -> cualquier usuario autenticado
router.post(
  '/',
  limitadorChat,
  verificarToken(['cliente', 'vendedor', 'administrador']),
  conversar
);

export default router;
