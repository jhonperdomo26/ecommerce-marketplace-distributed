// src/pages/Productos.jsx
// Gestión de productos de la tienda del vendedor autenticado.
// GET /api/productos/mios, POST/PUT/DELETE /api/productos.
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiJson } from '../api';

const vacio = { nombre: '', sku: '', precio: '', stock: '' };

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(vacio);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      setProductos(await apiJson('/api/productos/mios'));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const limpiar = () => {
    setForm(vacio);
    setEditandoId(null);
    setError('');
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    const cuerpo = {
      nombre: form.nombre,
      sku: form.sku,
      precio: Number(form.precio),
      stock: Number(form.stock || 0),
    };
    try {
      if (editandoId) {
        await apiJson(`/api/productos/${editandoId}`, {
          method: 'PUT',
          body: JSON.stringify(cuerpo),
        });
      } else {
        await apiJson('/api/productos', {
          method: 'POST',
          body: JSON.stringify(cuerpo),
        });
      }
      limpiar();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const editar = (p) => {
    setEditandoId(p.id);
    setForm({ nombre: p.nombre, sku: p.sku, precio: p.precio, stock: p.stock });
    setError('');
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await apiJson(`/api/productos/${id}`, { method: 'DELETE' });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Productos de mi tienda
      </h1>

      <form
        onSubmit={guardar}
        className="bg-white shadow rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Nombre</label>
          <input
            value={form.nombre}
            onChange={set('nombre')}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">SKU</label>
          <input
            value={form.sku}
            onChange={set('sku')}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Precio</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio}
            onChange={set('precio')}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Stock</label>
          <input
            type="number"
            min="0"
            value={form.stock}
            onChange={set('stock')}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div className="md:col-span-5 flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
          >
            {editandoId ? 'Guardar cambios' : 'Agregar producto'}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={limpiar}
              className="px-4 py-1.5 rounded border"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-blue-600 text-white text-left text-sm uppercase">
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Precio</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="5" className="px-5 py-6 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : productos.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-5 py-6 text-center text-gray-500">
                  Aún no tienes productos.
                </td>
              </tr>
            ) : (
              productos.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm">{p.nombre}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{p.sku}</td>
                  <td className="px-5 py-3 text-sm">${p.precio}</td>
                  <td className="px-5 py-3 text-sm">{p.stock}</td>
                  <td className="px-5 py-3 text-sm space-x-3">
                    <button
                      onClick={() => editar(p)}
                      className="text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(p.id)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
