// src/controllers/chat.controller.ts
// Asistente virtual (Fase 3). Recibe el mensaje de la persona, lo pasa al motor
// de reglas junto con su identidad (tomada del token) y devuelve la respuesta.
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { enviarErrorInterno } from '../utils/errores';
import { responder } from '../chat/motor';
import { chatDatosPg } from '../chat/datos';
import { Rol } from '../chat/tipos';

export const MAX_LONGITUD_MENSAJE = 300;

// POST /api/chat   Cuerpo: { mensaje }
// Respuesta: { respuesta, intencion, opciones: [{ texto, valor }] }
export const conversar = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const mensaje =
    typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';

  if (!mensaje) {
    res.status(400).json({ mensaje: 'El mensaje es obligatorio.' });
    return;
  }
  if (mensaje.length > MAX_LONGITUD_MENSAJE) {
    res.status(400).json({
      mensaje: `El mensaje no puede superar ${MAX_LONGITUD_MENSAJE} caracteres.`,
    });
    return;
  }

  try {
    const respuesta = await responder(
      mensaje,
      {
        usuario_id: req.usuario_id!,
        rol: req.rol as Rol,
        tienda_id: req.tienda_id ?? null,
      },
      chatDatosPg
    );
    res.status(200).json(respuesta);
  } catch (error) {
    enviarErrorInterno(res, error);
  }
};
