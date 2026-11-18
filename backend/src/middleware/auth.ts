// src/middleware/auth.ts (Seguridad / RBAC)
// Manual Técnico, Sección 3.
// Fase 4 (A01/A02/A07):
//  - el algoritmo del token se fija en HS256 (no se acepta lo que declare la cabecera);
//  - el secreto viene de config.ts (sin valor por defecto en producción);
//  - el rol, la tienda y el estado "activo" se leen de la base en cada petición, de modo
//    que desactivar un usuario o cambiarle el rol surte efecto de inmediato y no hay que
//    esperar a que expire el token de 8 h.
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_ALGORITMO } from '../config';
import { repo } from '../db';
import { Usuario } from '../entidades';
import { enteroPositivo } from '../utils/validar';
import { enviarErrorInterno } from '../utils/errores';

export interface AuthRequest extends Request {
  usuario_id?: number;
  rol?: string;
  tienda_id?: number;
}

export const verificarToken = (rolesPermitidos: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
      res.status(403).json({ mensaje: 'Acceso denegado. Token no provisto.' });
      return;
    }

    let id: number | null;
    try {
      const verificado = jwt.verify(token, JWT_SECRET, {
        algorithms: [JWT_ALGORITMO],
      }) as jwt.JwtPayload;
      id = enteroPositivo(verificado.id);
    } catch {
      res.status(400).json({ mensaje: 'Token inválido o expirado.' });
      return;
    }
    if (id === null) {
      res.status(400).json({ mensaje: 'Token inválido o expirado.' });
      return;
    }

    try {
      const u = await (await repo(Usuario)).findOne({
        where: { id },
        select: { rol: true, tienda_id: true, activo: true },
      });
      if (!u || !u.activo) {
        res.status(401).json({ mensaje: 'Sesión no válida. Inicie sesión de nuevo.' });
        return;
      }

      req.usuario_id = id;
      req.rol = u.rol;
      req.tienda_id = u.tienda_id ?? undefined;

      if (!rolesPermitidos.includes(u.rol)) {
        res.status(401).json({ mensaje: 'No tiene permisos para esta acción.' });
        return;
      }
      next();
    } catch (error) {
      enviarErrorInterno(res, error);
    }
  };
};
