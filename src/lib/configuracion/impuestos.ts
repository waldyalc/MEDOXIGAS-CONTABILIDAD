export interface ImpuestoItbis {
  clave: string;
  nombre: string;
  tasa: number | null;
  descripcion: string;
}

export const IMPUESTOS_ITBIS: readonly ImpuestoItbis[] = [
  {
    clave: "itbis-18",
    nombre: "ITBIS 18 %",
    tasa: 18,
    descripcion: "Tasa general de ITBIS.",
  },
  {
    clave: "itbis-16",
    nombre: "ITBIS 16 %",
    tasa: 16,
    descripcion: "Tasa reducida de ITBIS.",
  },
  {
    clave: "itbis-0",
    nombre: "ITBIS 0 %",
    tasa: 0,
    descripcion: "Operaciones con tasa cero.",
  },
  {
    clave: "exento",
    nombre: "Exento",
    tasa: null,
    descripcion: "Operaciones exentas de ITBIS.",
  },
];
