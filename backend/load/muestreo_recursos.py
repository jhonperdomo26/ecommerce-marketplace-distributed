# Muestrea CPU (sistema, Node, PostgreSQL, k6) y memoria RSS cada 2 s -> CSV. Uso: python3 muestreo_recursos.py <pid_node> <salida.csv>
import os, sys, time, glob
def read_stat():
    with open('/proc/stat') as f: p = f.readline().split()[1:]
    v = list(map(int, p)); idle = v[3] + v[4]; return sum(v), idle
def proc_ticks(pid):
    try:
        with open(f'/proc/{pid}/stat') as f: s = f.read().rsplit(')',1)[1].split()
        return int(s[11]) + int(s[12])
    except Exception: return 0
def pids(name):
    out=[]
    for d in glob.glob('/proc/[0-9]*'):
        try:
            c=open(d+'/cmdline','rb').read().replace(b'\0',b' ').decode()
            if name in c and 'sampler.py' not in c and 'run_perf' not in c: out.append(int(d.split('/')[-1]))
        except Exception: pass
    return out
def rss_mb(pid):
    try:
        for l in open(f'/proc/{pid}/status'):
            if l.startswith('VmRSS'): return int(l.split()[1])/1024
    except Exception: pass
    return 0
node = int(sys.argv[1]); out = open(sys.argv[2],'a')
if os.path.getsize(sys.argv[2])==0: out.write('ts,cpu_sys,cpu_node,cpu_pg,cpu_k6,rss_node_mb,rss_pg_mb\n')
tot0, idle0 = read_stat(); n0 = proc_ticks(node)
pg0 = sum(proc_ticks(p) for p in pids('postgres')); k0 = sum(proc_ticks(p) for p in pids('k6 run'))
while True:
    time.sleep(2)
    tot1, idle1 = read_stat(); dt = tot1 - tot0
    n1 = proc_ticks(node); pgp = pids('postgres'); pg1 = sum(proc_ticks(p) for p in pgp)
    kp = pids('k6 run'); k1 = sum(proc_ticks(p) for p in kp)
    if dt>0:
        out.write(f"{time.time():.1f},{100*(1-(idle1-idle0)/dt):.1f},{100*(n1-n0)/dt:.1f},{100*(pg1-pg0)/dt:.1f},{100*(k1-k0)/dt:.1f},{rss_mb(node):.1f},{sum(rss_mb(p) for p in pgp):.1f}\n"); out.flush()
    tot0, idle0, n0, pg0, k0 = tot1, idle1, n1, pg1, k1
