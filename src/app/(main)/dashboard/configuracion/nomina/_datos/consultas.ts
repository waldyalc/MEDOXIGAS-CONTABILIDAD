import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas propias de Configuración → Nómina: cuentas y contactos para los
 * selectores. La configuración, el mapeo y los parámetros se leen con
 * `src/lib/nomina/consultas.ts`; aquí solo van los catálogos compartidos que
 * esa capa no expone con el filtro que pide la pantalla.
 */

export interface CuentaNomina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
  acepta_movimientos: boolean;
  activa: boolean;
}

export interface ContactoNomina {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
}

interface FilaCuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
  acepta_movimientos: boolean;
  activa: boolean;
}

interface FilaContacto {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
}

/** Todas las cuentas del catálogo, leídas por lotes (sin corte de 1,000). */
export async function getCuentasNomina(): Promise<CuentaNomina[]> {
  const supabase = await createClient();

  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco, acepta_movimientos, activa")
      .order("codigo")
      .order("id")
      .range(inicio, fin)
      .returns<FilaCuenta[]>(),
  );

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Contactos que pueden actuar como tercero de ley (proveedor o ambos). */
export async function getContactosNomina(): Promise<ContactoNomina[]> {
  const supabase = await createClient();

  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .in("tipo", ["proveedor", "ambos"])
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<FilaContacto[]>(),
  );

  if (error) throw new Error(error.message);
  return data ?? [];
}
