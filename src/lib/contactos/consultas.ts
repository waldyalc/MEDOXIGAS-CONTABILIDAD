import { createClient } from "@/lib/supabase/server";

import type { Contacto } from "./contactos";

const CAMPOS =
  "id, nombre, rnc_cedula, telefono, correo, direccion, tipo, lista_precio_id, tipo_identificacion, municipio_provincia";

export async function listarContactos(): Promise<Contacto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contactos").select(CAMPOS).order("nombre");
  if (error) return [];
  return (data ?? []) as Contacto[];
}
