"use client";

import { Document, Image, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatearFechaHora, textoCelda } from "./formato";
import type { ColumnaReporte, FilaReporte, TablaReporte } from "./tipos";

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 28,
    paddingBottom: 46,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 8,
    marginBottom: 10,
  },
  logo: {
    width: 64,
    height: 32,
    marginRight: 10,
  },
  encabezadoTexto: {
    flexGrow: 1,
  },
  empresa: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  titulo: {
    fontSize: 13,
    fontWeight: "bold",
  },
  subtitulo: {
    fontSize: 8,
    color: "#4b5563",
    marginTop: 2,
  },
  generado: {
    fontSize: 7,
    color: "#6b7280",
    marginTop: 2,
  },
  tabla: {
    borderWidth: 0.5,
    borderColor: "#d1d5db",
  },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderBottomWidth: 0.5,
    borderBottomColor: "#9ca3af",
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  filaGrupo: {
    backgroundColor: "#f3f4f6",
  },
  filaTotal: {
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  celda: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    lineHeight: 1.2,
  },
  celdaEncabezado: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.5,
    fontWeight: "bold",
  },
  celdaDerecha: {
    textAlign: "right",
  },
  negrita: {
    fontWeight: "bold",
  },
  pie: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#6b7280",
  },
});

function esColumnaNumerica(columna: ColumnaReporte): boolean {
  return columna.tipo === "dinero" || columna.tipo === "porcentaje";
}

function pesoColumna(columna: ColumnaReporte, indice: number): number {
  if (indice === 0) return 2.4;
  if (columna.tipo === "dinero") return 1.4;
  if (columna.tipo === "fecha") return 1.1;
  return 1;
}

function esFilaDestacada(fila: FilaReporte): boolean {
  return fila.estilo === "grupo" || fila.estilo === "subtotal" || fila.estilo === "total";
}

function Fila({ fila, columnas }: { fila: FilaReporte; columnas: readonly ColumnaReporte[] }) {
  return (
    <View
      style={[
        estilos.fila,
        fila.estilo === "grupo" ? estilos.filaGrupo : undefined,
        fila.estilo === "total" ? estilos.filaTotal : undefined,
      ]}
      wrap={false}
    >
      {columnas.map((columna, indice) => (
        <Text
          key={columna.clave}
          style={[
            estilos.celda,
            esColumnaNumerica(columna) ? estilos.celdaDerecha : undefined,
            esFilaDestacada(fila) ? estilos.negrita : undefined,
            { flexGrow: pesoColumna(columna, indice), flexBasis: 0 },
            indice === 0 && fila.nivel != null && fila.nivel > 0 ? { paddingLeft: 4 + fila.nivel * 10 } : undefined,
          ]}
        >
          {textoCelda(fila.celdas[columna.clave] ?? null, columna.tipo)}
        </Text>
      ))}
    </View>
  );
}

interface DocumentoProps {
  tabla: TablaReporte;
  generadoEn: Date;
}

function Documento({ tabla, generadoEn }: DocumentoProps) {
  const horizontal = tabla.columnas.length > 6;

  return (
    <Document title={tabla.titulo} author="MEDOXIGAS ALC, SRL" creator="MEDOXIGAS ALC, SRL">
      <Page size="A4" orientation={horizontal ? "landscape" : "portrait"} style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <Image src="/marca/logo-medoxigas.png" style={estilos.logo} />
          <View style={estilos.encabezadoTexto}>
            <Text style={estilos.empresa}>MEDOXIGAS ALC, SRL</Text>
            <Text style={estilos.titulo}>{tabla.titulo}</Text>
            {tabla.subtitulo ? <Text style={estilos.subtitulo}>{tabla.subtitulo}</Text> : null}
            <Text style={estilos.generado}>Generado: {formatearFechaHora(generadoEn)}</Text>
          </View>
        </View>

        <View style={estilos.tabla}>
          <View style={estilos.filaEncabezado} fixed>
            {tabla.columnas.map((columna, indice) => (
              <Text
                key={columna.clave}
                style={[
                  estilos.celdaEncabezado,
                  esColumnaNumerica(columna) ? estilos.celdaDerecha : undefined,
                  { flexGrow: pesoColumna(columna, indice), flexBasis: 0 },
                ]}
              >
                {columna.titulo}
              </Text>
            ))}
          </View>

          {tabla.filas.map((fila, indice) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: las filas del reporte no tienen un id propio
            <Fila key={`fila-${indice}`} fila={fila} columnas={tabla.columnas} />
          ))}
        </View>

        <View fixed style={estilos.pie}>
          <Text>MEDOXIGAS ALC, SRL</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function tablaAPdf(tabla: TablaReporte, generadoEn: Date = new Date()): Promise<Blob> {
  return pdf(<Documento tabla={tabla} generadoEn={generadoEn} />).toBlob();
}
