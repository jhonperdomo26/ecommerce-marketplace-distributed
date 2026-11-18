// src/pages/Login.jsx
// Pantalla de inicio de sesión. Guarda el JWT y el usuario (con su rol) en
// localStorage y redirige según el rol.
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { guardarSesion } from '../api';

const rutaInicioPorRol = {
  vendedor: '/pedidos',
  administrador: '/admin',
  cliente: '/login', // el cliente usa la app móvil; en web no tiene vistas propias
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Mensajes informativos que llegan desde otras pantallas (alta de cuenta, sesión vencida).
  const aviso =
    location.state?.aviso ||
    (new URLSearchParams(location.search).get('sesion') === 'vencida'
      ? 'Tu sesión terminó. Inicia sesión de nuevo.'
      : '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.mensaje || 'No fue posible iniciar sesión.');
        return;
      }
      // Un cliente no tiene vistas en la web: se le avisa sin dejar la sesión guardada.
      if (data.usuario.rol === 'cliente') {
        setError(
          'Este usuario es un cliente. La vista de cliente está en la app móvil.'
        );
        return;
      }
      guardarSesion(data);
      navigate(rutaInicioPorRol[data.usuario.rol] || '/login');
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
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-slate-600">Panel web para vendedores y administradores.</p>

        {aviso && (
          <p role="status" className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {aviso}
          </p>
        )}

        <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        />

        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          ¿Eres cliente nuevo?{' '}
          <Link to="/registro" className="font-medium text-blue-700 hover:underline">
            Crear cuenta
          </Link>
        </p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Prueba: vendedor1@tutienda.com / Password123 (vendedor) ·
          admin@tutienda.com (administrador)
        </p>
      </form>
    </div>
  );
}
