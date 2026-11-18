#!/usr/bin/env python3
"""Fase 4 · Análisis de los resultados de k6 (load/ren-suite.js).

Lee, por cada paso ejecutado, el resumen (--summary-export), los puntos (--out json=*.json.gz)
y las muestras de CPU/memoria, y genera:
  - resumen.csv / resumen.md : métricas por perfil frente a los umbrales del Plan de Pruebas
  - latencia_vs_vu.png       : latencia (p50/p95/p99) y rendimiento frente a usuarios virtuales (REN-05)
  - recursos_estres.png      : VU, p95 por ventana de 10 s y CPU durante el estrés
  - p95_vs_umbral.png        : p95 de REN-01..04 como % del umbral, código original vs mitigado

Uso: python3 analizar_resultados.py <dir_out_principal> [<dir_out_base>] <dir_graficos>
"""
import bisect, csv, glob, gzip, json, os, re, sys
from collections import defaultdict
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime

OUT, BASE, CH = sys.argv[1], (sys.argv[2] if len(sys.argv) > 3 else None), sys.argv[-1]
os.makedirs(CH, exist_ok=True)
INK, INK2, GRID, SURF = '#0b0b0b', '#52514e', '#e4e3df', '#fcfcfb'
C1, C2, C3, C4 = '#2a78d6', '#eb6834', '#1baf7a', '#6250d6'  # paleta categórica de referencia, en orden
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': GRID,
                     'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.facecolor': SURF, 'figure.facecolor': SURF, 'axes.spines.top': False,
                     'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.8})

# Umbrales del Plan de Pruebas (p95 ms, p99 ms)
UMBRAL = {'REN-01': (500, 1000), 'REN-02': (600, 1200), 'REN-03': (800, 1500), 'REN-04': (800, 1500), 'REN-06': (800, 1500)}
PASOS = {'REN-01': 'B_ren01', 'REN-02': 'C_ren02', 'REN-03': 'D_ren03', 'REN-04': 'E_ren04', 'REN-06': 'H_soak'}

def ts(s):  # k6 emite fracciones de hasta 7 dígitos; fromisoformat admite 6
    m = re.match(r'(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(\.\d+)?(.*)$', s)
    frac = '.' + (m.group(2) or '.0')[1:7].ljust(6, '0')
    tz = m.group(3).replace('Z', '+00:00') or '+00:00'
    return datetime.fromisoformat(f'{m.group(1)}{frac}{tz}').timestamp()

def resumen(d, paso):
    p = f'{d}/{paso}.json'
    if not os.path.exists(p): return None
    m = json.load(open(p))['metrics']; t = m['http_req_duration']
    return {'p50': t['med'], 'p95': t['p(95)'], 'p99': t['p(99)'], 'max': t['max'], 'avg': t['avg'],
            'err': m['http_req_failed']['value'] * 100, 'reqs': m['http_reqs']['count'], 'rps': m['http_reqs']['rate'],
            'checks': m['checks']['value'] * 100, 'vus': m['vus_max']['value']}

# ---------- resumen por perfil ----------
filas = []
for perfil, paso in PASOS.items():
    for etiqueta, d in (('mitigado', OUT), ('original', BASE)):
        if d is None: continue
        r = resumen(d, paso)
        if r: filas.append({'perfil': perfil, 'codigo': etiqueta, **r})
for etiqueta, paso in (('antes del estrés', 'A_base_pre'), ('después del estrés (tras 90 s de reposo)', 'G_base_post'), ('después del estrés, repetición 2', 'G_base_post_r2'), ('después del estrés, repetición 3', 'G_base_post_r3')):
    r = resumen(OUT, paso)
    if r: filas.append({'perfil': 'BASE (PT-REN-08) ' + etiqueta, 'codigo': 'mitigado', **r})
