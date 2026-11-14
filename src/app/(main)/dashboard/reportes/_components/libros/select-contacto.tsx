import { SelectCampo } from "@/components/select-campo";
import type { ContactoOpcion } from "@/lib/reportes/libros/tipos";

interface Props {
  id?: string;
  name?: string;
  contactos: readonly ContactoOpcion[];
  valor?: string | null;
  requerido?: boolean;
  todos?: boolean;
  etiquetaTodos?: string;
}

export function SelectContacto({
  id = "tercero",
  name = "tercero",
  contactos,
  valor,
  requerido = false,
  todos = false,
  etiquetaTodos = "Todos los terceros",
}: Props) {
  const opciones = contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));

  return (
    <SelectCampo
      id={id}
      name={name}
      opciones={opciones}
      valorInicial={valor ?? ""}
      etiquetaVacia={todos ? etiquetaTodos : "Elige un tercero"}
      buscable
      requerido={requerido}
      className="min-w-56"
    />
  );
}
