import { z } from "zod";

import { valorACentavos } from "@/lib/facturacion/calculo";

function tieneUnSoloLado(debito: number, credito: number): boolean {
  const hayDebito = debito > 0;
  const hayCredito = credito > 0;
  return hayDebito !== hayCredito;
}

const lineaAsientoSchema = z
  .object({
    cuenta_id: z.uuid({ message: "Selecciona una cuenta en cada línea" }),
    contacto_id: z.uuid().nullish(),
    descripcion: z.string().trim().max(500).optional(),
    debito: z.coerce.number().finite().min(0, { message: "El débito no puede ser negativo" }),
    credito: z.coerce.number().finite().min(0, { message: "El crédito no puede ser negativo" }),
  })
  .superRefine((linea, ctx) => {
    if (!tieneUnSoloLado(linea.debito, linea.credito)) {
      ctx.addIssue({
        code: "custom",
        message: "Cada línea debe llevar débito o crédito, nunca ambos.",
      });
    }
  });

export const crearAsientoManualSchema = z
  .object({
    fecha: z.iso.date(),
    descripcion: z.string().trim().min(1, { message: "La descripción es obligatoria" }).max(500),
    lineas: z.array(lineaAsientoSchema).min(2, { message: "Un asiento requiere al menos dos líneas." }).max(200),
  })
  .superRefine((datos, ctx) => {
    const debitos = datos.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
    const creditos = datos.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);

    if (debitos !== creditos) {
      ctx.addIssue({
        code: "custom",
        message: "El asiento está descuadrado: el total de débitos debe ser igual al total de créditos.",
        path: ["lineas"],
      });
    }
  });

export type CrearAsientoManualEntrada = z.infer<typeof crearAsientoManualSchema>;
