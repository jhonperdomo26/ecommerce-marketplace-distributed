// src/utils/errores.ts
// Respuesta uniforme para errores 500: el detalle real se registra en el
// servidor (logs) y nunca se expone al cliente. Antes, cada controlador
// devolvía el objeto de error crudo de pg/Node (código SQL, archivo y línea
// del motor, stack, etc.), lo que filtraba información interna del sistema
// (hallazgo de seguridad de la práctica de validación y pruebas).
import { Response } from 'express';

export const enviarErrorInterno = (res: Response, error: unknown): void => {
  console.error('Error interno:', error);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
};
