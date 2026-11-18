// src/components/ChatWidget.jsx
// Asistente virtual (Fase 3): botón flotante que abre un panel de chat. Habla con
// POST /api/chat; el servidor no guarda estado, así que cada respuesta trae
// «opciones» (botones de respuesta rápida) cuyo `valor` se reenvía al pulsarlas.
import React, { useEffect, useRef, useState } from 'react';
import { apiJson } from '../api';

const MAX_LONGITUD = 300; // mismo límite que valida el backend

export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]); // { autor: 'yo' | 'bot', texto, error? }
  const [opciones, setOpciones] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const iniciado = useRef(false);
  const fin = useRef(null);

  useEffect(() => {
    fin.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [mensajes, opciones, abierto]);

  // `valor` es lo que se envía al servidor; `visible` lo que se muestra como
  // mensaje de la persona (null = no mostrar nada, p. ej. el saludo inicial).
  const enviar = async (valor, visible = valor) => {
    const contenido = valor.trim();
    if (!contenido || enviando) return;
    if (visible) setMensajes((prev) => [...prev, { autor: 'yo', texto: visible }]);
    setOpciones([]);
    setEnviando(true);
    try {
      const data = await apiJson('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ mensaje: contenido }),
      });
      setMensajes((prev) => [...prev, { autor: 'bot', texto: data.respuesta }]);
      setOpciones(data.opciones || []);
    } catch (e) {
      setMensajes((prev) => [
        ...prev,
        { autor: 'bot', texto: `No pude responder: ${e.message}`, error: true },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const abrir = () => {
    setAbierto(true);
    if (!iniciado.current) {
      iniciado.current = true;
      enviar('hola', null); // el saludo trae el menú según el rol
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const t = texto;
    setTexto('');
    enviar(t);
  };

  if (!abierto) {
    return (
      <button
        onClick={abrir}
        aria-label="Abrir el asistente virtual"
        className="fixed bottom-4 right-4 z-50 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-lg px-5 py-3 text-sm font-semibold"
      >
        Asistente
      </button>
    );
  }

  return (
    <section
      aria-label="Asistente virtual"
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 h-[28rem] bg-white border border-gray-300 rounded-lg shadow-xl flex flex-col"
    >
      <header className="bg-blue-700 text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
        <span className="font-semibold text-sm">Asistente virtual</span>
        <button
          onClick={() => setAbierto(false)}
          aria-label="Cerrar el asistente"
          className="text-lg leading-none hover:opacity-80"
        >
          ×
        </button>
      </header>

      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50"
      >
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.autor === 'yo' ? 'justify-end' : 'justify-start'}`}
          >
            <p
              className={`max-w-[85%] whitespace-pre-line text-sm rounded-lg px-3 py-2 ${
                m.autor === 'yo'
                  ? 'bg-blue-600 text-white'
                  : m.error
                  ? 'bg-red-100 text-red-800'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {m.texto}
            </p>
          </div>
        ))}

        {enviando && <p className="text-xs text-slate-600 px-1">Escribiendo…</p>}

        {opciones.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {opciones.map((o) => (
              <button
                key={o.valor}
                onClick={() => enviar(o.valor, o.texto)}
                className="text-xs border border-blue-600 text-blue-700 hover:bg-blue-50 rounded-full px-3 py-1"
              >
                {o.texto}
              </button>
            ))}
          </div>
        )}
        <div ref={fin} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-gray-200 p-2 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX_LONGITUD}
          placeholder="Escribe tu pregunta…"
          aria-label="Mensaje para el asistente"
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm px-3 rounded"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
