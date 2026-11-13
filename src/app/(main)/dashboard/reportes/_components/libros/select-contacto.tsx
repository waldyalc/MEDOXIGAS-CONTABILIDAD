import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  return (
    <NativeSelect id={id} name={name} defaultValue={valor ?? ""} required={requerido} className="min-w-56">
      {todos ? <NativeSelectOption value="">{etiquetaTodos}</NativeSelectOption> : null}
      {!todos ? <NativeSelectOption value="">Elige un tercero</NativeSelectOption> : null}
      {contactos.map((contacto) => (
        <NativeSelectOption key={contacto.id} value={contacto.id}>
          {contacto.nombre}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
