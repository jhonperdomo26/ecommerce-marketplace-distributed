// src/middleware/auth.ts (Seguridad / RBAC)
// Manual Técnico, Sección 3.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  usuario_id?: number;
  rol?: string;
  tienda_id?: number;
}

export const verificarToken = (rolesPermitidos: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      res.status(403).json({ mensaje: 'Acceso denegado. Token no provisto.' });
      return;
    }

    try {
      const verificado = jwt.verify(
        token,
        process.env.JWT_SECRET || 'FirmaSecretaPlataforma'
      ) as any;

      req.usuario_id = verificado.id;
      req.rol = verificado.rol;
      req.tienda_id = verificado.tienda_id;

      if (!rolesPermitidos.includes(req.rol!)) {
        res.status(401).json({ mensaje: 'No tiene permisos para esta acción.' });
        return;
      }

      next();
    } catch (error) {
      res.status(400).json({ mensaje: 'Token inválido o expirado.' });
    }
  };
};