with open(f'{CH}/resumen.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0].keys())); w.writeheader(); w.writerows(filas)
print('perfil | codigo | VU | reqs | rps | p50 | p95 | p99 | max | err% | checks%')
for r in filas:
    print(f"{r['perfil']} | {r['codigo']} | {r['vus']:.0f} | {r['reqs']:.0f} | {r['rps']:.1f} | {r['p50']:.1f} | {r['p95']:.1f} | {r['p99']:.1f} | {r['max']:.0f} | {r['err']:.2f} | {r['checks']:.2f}")

# ---------- estrés: puntos ----------
def leer_puntos(paso):
    dur, vus, falla = [], [], []
    for linea in gzip.open(f'{OUT}/{paso}.points.json.gz', 'rt'):
        if '"Point"' not in linea: continue
        o = json.loads(linea); met = o['metric']
        if met == 'http_req_duration':
            tg = o['data']['tags']
            if tg.get('method') == 'POST' and tg.get('url', '').endswith('/api/pedidos'):
                dur.append((ts(o['data']['time']), o['data']['value'], tg.get('status')))
        elif met == 'vus':
            vus.append((ts(o['data']['time']), o['data']['value']))
    return sorted(dur), sorted(vus)

segs = [('F1_ren05'), ('F2_ren05'), ('F3_ren05'), ('F4_ren05')]
todos, offset, lineas = [], 0.0, []   # (t_rel, ms, vu, status)
cpu = []                               # (t_rel, sys, node, pg, k6, rss)
for s in segs:
    dur, vus = leer_puntos(s)
    if not dur: continue
    vt = [t for t, _ in vus]; vv = [v for _, v in vus]
    t0 = vus[0][0]
    for t, ms, st in dur:
        i = max(0, bisect.bisect_right(vt, t) - 1)
        todos.append((offset + t - t0, ms, vv[i], st))
    for t, v in vus: lineas.append((offset + t - t0, v))
    for fila in csv.DictReader(open(f'{OUT}/{s}.samples.csv')):
        t = float(fila['ts'])
        if t0 <= t <= vt[-1] + 1:
            sysc, nodec, k6c = float(fila['cpu_sys']), float(fila['cpu_node']), max(0.0, float(fila['cpu_k6']))
            # El muestreador de la prueba no contó bien los procesos hijos de PostgreSQL: se muestra el
            # resto (PostgreSQL + kernel + otros) como diferencia entre el total y lo medido de Node y k6.
            cpu.append((offset + t - t0, sysc, nodec, max(0.0, sysc - nodec - k6c), k6c, float(fila['rss_node_mb'])))
    offset += vt[-1] - t0 + 1

def pct(xs, q):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(q * len(xs)))]

# latencia por escalón de VU
bins = defaultdict(list)
for t, ms, vu, st in todos: bins[int(round(vu / 20.0) * 20)].append((ms, t, st))
xs, p50, p95, p99, rps, err = [], [], [], [], [], []
print('\nVU | n | p50 | p95 | p99 | rps(aprox) | %no-201')
for b in sorted(bins):
    d = bins[b]
    if len(d) < 200: continue
    ms = [m for m, _, _ in d]; tt = [t for _, t, _ in d]
    seg = max(1, len({int(x) for x in tt}))  # segundos distintos en los que hubo tráfico en este escalón
    n_err = sum(1 for _, _, s in d if s != '201')
    xs.append(b); p50.append(pct(ms, .5)); p95.append(pct(ms, .95)); p99.append(pct(ms, .99)); rps.append(len(d) / seg)
    err.append(100 * n_err / len(d))
    print(f'{b} | {len(d)} | {p50[-1]:.0f} | {p95[-1]:.0f} | {p99[-1]:.0f} | {rps[-1]:.0f} | {err[-1]:.2f}')

fig, (a, b2) = plt.subplots(2, 1, figsize=(8.2, 6.4), sharex=True, gridspec_kw={'height_ratios': [3, 2]})
a.plot(xs, p50, color=C1, lw=2, marker='o', ms=5, label='p50'); a.plot(xs, p95, color=C2, lw=2, marker='o', ms=5, label='p95'); a.plot(xs, p99, color=C3, lw=2, marker='o', ms=5, label='p99')
a.axhline(800, color=INK2, lw=1, ls='--'); a.text(xs[-1], 830, 'umbral p95 de compra: 800 ms', color=INK2, fontsize=8.5, ha='right')
a.axhline(2000, color=INK2, lw=1, ls=':'); a.text(xs[-1], 2050, 'criterio de quiebre del plan: p95 > 2 s', color=INK2, fontsize=8.5, ha='right')
a.set_ylabel('Latencia de POST /api/pedidos (ms)'); a.set_ylim(0, 2300); a.legend(frameon=False, loc='upper left', bbox_to_anchor=(0, 0.9))
a.set_title('Estrés REN-05: latencia y rendimiento frente a usuarios virtuales', loc='left', color=INK, fontsize=11.5)
b2.plot(xs, rps, color=C4, lw=2, marker='o', ms=5); b2.set_ylabel('Peticiones por segundo'); b2.set_xlabel('Usuarios virtuales (VU) concurrentes')
fig.text(0.01, 0.005, 'Cada VU espera 1 s entre iteraciones. Estrés ejecutado por tramos contiguos de la misma rampa. VM de 2 vCPU compartidos con k6 y PostgreSQL.', fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.02, 1, 1)); fig.savefig(f'{CH}/latencia_vs_vu.png', dpi=160); plt.close(fig)

