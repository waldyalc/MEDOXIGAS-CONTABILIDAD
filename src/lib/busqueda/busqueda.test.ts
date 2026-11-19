import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { buscarEntidades } = await import("./acciones");

interface Respuesta {
  data?: unknown;
  error?: { message: string } | null;
}

/** Final de una cadena de PostgREST: se puede esperar o llamar `.returns()`. */
type Final = Promise<Respuesta> & { returns: () => Promise<Respuesta> };

interface Llamadas {
  or: string[];
  limit: number[];
}

interface Cadena {
  select: (campos: string) => Cadena;
  in: (columna: string, valores: readonly string[]) => Cadena;
  or: (condicion: string) => Cadena;
  order: (columna: string, opciones?: { ascending: boolean }) => Cadena;
  limit: (cantidad: number) => Final;
  llamadas: Llamadas;
}

/** Simula el builder de supabase-js registrando los `.or()` y `.limit()`. */
function cadena(respuesta: Respuesta): Cadena {
  const promesa = Promise.resolve(respuesta);
  const final = Object.assign(Promise.resolve(respuesta), { returns: () => promesa });
  const llamadas: Llamadas = { or: [], limit: [] };
  const paso = {} as Cadena;

  paso.llamadas = llamadas;
  paso.select = () => paso;
  paso.in = () => paso;
  paso.or = (condicion) => {
    llamadas.or.push(condicion);
    return paso;
  };
  paso.order = () => paso;
  paso.limit = (cantidad) => {
    llamadas.limit.push(cantidad);
    return final;
  };

  return paso;
}

/**
 * Cliente simulado con una cola de respuestas por tabla. El orden de las
 * consultas es el de `buscarEntidades`: contactos (grupo), productos (grupo),
 * contactos (ids de clientes) y facturas.
 */
function clienteCon(colas: Record<string, Cadena[]>) {
  const indice: Record<string, number> = {};

  return {
    from: (tabla: string): Cadena => {
      const actual = indice[tabla] ?? 0;
      indice[tabla] = actual + 1;
      const consulta = colas[tabla]?.[actual];
      if (consulta == null) throw new Error(`Consulta inesperada a ${tabla}`);
      return consulta;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buscarEntidades", () => {
  test("un término de menos de 2 caracteres devuelve vacío sin consultar la base", async () => {
    mocks.createClient.mockResolvedValue({ from: vi.fn() });

    for (const corto of ["", " ", "a", "*"]) {
      await expect(buscarEntidades(corto)).resolves.toEqual({ contactos: [], productos: [], facturas: [] });
    }

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve los tres grupos con el formato serializable de la paleta", async () => {
    const grupoContactos = cadena({
      data: [{ id: "c-1", nombre: "Ferretería Prueba", rnc_cedula: "131488791", tipo: "cliente" }],
    });
    const grupoProductos = cadena({
      data: [{ id: "p-1", nombre: "Oxígeno industrial", referencia: "OX-95", precio: "350.50" }],
    });
    const idsClientes = cadena({ data: [{ id: "c-1" }, { id: "c-2" }] });
    const grupoFacturas = cadena({
      data: [
        {
          id: "f-1",
          ncf: "B0200000125",
          total: 1250,
          fecha: "2026-11-01",
          contactos: { nombre: "Ferretería Prueba" },
        },
      ],
    });

    mocks.createClient.mockResolvedValue(
      clienteCon({
        contactos: [grupoContactos, idsClientes],
        productos: [grupoProductos],
        facturas: [grupoFacturas],
      }),
    );

    await expect(buscarEntidades("ferretería")).resolves.toEqual({
      contactos: [{ id: "c-1", nombre: "Ferretería Prueba", rnc: "131488791", tipo: "cliente" }],
      productos: [{ id: "p-1", nombre: "Oxígeno industrial", referencia: "OX-95", precio: 350.5 }],
      facturas: [{ id: "f-1", ncf: "B0200000125", contacto: "Ferretería Prueba", total: 1250, fecha: "2026-11-01" }],
    });

    expect(grupoContactos.llamadas.or).toEqual(['nombre.ilike."%ferretería%",rnc_cedula.ilike."%ferretería%"']);
    expect(grupoProductos.llamadas.or).toEqual(['nombre.ilike."%ferretería%",referencia.ilike."%ferretería%"']);
    expect(grupoContactos.llamadas.limit).toEqual([5]);
    expect(grupoFacturas.llamadas.or).toEqual(['ncf.ilike."%ferretería%",contacto_id.in.(c-1,c-2)']);
  });

  test("si una tabla falla, los demás grupos siguen devolviendo resultados", async () => {
    const grupoContactos = cadena({ data: [{ id: "c-1", nombre: "Oxymat", rnc_cedula: null, tipo: "ambos" }] });
    const grupoProductos = cadena({ data: [] });
    const idsConError = cadena({ data: null, error: { message: "permiso denegado" } });
    const grupoFacturas = cadena({ data: null, error: { message: "relación no encontrada" } });

    mocks.createClient.mockResolvedValue(
      clienteCon({
        contactos: [grupoContactos, idsConError],
        productos: [grupoProductos],
        facturas: [grupoFacturas],
      }),
    );

    const resultado = await buscarEntidades("oxymat");

    expect(resultado.contactos).toEqual([{ id: "c-1", nombre: "Oxymat", rnc: null, tipo: "ambos" }]);
    expect(resultado.productos).toEqual([]);
    expect(resultado.facturas).toEqual([]);
    // Sin ids de clientes, las facturas solo buscan por NCF.
    expect(grupoFacturas.llamadas.or).toEqual(['ncf.ilike."%oxymat%"']);
  });
});
