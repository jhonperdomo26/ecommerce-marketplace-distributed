// src/pages/Admin.jsx
// Panel de administrador: conteos globales + gestión de tiendas y usuarios.
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiJson } from '../api';

function Tarjeta({ etiqueta, valor }) {
  return (
    <div className="bg-white shadow rounded-lg p-4 text-center">
      <div className="text-3xl font-bold text-blue-700">{valor}</div>
      <div className="text-sm text-gray-500">{etiqueta}</div>
    </div>
  );
}

export default function Admin() {
  const [resumen, setResumen] = useState(null);
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');

  const [tienda, setTienda] = useState({ nombre: '', direccion: '' });
  const [usuario, setUsuario] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'vendedor',
    tienda_id: '',
  });

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

  const crearTienda = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiJson('/api/admin/tiendas', {
        method: 'POST',
        body: JSON.stringify(tienda),
      });
      setTienda({ nombre: '', direccion: '' });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiJson('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          ...usuario,
          tienda_id: Number(usuario.tienda_id),
        }),
      });
      setUsuario({
        nombre: '',
        email: '',
        password: '',
        rol: 'vendedor',
        tienda_id: '',
      });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActivo = async (u) => {
    setError('');
    try {
      await apiJson(`/api/admin/usuarios/${u.id}/activo`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !u.activo }),
      });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Administración</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Tarjeta etiqueta="Tiendas" valor={resumen.tiendas} />
          <Tarjeta etiqueta="Usuarios" valor={resumen.usuarios} />
          <Tarjeta etiqueta="Productos" valor={resumen.productos} />
          <Tarjeta etiqueta="Pedidos" valor={resumen.pedidos} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tiendas */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Tiendas</h2>
          <form
            onSubmit={crearTienda}
            className="bg-white shadow rounded-lg p-4 mb-4 space-y-2"
          >
            <input
              placeholder="Nombre"
              value={tienda.nombre}
              onChange={(e) =>
                setTienda({ ...tienda, nombre: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
              required
            />
            <input
              placeholder="Dirección"
              value={tienda.direccion}
              onChange={(e) =>
                setTienda({ ...tienda, direccion: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
            />
            <button className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700">
              Crear tienda
            </button>
          </form>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Dirección</th>
                </tr>
              </thead>
              <tbody>
                {tiendas.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-2">{t.id}</td>
                    <td className="px-4 py-2">{t.nombre}</td>
                    <td className="px-4 py-2 text-gray-600">{t.direccion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Usuarios */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Usuarios</h2>
          <form
            onSubmit={crearUsuario}
            className="bg-white shadow rounded-lg p-4 mb-4 space-y-2"
          >
            <input
              placeholder="Nombre"
              value={usuario.nombre}
              onChange={(e) =>
                setUsuario({ ...usuario, nombre: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={usuario.email}
              onChange={(e) =>
                setUsuario({ ...usuario, email: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={usuario.password}
              onChange={(e) =>
                setUsuario({ ...usuario, password: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
              required
            />
            <div className="flex gap-2">
              <select
                value={usuario.rol}
                onChange={(e) =>
                  setUsuario({ ...usuario, rol: e.target.value })
                }
                className="border rounded px-2 py-1 flex-1"
              >
                <option value="vendedor">vendedor</option>
                <option value="administrador">administrador</option>
              </select>
              <select
                value={usuario.tienda_id}
                onChange={(e) =>
                  setUsuario({ ...usuario, tienda_id: e.target.value })
                }
                className="border rounded px-2 py-1 flex-1"
                required
              >
                <option value="">Tienda...</option>
                {tiendas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700">
              Crear usuario
            </button>
          </form>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2">Tienda</th>
                  <th className="px-4 py-2">Activo</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="px-4 py-2">
                      {u.nombre}
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-2">{u.rol}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {u.tienda_nombre || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleActivo(u)}
                        className={`px-2 py-0.5 rounded text-xs ${
                          u.activo
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}
                      >
                        {u.activo ? 'activo' : 'inactivo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