# ventana de 10 s
ven = defaultdict(list)
for t, ms, vu, st in todos: ven[int(t // 10)].append(ms)
vx = [k * 10 + 5 for k in sorted(ven)]; vp95 = [pct(ven[k], .95) for k in sorted(ven)]
fig, (a, b2, c) = plt.subplots(3, 1, figsize=(8.2, 7.2), sharex=True, gridspec_kw={'height_ratios': [1.2, 2, 2]})
a.step([t for t, _ in lineas], [v for _, v in lineas], color=INK2, lw=1.8, where='post'); a.set_ylabel('VU')
a.set_title('Estrés REN-05: comportamiento del sistema durante la rampa', loc='left', color=INK, fontsize=11.5)
b2.plot(vx, vp95, color=C2, lw=2); b2.set_ylabel('p95 por ventana de 10 s (ms)'); b2.axhline(800, color=INK2, lw=1, ls='--')
c.plot([r[0] for r in cpu], [r[1] for r in cpu], color=INK2, lw=2, label='CPU total de la VM')
c.plot([r[0] for r in cpu], [r[2] for r in cpu], color=C1, lw=2, label='Node (API)')
c.plot([r[0] for r in cpu], [r[3] for r in cpu], color=C3, lw=2, label='Resto (PostgreSQL y SO)')
c.plot([r[0] for r in cpu], [r[4] for r in cpu], color=C4, lw=2, label='k6')
c.set_ylabel('CPU (% de la VM)'); c.set_xlabel('Tiempo de estrés (s, tramos concatenados)'); c.set_ylim(0, 105); c.legend(frameon=False, ncol=4, loc='upper left', fontsize=8.5)
fig.tight_layout(); fig.savefig(f'{CH}/recursos_estres.png', dpi=160); plt.close(fig)
pico = max(cpu, key=lambda r: r[1]) if cpu else None
if cpu:
    mx = lambda i: max(r[i] for r in cpu); print(f'\nCPU pico: sys {mx(1):.0f}% · node {mx(2):.0f}% · pg {mx(3):.0f}% · k6 {mx(4):.0f}% · RSS node máx {mx(5):.0f} MB')
    tail = [r for r in cpu if offset - 75 < r[0] < offset - 15]  # tramo sostenido a 200 VU del último tramo (sin la rampa de bajada)
    print('CPU media últimos 60 s (200 VU): ' + ' · '.join(f'{n} {sum(r[i] for r in tail)/len(tail):.0f}%' for n, i in (('total', 1), ('node', 2), ('resto', 3), ('k6', 4))))

# ---------- p95 vs umbral ----------
if BASE:
    perf = [p for p in ('REN-01', 'REN-02', 'REN-03', 'REN-04') if resumen(BASE, PASOS[p]) or p == 'REN-01']
    items = [(p, resumen(BASE, PASOS[p]), resumen(OUT, PASOS[p])) for p in ('REN-02', 'REN-03', 'REN-04')]
    etq = {'REN-02': 'Catálogo (REN-02)', 'REN-03': 'Panel del vendedor (REN-03)', 'REN-04': 'Compra (REN-04)'}
    fig, ax = plt.subplots(figsize=(8.2, 3.6)); h = 0.34
    for i, (p, o, m) in enumerate(items):
        po, pm = 100 * o['p95'] / UMBRAL[p][0], 100 * m['p95'] / UMBRAL[p][0]
        ax.barh(i + h / 2 + 0.02, po, h, color=C1, label='Código original' if i == 0 else None)
        ax.barh(i - h / 2 - 0.02, pm, h, color=C2, label='Con mitigaciones' if i == 0 else None)
        ax.text(po + 0.4, i + h / 2 + 0.02, f"{o['p95']:.1f} ms", va='center', fontsize=8.5, color=INK)
        ax.text(pm + 0.4, i - h / 2 - 0.02, f"{m['p95']:.1f} ms", va='center', fontsize=8.5, color=INK)
    ax.set_yticks(range(len(items))); ax.set_yticklabels([etq[p] for p, _, _ in items]); ax.set_xlim(0, 100)
    ax.axvline(100, color=INK2, lw=1, ls='--'); ax.set_xlabel('p95 medido como % del umbral del plan (100 % = límite)'); ax.legend(frameon=False, loc='lower right')
    ax.set_title('p95 nominal frente al umbral del plan', loc='left', color=INK, fontsize=11); ax.grid(axis='y', visible=False)
    fig.tight_layout(); fig.savefig(f'{CH}/p95_vs_umbral.png', dpi=160); plt.close(fig)

# resumen de memoria / consistencia
for s in ('F1_ren05', 'F2_ren05', 'F3_ren05', 'F4_ren05', 'H_soak'):
    fn = f'{OUT}/{s}.samples.csv'
    if os.path.exists(fn):
        rows = list(csv.DictReader(open(fn)))
        if rows: print(f"{s}: RSS node {float(rows[0]['rss_node_mb']):.0f} -> {float(rows[-1]['rss_node_mb']):.0f} MB (máx {max(float(r['rss_node_mb']) for r in rows):.0f})")

# ---------- diagnóstico del cuello de botella (200 VU sostenidos 60 s) ----------
DIAG = os.path.join(os.path.dirname(OUT.rstrip('/')), 'diag')
print('\nDiagnóstico 200 VU (compra):')
for paso, etq in (('A_defecto', '1 producto, commit síncrono (por defecto)'), ('B_sync_off', '1 producto, synchronous_commit=off'), ('C_20productos', '20 productos, commit síncrono')):
    r = resumen(DIAG, paso)
    if r: print(f"{etq} | rps {r['rps']:.0f} | p50 {r['p50']:.0f} | p95 {r['p95']:.0f} | p99 {r['p99']:.0f} | err {r['err']:.2f}%")
