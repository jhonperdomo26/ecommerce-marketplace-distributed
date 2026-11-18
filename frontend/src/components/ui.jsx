// src/components/ui.jsx
// Piezas de interfaz compartidas (mejoras de usabilidad de la Fase 4 / 5):
//  - Avisos (toasts) para confirmar cada acción (H1 Visibilidad del estado, hallazgo U-08).
//  - Diálogo de confirmación propio que nombra lo que se va a cambiar (H5 Prevención de
//    errores, hallazgos U-07 y U-09), accesible con teclado y lector de pantalla.
//  - Botones, campos con marca de obligatorio (U-14), encabezados, insignias y estados vacíos
//    con el mismo estilo en todas las pantallas (H4 Consistencia).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const Contexto = createContext(null);

export function InterfazProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const contador = useRef(0);

  const avisar = useCallback((texto, tipo = 'exito') => {
    const id = ++contador.current;
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 4000);
  }, []);

  const confirmar = useCallback(
    (opciones) => new Promise((resolver) => setDialogo({ ...opciones, resolver })),
    []
  );

  const cerrarDialogo = (respuesta) => {
    dialogo?.resolver(respuesta);
    setDialogo(null);
  };

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              a.tipo === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
      {dialogo && <Dialogo {...dialogo} onCerrar={cerrarDialogo} />}
    </Contexto.Provider>
  );
}

export function useInterfaz() {
  return useContext(Contexto);
}

function Dialogo({ titulo, mensaje, textoConfirmar = 'Confirmar', peligro = false, onCerrar }) {
  const botonCancelar = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    // El foco empieza en "Cancelar": un Enter accidental no ejecuta la acción.
    const previo = document.activeElement;
    botonCancelar.current?.focus();
    const alTeclear = (e) => e.key === 'Escape' && cerrar.current(false);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus?.(); // devuelve el foco a donde estaba
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-mensaje"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="dialogo-titulo" className="text-lg font-semibold text-slate-900">
          {titulo}
        </h2>
        <p id="dialogo-mensaje" className="mt-2 text-sm text-slate-600">
          {mensaje}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Boton ref={botonCancelar} variante="secundario" onClick={() => onCerrar(false)}>
            Cancelar
          </Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={() => onCerrar(true)}>
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </div>
  );
}

const VARIANTES = {
  primario: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600',
  secundario: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300',
  peligro: 'bg-red-600 text-white hover:bg-red-700 border border-red-600',
  enlace: 'text-blue-700 hover:text-blue-900 hover:underline border border-transparent',
  enlacePeligro: 'text-red-700 hover:text-red-900 hover:underline border border-transparent',
};

export const Boton = React.forwardRef(function Boton(
  { variante = 'primario', tamano = 'normal', className = '', type = 'button', ...props },
  ref
) {
  const relleno = tamano === 'chico' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${relleno} ${VARIANTES[variante]} ${className}`}
      {...props}
    />
  );
});

// Etiqueta + control + ayuda. "obligatorio" muestra el asterisco y su significado al lector.
export function Campo({ id, etiqueta, obligatorio = false, ayuda, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
        {obligatorio && (
          <span className="text-red-600" aria-hidden="true">
            {' '}*
          </span>
        )}
        {obligatorio && <span className="sr-only"> (obligatorio)</span>}
      </label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-600">
          {ayuda}
        </p>
      )}
    </div>
  );
}

export const claseControl =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

export function Encabezado({ titulo, descripcion, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Tarjeta({ children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export const COLOR_ESTADO = {
  pendiente: 'bg-amber-100 text-amber-900 ring-amber-200',
  pagado: 'bg-sky-100 text-sky-900 ring-sky-200',
  enviado: 'bg-violet-100 text-violet-900 ring-violet-200',
  entregado: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  cancelado: 'bg-red-100 text-red-900 ring-red-200',
};

export function Insignia({ estado, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
        COLOR_ESTADO[estado] || 'bg-slate-100 text-slate-800 ring-slate-200'
      }`}
    >
      {children ?? estado}
    </span>
  );
}

export function Vacio({ titulo, children }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{titulo}</p>
      {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <p role="status" className="px-6 py-12 text-center text-sm text-slate-600">
      {texto}
    </p>
  );
}

export function MensajeError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}

export const formatoPrecio = (valor) =>
  Number(valor).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const formatoFecha = (valor) =>
  new Date(valor).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
