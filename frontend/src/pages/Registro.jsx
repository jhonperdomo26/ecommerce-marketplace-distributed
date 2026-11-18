// src/pages/Registro.jsx
// Alta pública de clientes -> POST /api/auth/registro.
// Los vendedores/administradores los crea el administrador desde su panel.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.mensaje || 'No fue posible crear la cuenta.');
        return;
      }
      // El cliente no tiene vistas en web: no se guarda la sesión, se vuelve al login con un aviso
      // en pantalla (antes era un alert() del navegador que bloqueaba la página).
      navigate('/login', {
        state: {
          aviso:
            'Cuenta creada. La compra y el seguimiento de pedidos se hacen desde la app móvil.',
        },
      });
    } catch (err) {
      setError('Error de conexión con la API.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Crear cuenta</h1>
        <p className="mb-6 text-sm text-slate-600">Cuenta de cliente. Las compras se hacen desde la app móvil.</p>

        <label htmlFor="reg-nombre" className="mb-1 block text-sm font-medium text-slate-700">
          Nombre
        </label>
        <input
          id="reg-nombre"
          maxLength={100}
          autoComplete="name"
          value={form.nombre}
          onChange={set('nombre')}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        />

        <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          maxLength={150}
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        />

        <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-slate-700">
          Contraseña (mín. 8 caracteres)
        </label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          minLength={8}
          maxLength={72}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        />

        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear cuenta'}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-700 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
