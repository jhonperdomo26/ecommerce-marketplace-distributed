// src/pages/Login.jsx
// Pantalla de inicio de sesión. Guarda el JWT y el usuario (con su rol) en
// localStorage y redirige según el rol.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { guardarSesion } from '../api';

const rutaInicioPorRol = {
  vendedor: '/pedidos',
  administrador: '/admin',
  cliente: '/login', // el cliente usa la app móvil; en web no tiene vistas propias
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('vendedor1@tutienda.com');
  const [password, setPassword] = useState('Password123');
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
      guardarSesion(data);
      if (data.usuario.rol === 'cliente') {
        setError(
          'Este usuario es un cliente. La vista de cliente está en la app móvil.'
        );
        return;
      }
      navigate(rutaInicioPorRol[data.usuario.rol] || '/login');
    } catch (err) {
      setError('Error de conexión con la API.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={onSubmit}
        className="bg-white shadow-md rounded-lg p-8 w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Iniciar sesión</h1>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          required
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          required
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-sm text-gray-600 mt-4">
          ¿Eres cliente nuevo?{' '}
          <Link to="/registro" className="text-blue-600 hover:underline">
            Crear cuenta
          </Link>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Prueba: vendedor1@tutienda.com / Password123 (vendedor) ·
          admin@tutienda.com (administrador)
        </p>
      </form>
    </div>
  );
}
