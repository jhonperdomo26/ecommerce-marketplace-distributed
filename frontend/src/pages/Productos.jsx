// src/pages/Productos.jsx
// Gestión de productos de la tienda del vendedor autenticado.
// GET /api/productos/mios, POST/PUT/DELETE /api/productos.
// Usabilidad: búsqueda y orden (U-10), aviso tras guardar o eliminar (U-08), diálogo de
// borrado que nombra el producto (U-09), campos obligatorios marcados (U-14), stock bajo visible.
import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { apiJson } from '../api';
import {
  Boton,
  Campo,
  Cargando,
  claseControl,
  Encabezado,
  formatoPrecio,
  Insignia,
  MensajeError,
  Tarjeta,
  useInterfaz,
  Vacio,
} from '../components/ui.jsx';

const vacio = { nombre: '', sku: '', precio: '', stock: '' };
const STOCK_BAJO = 5; // mismo umbral que usa el asistente virtual

const ORDENES = {
  nombre: { texto: 'Nombre', fn: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
  stock: { texto: 'Menos stock primero', fn: (a, b) => a.stock - b.stock },
  precio: { texto: 'Precio (mayor a menor)', fn: (a, b) => Number(b.precio) - Number(a.precio) },
};

export default function Productos() {
  const { avisar, confirmar } = useInterfaz();
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(vacio);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [orden, setOrden] = useState('nombre');

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

  const visibles = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return productos
      .filter((p) => !t || p.nombre.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))
      .sort(ORDENES[orden].fn);
  }, [productos, buscar, orden]);

  const conStockBajo = productos.filter((p) => p.stock <= STOCK_BAJO).length;

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const limpiar = () => {
    setForm(vacio);
    setEditandoId(null);
    setError('');
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    const cuerpo = {
      nombre: form.nombre,
      sku: form.sku,
      precio: Number(form.precio),
      stock: Number(form.stock || 0),
    };
    try {
      if (editandoId) {
        await apiJson(`/api/productos/${editandoId}`, { method: 'PUT', body: JSON.stringify(cuerpo) });
        avisar(`«${cuerpo.nombre}» se actualizó.`);
      } else {
        await apiJson('/api/productos', { method: 'POST', body: JSON.stringify(cuerpo) });
        avisar(`«${cuerpo.nombre}» se agregó al catálogo.`);
      }
      limpiar();
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const editar = (p) => {
    setEditandoId(p.id);
    setForm({ nombre: p.nombre, sku: p.sku, precio: p.precio, stock: p.stock });
    setError('');
    document.getElementById('prod-nombre')?.focus();
  };

  const eliminar = async (p) => {
    const ok = await confirmar({
      titulo: `¿Eliminar «${p.nombre}»?`,
      mensaje: `SKU ${p.sku}. El producto dejará de estar en el catálogo. Esta acción no se puede deshacer. Si ya tiene pedidos no se podrá eliminar: en ese caso deja su stock en 0.`,
      textoConfirmar: 'Eliminar producto',
      peligro: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/productos/${p.id}`, { method: 'DELETE' });
      avisar(`«${p.nombre}» se eliminó.`);
      if (editandoId === p.id) limpiar();
      cargar();
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  const vistaPrecio = form.precio !== '' && !Number.isNaN(Number(form.precio)) ? formatoPrecio(form.precio) : null;

  return (
    <Layout>
      <Encabezado
        titulo="Productos de mi tienda"
        descripcion={`${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}${
          conStockBajo ? ` · ${conStockBajo} con stock bajo (${STOCK_BAJO} o menos)` : ''
        }`}
      />

      <Tarjeta className="mb-6 p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          {editandoId ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <form onSubmit={guardar} className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Campo id="prod-nombre" etiqueta="Nombre" obligatorio className="md:col-span-2">
            <input
              id="prod-nombre"
              maxLength={100}
              value={form.nombre}
              onChange={set('nombre')}
              className={claseControl}
              required
            />
          </Campo>
          <Campo id="prod-sku" etiqueta="SKU" obligatorio ayuda="Código único, hasta 20 caracteres.">
            <input
              id="prod-sku"
              maxLength={20}
              aria-describedby="prod-sku-ayuda"
              value={form.sku}
              onChange={set('sku')}
              className={claseControl}
              required
            />
          </Campo>
          <Campo id="prod-precio" etiqueta="Precio (COP)" obligatorio ayuda={vistaPrecio ? `Se verá como ${vistaPrecio}` : 'Sin puntos ni comas.'}>
            <input
              id="prod-precio"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              aria-describedby="prod-precio-ayuda"
              value={form.precio}
              onChange={set('precio')}
              className={claseControl}
              required
            />
          </Campo>
          <Campo id="prod-stock" etiqueta="Stock" ayuda="Unidades disponibles.">
            <input
              id="prod-stock"
              type="number"
              min="0"
              step="1"
              aria-describedby="prod-stock-ayuda"
              value={form.stock}
              onChange={set('stock')}
              className={claseControl}
            />
          </Campo>
          <div className="flex items-start gap-2 md:pt-6">
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar'}
            </Boton>
            {editandoId && (
              <Boton variante="secundario" onClick={limpiar}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-600">Los campos con * son obligatorios.</p>
      </Tarjeta>

      <MensajeError>{error}</MensajeError>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="prod-buscar" className="mb-1 block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            id="prod-buscar"
            type="search"
            placeholder="Nombre o SKU"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className={claseControl}
          />
        </div>
        <div>
          <label htmlFor="prod-orden" className="mb-1 block text-sm font-medium text-slate-700">
            Ordenar por
          </label>
          <select id="prod-orden" value={orden} onChange={(e) => setOrden(e.target.value)} className={claseControl}>
            {Object.entries(ORDENES).map(([clave, o]) => (
              <option key={clave} value={clave}>
                {o.texto}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <Cargando texto="Cargando productos…" />
        ) : visibles.length === 0 ? (
          <Vacio titulo={productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no tienes productos.'}>
            {productos.length ? 'Prueba con otro nombre o SKU.' : 'Agrega el primero con el formulario de arriba.'}
          </Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Productos de la tienda</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">SKU</th>
                  <th scope="col" className="px-4 py-3 text-right">Precio</th>
                  <th scope="col" className="px-4 py-3 text-right">Stock</th>
                  <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((p) => (
                  <tr key={p.id} className={editandoId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.nombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.sku}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{formatoPrecio(p.precio)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.stock <= STOCK_BAJO ? (
                        <Insignia estado={p.stock === 0 ? 'cancelado' : 'pendiente'}>
                          {p.stock === 0 ? 'Agotado' : `${p.stock} · bajo`}
                        </Insignia>
                      ) : (
                        <span className="text-slate-900">{p.stock}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Boton variante="enlace" tamano="chico" onClick={() => editar(p)} aria-label={`Editar ${p.nombre}`}>
                        Editar
                      </Boton>
                      <Boton
                        variante="enlacePeligro"
                        tamano="chico"
                        onClick={() => eliminar(p)}
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        Eliminar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </Layout>
  );
}
