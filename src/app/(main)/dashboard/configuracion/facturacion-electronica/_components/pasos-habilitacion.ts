export type AmbienteEcf = "testecf" | "certecf" | "produccion";
export type ModalidadHabilitacion = "migracion" | "primera";
export type EstadoPasoHabilitacion = "finalizado" | "en-proceso" | "pendiente";

export type PasoHabilitacionId = "certificado" | "pruebas" | "representaciones" | "urls" | "declaracion" | "roles";

export interface PasoHabilitacion {
  id: PasoHabilitacionId;
  numero: number;
  titulo: string;
  resumen: string;
  subpasos: readonly string[];
  estados: Record<ModalidadHabilitacion, EstadoPasoHabilitacion>;
}

export interface EmisorEcf {
  nombre: string;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface NumeracionEcf {
  id: string;
  tipo_comprobante: string;
  prefijo: string;
  nombre: string;
  siguiente: number;
  hasta: number | null;
  vence: string | null;
  activa: boolean;
}

export interface CasoPruebaDgii {
  id: string;
  tipo: string;
  descripcion: string;
  objetivo: string;
}

export interface PasoMigracionAlegra {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface ServicioEcfUrl {
  id: string;
  titulo: string;
  descripcion: string;
  ruta: string;
  url: string;
}

export const DOMINIO_BASE_ECF_DEFECTO = "https://medoxigas-contabilidad.vercel.app";

export const ETIQUETA_AMBIENTE: Record<AmbienteEcf, string> = {
  testecf: "Pruebas (TesteCF)",
  certecf: "Certificación (CerteCF)",
  produccion: "Producción",
};

export const ETIQUETA_ESTADO_PASO: Record<EstadoPasoHabilitacion, string> = {
  finalizado: "Finalizado",
  "en-proceso": "En proceso",
  pendiente: "Pendiente",
};

export const PASOS_HABILITACION: readonly PasoHabilitacion[] = [
  {
    id: "certificado",
    numero: 1,
    titulo: "Certificado digital y postulación",
    resumen: "Datos del emisor, certificado .p12/.pfx y postulación como desarrollo propio.",
    subpasos: ["Datos fiscales", "Certificado digital", "Postulación OFV"],
    estados: { migracion: "en-proceso", primera: "en-proceso" },
  },
  {
    id: "pruebas",
    numero: 2,
    titulo: "Pruebas de simulación e-CF",
    resumen: "Set oficial de comprobantes que la DGII evalúa antes de certificar.",
    subpasos: ["Generar XML", "Firmar y enviar", "Revisar resultados"],
    estados: { migracion: "pendiente", primera: "pendiente" },
  },
  {
    id: "representaciones",
    numero: 3,
    titulo: "Representaciones impresas",
    resumen: "Formato Carta y ticket 80 mm con QR, e-NCF, código de seguridad y firma.",
    subpasos: ["Hoja Carta", "Ticket 80 mm", "Datos obligatorios"],
    estados: { migracion: "pendiente", primera: "pendiente" },
  },
  {
    id: "urls",
    numero: 4,
    titulo: "URL Servicios de Producción",
    resumen: "Endpoints propios para semilla, certificado, recepción y aprobación comercial.",
    subpasos: ["Semilla", "Recepción e-CF", "Aprobación comercial"],
    estados: { migracion: "pendiente", primera: "pendiente" },
  },
  {
    id: "declaracion",
    numero: 5,
    titulo: "Declaración jurada",
    resumen: "Confirmación del representante legal dentro de la Oficina Virtual de la DGII.",
    subpasos: ["Revisar datos", "Confirmar en OFV"],
    estados: { migracion: "pendiente", primera: "pendiente" },
  },
  {
    id: "roles",
    numero: 6,
    titulo: "Asignación de roles y e-NCF",
    resumen: "Roles del representante legal y continuidad de las secuencias electrónicas.",
    subpasos: ["Asignación de roles", "Creación de e-NCF", "Corte desde Alegra"],
    estados: { migracion: "pendiente", primera: "pendiente" },
  },
];

export const CASOS_PRUEBA_DGII: readonly CasoPruebaDgii[] = [
  {
    id: "e31-credito-fiscal",
    tipo: "E31",
    descripcion: "Factura de crédito fiscal electrónica",
    objetivo: "Comprobante base para ventas con crédito fiscal.",
  },
  {
    id: "e32-consumo-mayor",
    tipo: "E32 ≥ 250k",
    descripcion: "Factura de consumo electrónica igual o mayor a RD$250,000",
    objetivo: "Debe enviarse de forma individual a la DGII.",
  },
  {
    id: "e32-consumo-menor-rfce",
    tipo: "E32 < 250k + RFCE",
    descripcion: "Factura de consumo electrónica menor a RD$250,000 con resumen RFCE",
    objetivo: "Las consumo menores se agrupan en el resumen diario.",
  },
  {
    id: "e33-nota-debito",
    tipo: "E33",
    descripcion: "Nota de débito electrónica",
    objetivo: "Documento referenciado que aumenta el valor de una venta.",
  },
  {
    id: "e34-nota-credito",
    tipo: "E34",
    descripcion: "Nota de crédito electrónica",
    objetivo: "Documento referenciado para devoluciones y correcciones.",
  },
  {
    id: "e41-compras",
    tipo: "E41",
    descripcion: "Compras electrónicas",
    objetivo: "Registro electrónico de compras y gastos soportados.",
  },
  {
    id: "e43-gastos-menores",
    tipo: "E43",
    descripcion: "Gastos menores electrónicos",
    objetivo: "Comprobante para gastos menores de la empresa.",
  },
  {
    id: "e44-regimenes-especiales",
    tipo: "E44",
    descripcion: "Regímenes especiales electrónicos",
    objetivo: "Comprobante para operaciones acogidas a regímenes especiales.",
  },
  {
    id: "e45-gubernamental",
    tipo: "E45",
    descripcion: "Factura gubernamental electrónica",
    objetivo: "Ventas a instituciones del Estado con retenciones especiales.",
  },
];

export const CHECKLIST_MIGRACION_ALEGRA: readonly PasoMigracionAlegra[] = [
  {
    id: "certificado-vigente",
    titulo: "Confirmar certificado y vigencia",
    descripcion:
      "El certificado digital pertenece al RNC de la empresa, no a Alegra. Se reutiliza mientras siga vigente; solo se cifra y se guarda en Medoxigas.",
  },
  {
    id: "postulacion-desarrollo-propio",
    titulo: "Postular Desarrollo Propio en CerteCF",
    descripcion:
      "La empresa se postula ante la DGII con software propio sin apagar Alegra en producción. El ambiente de certificación queda separado.",
  },
  {
    id: "set-pruebas-aprobado",
    titulo: "Aprobar el set de simulación",
    descripcion:
      "Se generan, firman y envían los casos oficiales desde Medoxigas hasta recibir aceptación de la DGII en CerteCF.",
  },
  {
    id: "urls-declaracion-roles",
    titulo: "Registrar URLs, declaración y roles",
    descripcion:
      "Se copian las URLs propias en la OFV, el representante legal confirma la declaración jurada y se asignan los roles operativos.",
  },
  {
    id: "corte-secuencias",
    titulo: "Hacer el corte de secuencias e-NCF",
    descripcion:
      "Al cierre del día se anota el último e-NCF emitido en Alegra por cada serie y Medoxigas arranca en último + 1, sin duplicar ni reiniciar.",
  },
];

export function normalizarDominioBaseEcf(dominio: string): string {
  const limpio = dominio.trim().replace(/\/+$/, "");
  return limpio === "" ? DOMINIO_BASE_ECF_DEFECTO : limpio;
}

export function urlsServiciosEcf(
  dominioBase = DOMINIO_BASE_ECF_DEFECTO,
  rnc?: string | null,
): readonly ServicioEcfUrl[] {
  const base = normalizarDominioBaseEcf(dominioBase);
  const rncLimpio = rnc?.replace(/\D/g, "") ?? "";
  const prefijoRnc = rncLimpio !== "" ? `/api/ecf/${rncLimpio}` : "/api/ecf";
  const servicios = [
    {
      id: "semilla",
      titulo: "Semilla",
      descripcion: "Autenticación inicial para solicitar el token de la DGII.",
      ruta: `${prefijoRnc}/fe/autenticacion/api/semilla`,
    },
    {
      id: "validacion-certificado",
      titulo: "Validación de Certificado",
      descripcion: "Validación del certificado digital asociado al emisor.",
      ruta: `${prefijoRnc}/fe/autenticacion/api/validacioncertificado`,
    },
    {
      id: "recepcion-ecf",
      titulo: "Recepción e-CF",
      descripcion: "Recepción de comprobantes electrónicos de proveedores.",
      ruta: `${prefijoRnc}/fe/recepcion/api/ecf`,
    },
    {
      id: "aprobacion-comercial",
      titulo: "Aprobación Comercial",
      descripcion: "Recepción de aprobaciones o rechazos comerciales.",
      ruta: `${prefijoRnc}/fe/aprobacioncomercial/api/ecf`,
    },
  ];

  return servicios.map((servicio) => ({ ...servicio, url: `${base}${servicio.ruta}` }));
}

export function nombreCertificadoDigitalValido(nombre: string): boolean {
  const limpio = nombre.trim().toLowerCase();
  return limpio.length > 4 && (limpio.endsWith(".p12") || limpio.endsWith(".pfx"));
}

export function esTipoEncf(tipoComprobante: string, prefijo: string): boolean {
  const tipo = tipoComprobante.trim().toUpperCase();
  const serie = prefijo.trim().toUpperCase();
  const candidatos = [tipo, serie, `${serie}${tipo}`];
  return candidatos.some((candidato) => /^E?(3[1-9]|4[0-7])$/.test(candidato));
}

export function calcularSiguienteDesdeEncf(ultimoEncf: string): string | null {
  const limpio = ultimoEncf.trim().toUpperCase();
  const coincidencia = /^(E(?:3[1-9]|4[0-7]))(\d{10})$/.exec(limpio);
  const tipo = coincidencia?.[1];
  const secuencia = coincidencia?.[2];
  if (!tipo || !secuencia) return null;

  const numero = Number.parseInt(secuencia, 10);
  if (!Number.isSafeInteger(numero) || numero >= 9_999_999_999) return null;
  return `${tipo}${String(numero + 1).padStart(10, "0")}`;
}

export function calcularProgresoHabilitacion(modalidad: ModalidadHabilitacion): number {
  const puntos = PASOS_HABILITACION.reduce((total, paso) => {
    const estado = paso.estados[modalidad];
    if (estado === "finalizado") return total + 1;
    if (estado === "en-proceso") return total + 0.5;
    return total;
  }, 0);
  return Math.round((puntos / PASOS_HABILITACION.length) * 100);
}
