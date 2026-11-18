// src/pages/Admin.jsx
// Panel de administrador: conteos globales + gestión de tiendas y usuarios.
// Usabilidad: formularios con etiquetas visibles y campos obligatorios marcados (U-14), aviso
// tras crear (U-08), estado de la cuenta separado de la acción que lo cambia y confirmación
// antes de desactivar a alguien (U-07), búsqueda de usuarios (U-10) y contraste suficiente (U-12).
import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { apiJson, getUsuario } from '../api';
import {
  Boton,
  Campo,
  claseControl,
  Encabezado,
  Insignia,
  MensajeError,
  Tarjeta,
  useInterfaz,
  Vacio,
} from '../components/ui.jsx';

function Metrica({ etiqueta, valor }) {
  return (
    <Tarjeta className="p-5">
      <p className="text-sm font-medium text-slate-600">{etiqueta}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{valor}</p>
    </Tarjeta>
  );
}

const usuarioVacio = { nombre: '', email: '', password: '', rol: 'vendedor', tienda_id: '' };

export default function Admin() {
  const { avisar, confirmar } = useInterfaz();
  const yo = getUsuario();
  const [resumen, setResumen] = useState(null);
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');
  const [errorTienda, setErrorTienda] = useState('');
  const [errorUsuario, setErrorUsuario] = useState('');
  const [buscar, setBuscar] = useState('');

  const [tienda, setTienda] = useState({ nombre: '', direccion: '' });
  const [usuario, setUsuario] = useState(usuarioVacio);

  const cargar = async () => {
    try {
      const [r, t, u] = await Promise.all([
        apiJson('/api/admin/resumen'),
        apiJson('/api/admin/tiendas'),
        apiJson('/api/admin/usuarios'),
      ]);
      setResumen(r);
      setTiendas(t);
      setUsuarios(u);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const usuariosVisibles = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        (u.tienda_nombre || '').toLowerCase().includes(t)
    );
  }, [usuarios, buscar]);

  const crearTienda = async (e) => {
    e.preventDefault();
    setErrorTienda('');
    try {
      await apiJson('/api/admin/tiendas', { method: 'POST', body: JSON.stringify(tienda) });
      avisar(`Tienda «${tienda.nombre}» creada.`);
      setTienda({ nombre: '', direccion: '' });
      cargar();
    } catch (e) {
      setErrorTienda(e.message);
    }
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    setErrorUsuario('');
    try {
      await apiJson('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({ ...usuario, tienda_id: Number(usuario.tienda_id) }),
      });
      avisar(`Usuario ${usuario.email} creado. Entrégale su contraseña por un canal seguro.`);
      setUsuario(usuarioVacio);
      cargar();
    } catch (e) {
      setErrorUsuario(e.message);
    }
  };

  const cambiarActivo = async (u) => {
    if (u.activo) {
      const ok = await confirmar({
        titulo: `¿Desactivar a ${u.nombre}?`,
        mensaje: `${u.email} no podrá iniciar sesión y perderá el acceso de inmediato. Sus datos se conservan y puedes volver a activarlo.`,
        textoConfirmar: 'Desactivar',
        peligro: true,
      });
      if (!ok) return;
    }
    try {
      await apiJson(`/api/admin/usuarios/${u.id}/activo`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !u.activo }),
      });
      avisar(`${u.nombre} quedó ${u.activo ? 'desactivado' : 'activo'}.`);
      cargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  const setT = (campo) => (e) => setTienda({ ...tienda, [campo]: e.target.value });
  const setU = (campo) => (e) => setUsuario({ ...usuario, [campo]: e.target.value });

  return (
    <Layout>
      <Encabezado titulo="Administración" descripcion="Resumen del sistema, tiendas y cuentas de vendedores y administradores." />
      <MensajeError>{error}</MensajeError>

      {resumen && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metrica etiqueta="Tiendas" valor={resumen.tiendas} />
          <Metrica etiqueta="Usuarios" valor={resumen.usuarios} />
          <Metrica etiqueta="Productos" valor={resumen.productos} />
          <Metrica etiqueta="Pedidos" valor={resumen.pedidos} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Tiendas */}
        <section aria-labelledby="titulo-tiendas" className="lg:col-span-2">
          <h2 id="titulo-tiendas" className="mb-3 text-lg font-semibold text-slate-900">
            Tiendas
          </h2>
          <Tarjeta className="mb-4 p-5">
            <form onSubmit={crearTienda} className="space-y-3">
              <Campo id="tienda-nombre" etiqueta="Nombre" obligatorio>
                <input id="tienda-nombre" maxLength={100} value={tienda.nombre} onChange={setT('nombre')} className={claseControl} required />
              </Campo>
              <Campo id="tienda-direccion" etiqueta="Dirección">
                <input id="tienda-direccion" maxLength={255} value={tienda.direccion} onChange={setT('direccion')} className={claseControl} />
              </Campo>
              <MensajeError>{errorTienda}</MensajeError>
              <Boton type="submit">Crear tienda</Boton>
            </form>
          </Tarjeta>
          <Tarjeta className="overflow-hidden">
            {tiendas.length === 0 ? (
              <Vacio titulo="Aún no hay tiendas." />
            ) : (
              <table className="min-w-full text-sm">
                <caption className="sr-only">Tiendas</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">ID</th>
                    <th scope="col" className="px-4 py-3">Nombre</th>
                    <th scope="col" className="px-4 py-3">Dirección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tiendas.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{t.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{t.nombre}</td>
                      <td className="px-4 py-3 text-slate-700">{t.direccion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </section>

        {/* Usuarios */}
        <section aria-labelledby="titulo-usuarios" className="lg:col-span-3">
          <h2 id="titulo-usuarios" className="mb-3 text-lg font-semibold text-slate-900">
            Usuarios
          </h2>
          <Tarjeta className="mb-4 p-5">
            <form onSubmit={crearUsuario} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo id="usuario-nombre" etiqueta="Nombre" obligatorio>
                <input id="usuario-nombre" maxLength={100} value={usuario.nombre} onChange={setU('nombre')} className={claseControl} required />
              </Campo>
              <Campo id="usuario-email" etiqueta="Correo" obligatorio>
                <input id="usuario-email" type="email" maxLength={150} value={usuario.email} onChange={setU('email')} className={claseControl} required />
              </Campo>
              <Campo id="usuario-password" etiqueta="Contraseña" obligatorio ayuda="Mínimo 8 caracteres y distinta del correo.">
                <input
                  id="usuario-password"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  aria-describedby="usuario-password-ayuda"
                  value={usuario.password}
                  onChange={setU('password')}
                  className={claseControl}
                  required
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="usuario-rol" etiqueta="Rol" obligatorio>
                  <select id="usuario-rol" value={usuario.rol} onChange={setU('rol')} className={claseControl}>
                    <option value="vendedor">Vendedor</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </Campo>
                <Campo id="usuario-tienda" etiqueta="Tienda" obligatorio>
                  <select id="usuario-tienda" value={usuario.tienda_id} onChange={setU('tienda_id')} className={claseControl} required>
                    <option value="">Elegir…</option>
                    {tiendas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <MensajeError>{errorUsuario}</MensajeError>
                <Boton type="submit">Crear usuario</Boton>
                <span className="ml-3 text-xs text-slate-600">Los campos con * son obligatorios.</span>
              </div>
            </form>
          </Tarjeta>

          <div className="mb-3">
            <label htmlFor="usuarios-buscar" className="mb-1 block text-sm font-medium text-slate-700">
              Buscar usuario
            </label>
            <input
              id="usuarios-buscar"
              type="search"
              placeholder="Nombre, correo o tienda"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className={claseControl}
            />
          </div>
          <Tarjeta className="overflow-hidden">
            {usuariosVisibles.length === 0 ? (
              <Vacio titulo="Ningún usuario coincide con la búsqueda." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Usuarios</caption>
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Usuario</th>
                      <th scope="col" className="px-4 py-3">Rol</th>
                      <th scope="col" className="px-4 py-3">Tienda</th>
                      <th scope="col" className="px-4 py-3">Estado</th>
                      <th scope="col" className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuariosVisibles.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-slate-900">{u.nombre}</span>
                          <span className="block text-xs text-slate-600">{u.email}</span>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">{u.rol}</td>
                        <td className="px-4 py-3 text-slate-700">{u.tienda_nombre || '—'}</td>
                        <td className="px-4 py-3">
                          <Insignia estado={u.activo ? 'entregado' : 'cancelado'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {u.id === yo?.id ? (
                            <span className="text-xs text-slate-600">Tu cuenta</span>
                          ) : (
                            <Boton
                              variante={u.activo ? 'enlacePeligro' : 'enlace'}
                              tamano="chico"
                              onClick={() => cambiarActivo(u)}
                              aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </Boton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </section>
      </div>
    </Layout>
  );
}
