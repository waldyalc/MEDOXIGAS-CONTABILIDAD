import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface UsuarioPrueba {
  email: string;
  password: string;
}

export interface Entorno {
  url: string;
  anonKey: string;
  usuarios: UsuarioPrueba[];
}

function leerDotenv(ruta: string): Record<string, string> {
  const texto = readFileSync(ruta, "utf8");
  const valores: Record<string, string> = {};
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === "" || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual <= 0) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    valores[clave] = valor;
  }
  return valores;
}

export function cargarEntorno(raiz = resolve(__dirname, "..", "..")): Entorno {
  const local = leerDotenv(resolve(raiz, ".env.local"));
  const pruebas = leerDotenv(resolve(raiz, ".env.pruebas"));

  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");

  const usuarios: UsuarioPrueba[] = [];
  for (let i = 1; i <= 5; i++) {
    const email = pruebas[`ZZTEST_USER_${i}`];
    const password = pruebas[`ZZTEST_PASS_${i}`];
    if (!email || !password) throw new Error(`Falta ZZTEST_USER_${i} o ZZTEST_PASS_${i} en .env.pruebas`);
    usuarios.push({ email, password });
  }

  return { url, anonKey, usuarios };
}

export async function clientesAutenticados(entorno: Entorno): Promise<SupabaseClient[]> {
  const clientes: SupabaseClient[] = [];
  for (const usuario of entorno.usuarios) {
    const cliente = createClient(entorno.url, entorno.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await cliente.auth.signInWithPassword({ email: usuario.email, password: usuario.password });
    if (error) throw new Error(`No se pudo entrar con el usuario de prueba ${usuario.email}: ${error.message}`);
    clientes.push(cliente);
  }
  return clientes;
}

export function escribir(texto: string): void {
  process.stdout.write(`${texto}\n`);
}

export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function enteroAzar(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function elegirAzar<T>(rng: () => number, lista: readonly T[]): T {
  const item = lista[Math.floor(rng() * lista.length)];
  if (item === undefined) throw new Error("lista vacía");
  return item;
}

const MESES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export interface Periodo {
  desde: string;
  hasta: string;
}

export function periodos2021a2023(): Periodo[] {
  const lista: Periodo[] = [];
  for (let anio = 2021; anio <= 2023; anio++) {
    for (const mes of MESES) {
      const ultimo = new Date(Date.UTC(anio, Number(mes), 0)).getUTCDate();
      lista.push({ desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-${String(ultimo).padStart(2, "0")}` });
    }
  }
  return lista;
}

export function fechaAzarEnPeriodo(rng: () => number, periodo: Periodo): string {
  const [anio, mes, diaMax] = [
    Number(periodo.desde.slice(0, 4)),
    Number(periodo.desde.slice(5, 7)),
    Number(periodo.hasta.slice(8, 10)),
  ];
  const dia = enteroAzar(rng, 1, diaMax);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias));
  return base.toISOString().slice(0, 10);
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((x, y) => x - y);
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[indice] ?? 0;
}

export interface ResumenRpc {
  intentos: number;
  ok: number;
  fallos: number;
  p50: number;
  p95: number;
  maximo: number;
  errores: Record<string, number>;
}

export class Medidor {
  private tiempos = new Map<string, number[]>();
  private errores = new Map<string, Map<string, number>>();
  private intentos = new Map<string, number>();
  private ok = new Map<string, number>();
  private fallos = new Map<string, number>();

  async medir<T>(nombre: string, fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>) {
    const inicio = performance.now();
    this.sumar(this.intentos, nombre, 1);
    try {
      const { data, error } = await fn();
      const ms = performance.now() - inicio;
      this.registrarTiempo(nombre, ms);
      if (error) {
        this.sumar(this.fallos, nombre, 1);
        const porMensaje = this.errores.get(nombre) ?? new Map<string, number>();
        const mensaje = error.message.slice(0, 300);
        porMensaje.set(mensaje, (porMensaje.get(mensaje) ?? 0) + 1);
        this.errores.set(nombre, porMensaje);
        return { ok: false as const, data: null, error: mensaje };
      }
      this.sumar(this.ok, nombre, 1);
      return { ok: true as const, data, error: null };
    } catch (causa) {
      const ms = performance.now() - inicio;
      this.registrarTiempo(nombre, ms);
      this.sumar(this.fallos, nombre, 1);
      const mensaje = causa instanceof Error ? causa.message.slice(0, 300) : String(causa).slice(0, 300);
      const porMensaje = this.errores.get(nombre) ?? new Map<string, number>();
      porMensaje.set(mensaje, (porMensaje.get(mensaje) ?? 0) + 1);
      this.errores.set(nombre, porMensaje);
      return { ok: false as const, data: null, error: mensaje };
    }
  }

  private registrarTiempo(nombre: string, ms: number) {
    const lista = this.tiempos.get(nombre) ?? [];
    lista.push(ms);
    this.tiempos.set(nombre, lista);
  }

  private sumar(mapa: Map<string, number>, clave: string, delta: number) {
    mapa.set(clave, (mapa.get(clave) ?? 0) + delta);
  }

  resumen(): Record<string, ResumenRpc> {
    const salida: Record<string, ResumenRpc> = {};
    const nombres = new Set([...this.tiempos.keys(), ...this.errores.keys()]);
    for (const nombre of nombres) {
      const tiempos = this.tiempos.get(nombre) ?? [];
      const porMensaje = this.errores.get(nombre);
      salida[nombre] = {
        intentos: this.intentos.get(nombre) ?? 0,
        ok: this.ok.get(nombre) ?? 0,
        fallos: this.fallos.get(nombre) ?? 0,
        p50: Math.round(percentil(tiempos, 50)),
        p95: Math.round(percentil(tiempos, 95)),
        maximo: Math.round(Math.max(0, ...tiempos)),
        errores: porMensaje ? Object.fromEntries(porMensaje) : {},
      };
    }
    return salida;
  }
}

export interface FacturaCreada {
  id: string;
  contactoId: string;
  fecha: string;
  tipo: string;
  total: number;
}

export interface CompraCreada {
  id: string;
  contactoId: string;
  fecha: string;
  total: number;
}

export interface ContactoCreado {
  id: string;
  nombre: string;
  tipo: string;
}

export interface ProductoCreado {
  id: string;
  nombre: string;
  tipo: string;
  precio: number;
  itbisTasa: number;
  inventariable: boolean;
  costo: number;
}
