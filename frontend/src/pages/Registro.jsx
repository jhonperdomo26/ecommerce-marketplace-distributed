// src/pages/Registro.jsx
// Alta pública de clientes -> POST /api/auth/registro.
// Los vendedores/administradores los crea el administrador desde su panel.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { guardarSesion } from '../api';

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
      guardarSesion(data);
      setError('');
      // El cliente no tiene vistas en web; se le informa y se vuelve al login.
      alert(
        'Cuenta creada. La compra y el seguimiento de pedidos se hacen desde la app móvil.'
      );
      navigate('/login');
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
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Crear cuenta</h1>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre
        </label>
        <input
          value={form.nombre}
          onChange={set('nombre')}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          required
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          required
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña (mín. 6 caracteres)
        </label>
        <input
          type="password"
          value={form.password}
          onChange={set('password')}
          minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          required
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear cuenta'}
        </button>

        <p className="text-sm text-gray-600 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
