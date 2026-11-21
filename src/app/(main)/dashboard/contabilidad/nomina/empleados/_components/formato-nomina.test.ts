import { describe, expect, it } from "vitest";

import {
  borrarSobreGuion,
  completarEmpleadoConDgii,
  digitosAntesDeCursor,
  editarCedula,
  enmascararCuenta,
  etiquetaPeriodoCorta,
  formatearCedulaParcial,
  formatearIdentificacion,
  formatoPorcentaje,
  periodosQueSeCruzan,
  posicionDespuesDeDigitos,
  repartirNombreDgii,
  sugerirPeriodo,
} from "./formato-nomina";

const CAMPOS_VACIOS = { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };

function datosDgii(nombre: string) {
  return { nombre, nombreComercial: null, municipioProvincia: null, direccion: null, estado: "ACTIVO" };
}

describe("formato y periodos de nómina", () => {
  it("sugiere la segunda quincena cuando hoy pasa del día 15", () => {
    expect(sugerirPeriodo("quincenal", "2026-11-20")).toEqual({
      frecuencia: "quincenal",
      inicio: "2026-11-16",
      fin: "2026-11-30",
      codigo: "2026-11-Q2",
    });
  });

  it("sugiere la primera quincena del 1 al 15", () => {
    expect(sugerirPeriodo("quincenal", "2026-11-05")).toEqual({
      frecuencia: "quincenal",
      inicio: "2026-11-01",
      fin: "2026-11-15",
      codigo: "2026-11-Q1",
    });
  });

  it("sugiere el mes completo y respeta los meses cortos y bisiestos", () => {
    expect(sugerirPeriodo("mensual", "2026-11-20").codigo).toBe("2026-11-M");
    expect(sugerirPeriodo("mensual", "2026-11-20").fin).toBe("2026-11-30");
    expect(sugerirPeriodo("mensual", "2028-02-10").fin).toBe("2028-02-29");
  });

  it("marca como cruzados solo los periodos no anulados que se solapan", () => {
    const periodos = [
      { fecha_inicio: "2026-11-01", fecha_fin: "2026-11-30", estado: "pagado" },
      { fecha_inicio: "2026-12-01", fecha_fin: "2026-12-15", estado: "anulado" },
      { fecha_inicio: "2027-01-01", fecha_fin: "2027-01-15", estado: "borrador" },
    ];
    const sugerido = sugerirPeriodo("quincenal", "2026-11-20");

    expect(periodosQueSeCruzan(periodos, sugerido)).toEqual([periodos[0]]);
  });

  it("formatea la cédula con la máscara dominicana y enmascara la cuenta", () => {
    expect(formatearIdentificacion("cedula", "00112345678")).toBe("001-1234567-8");
    expect(formatearIdentificacion("pasaporte", "AB123")).toBe("AB123");
    expect(enmascararCuenta("4100123456789")).toBe("•••• 6789");
    expect(enmascararCuenta(null)).toBe("—");
  });

  it("muestra los porcentajes con 2–3 decimales y el rango del periodo", () => {
    expect(formatoPorcentaje("3.040")).toBe("3.04 %");
    expect(formatoPorcentaje("23.830")).toBe("23.83 %");
    expect(etiquetaPeriodoCorta("2026-11-16", "2026-11-30")).toBe("16–30 nov 2026");
  });
});

describe("máscara de la cédula", () => {
  it("tipeo normal: sanea dígitos y mide el cursor en dígitos", () => {
    // El usuario escribió «4023»; el input mostrará «402-3» y el cursor va tras el 3.
    const edicion = editarCedula("4023", 4);
    expect(edicion).toEqual({ digitos: "4023", cursor: 4 });
    expect(formatearCedulaParcial(edicion.digitos)).toBe("402-3");
    expect(posicionDespuesDeDigitos("402-3", edicion.cursor)).toBe(5);
  });

  it("pegar con guiones no trunca: el corte a 11 se hace tras limpiar", () => {
    const edicion = editarCedula("402-3772118-4", 13);
    expect(edicion).toEqual({ digitos: "40237721184", cursor: 11 });
    expect(formatearCedulaParcial(edicion.digitos)).toBe("402-3772118-4");
    expect(posicionDespuesDeDigitos("402-3772118-4", edicion.cursor)).toBe(13);
  });

  it("pegar con espacios o mezcla queda igual que escrito", () => {
    expect(editarCedula("402 3772118 4", 13)).toEqual({ digitos: "40237721184", cursor: 11 });
    expect(editarCedula("  402-377 2118-4  ", 17)).toEqual({ digitos: "40237721184", cursor: 11 });
  });

  it("pegar más de 11 dígitos corta el exceso y deja el cursor al final", () => {
    expect(editarCedula("40237721184999", 14)).toEqual({ digitos: "40237721184", cursor: 11 });
  });

  it("Backspace sobre el guion borra el dígito anterior, no solo el guion", () => {
    // En «402-3» con el cursor tras el guion (posición 4), el navegador solo
    // quitaría el guion y el saneado no cambiaría: parecía que no borraba.
    const edicion = borrarSobreGuion("4023", "402-3", 4, "Backspace");
    expect(edicion).toEqual({ digitos: "403", cursor: 2 });
    expect(formatearCedulaParcial(edicion?.digitos ?? "")).toBe("403");
  });

  it("Delete antes del guion borra el dígito que sigue al guion", () => {
    // En «402-3772118-4» con el cursor antes del segundo guion (posición 11).
    const edicion = borrarSobreGuion("40237721184", "402-3772118-4", 11, "Delete");
    expect(edicion).toEqual({ digitos: "4023772118", cursor: 10 });
    expect(formatearCedulaParcial(edicion?.digitos ?? "")).toBe("402-3772118");
  });

  it("Backspace/Delete junto a un dígito sigue el camino normal del input", () => {
    expect(borrarSobreGuion("4023", "402-3", 5, "Backspace")).toBeNull();
    expect(borrarSobreGuion("4023", "402-3", 0, "Delete")).toBeNull();
  });

  it("editar en medio no mueve el cursor al final", () => {
    // En «402-3772118-4» se cambia el 7 por un 9 (posición 7 tras teclear).
    const edicion = editarCedula("402-3972118-4", 7);
    expect(edicion).toEqual({ digitos: "40239721184", cursor: 6 });
    expect(posicionDespuesDeDigitos("402-3972118-4", edicion.cursor)).toBe(7);
  });

  it("borrar al final deja el cursor tras el último dígito", () => {
    const edicion = editarCedula("402-3772118-", 12);
    expect(edicion).toEqual({ digitos: "4023772118", cursor: 10 });
    expect(posicionDespuesDeDigitos("402-3772118", edicion.cursor)).toBe(11);
  });

  it("cuenta los dígitos a la izquierda de una posición del texto", () => {
    expect(digitosAntesDeCursor("402-3772118-4", 0)).toBe(0);
    expect(digitosAntesDeCursor("402-3772118-4", 4)).toBe(3);
    expect(digitosAntesDeCursor("402-3772118-4", 13)).toBe(11);
    expect(posicionDespuesDeDigitos("402-3772118-4", 0)).toBe(0);
    expect(posicionDespuesDeDigitos("402-3772118-4", 3)).toBe(4);
    expect(posicionDespuesDeDigitos("402-3772118-4", 11)).toBe(13);
  });
});

describe("reparto del nombre de la DGII", () => {
  it("reparte dos nombres y dos apellidos en mayúsculas", () => {
    expect(repartirNombreDgii("JOSE MANUEL DIAZ ENCARNACION")).toEqual({
      primerNombre: "Jose",
      segundoNombre: "Manuel",
      primerApellido: "Diaz",
      segundoApellido: "Encarnacion",
    });
  });

  it("un solo nombre y un apellido", () => {
    expect(repartirNombreDgii("PABLO LARA")).toEqual({
      primerNombre: "Pablo",
      segundoNombre: "",
      primerApellido: "Lara",
      segundoApellido: "",
    });
  });

  it("tres palabras se leen como un nombre y dos apellidos", () => {
    expect(repartirNombreDgii("LEIDY SANCHEZ AQUINO")).toEqual({
      primerNombre: "Leidy",
      segundoNombre: "",
      primerApellido: "Sanchez",
      segundoApellido: "Aquino",
    });
  });

  it("apellidos compuestos quedan juntos", () => {
    expect(repartirNombreDgii("LUIS MANUEL ARIAS DE LA CRUZ")).toEqual({
      primerNombre: "Luis",
      segundoNombre: "Manuel",
      primerApellido: "Arias",
      segundoApellido: "de la Cruz",
    });
    expect(repartirNombreDgii("ARCADIO ALCANTARA DE LOS SANTOS")).toEqual({
      primerNombre: "Arcadio",
      segundoNombre: "Alcantara",
      primerApellido: "de los Santos",
      segundoApellido: "",
    });
  });

  it("segundos nombres con partícula quedan en el nombre", () => {
    expect(repartirNombreDgii("MARIA DE LOS ANGELES PEREZ")).toEqual({
      primerNombre: "Maria",
      segundoNombre: "de los Angeles",
      primerApellido: "Perez",
      segundoApellido: "",
    });
    expect(repartirNombreDgii("MARIA DEL CARMEN PEREZ GARCIA")).toEqual({
      primerNombre: "Maria",
      segundoNombre: "del Carmen",
      primerApellido: "Perez",
      segundoApellido: "Garcia",
    });
  });

  it("el formato «APELLIDOS, NOMBRES» se lee por la coma", () => {
    expect(repartirNombreDgii("DIAZ ENCARNACION, JOSE MANUEL")).toEqual({
      primerNombre: "Jose",
      segundoNombre: "Manuel",
      primerApellido: "Diaz",
      segundoApellido: "Encarnacion",
    });
  });

  it("conserva las tildes y la ñ del registro", () => {
    expect(repartirNombreDgii("CARLOS ALEJANDRO PEÑA CARRASCO").primerApellido).toBe("Peña");
    expect(repartirNombreDgii("MIGUEL ANGEL NUÑEZ BATISTA").primerApellido).toBe("Nuñez");
  });
});

describe("completar campos del empleado con la DGII", () => {
  it("rellena los cuatro campos cuando están vacíos", () => {
    const resultado = completarEmpleadoConDgii(datosDgii("JOSE MANUEL DIAZ ENCARNACION"), CAMPOS_VACIOS, CAMPOS_VACIOS);
    expect(resultado.campos).toEqual({
      primerNombre: "Jose",
      segundoNombre: "Manuel",
      primerApellido: "Diaz",
      segundoApellido: "Encarnacion",
    });
    expect(resultado.mensaje).toBe("Datos de la DGII: se completó el nombre.");
  });

  it("no pisa lo que el usuario ya escribió", () => {
    const escritos = { ...CAMPOS_VACIOS, primerNombre: "Pedro" };
    const resultado = completarEmpleadoConDgii(datosDgii("JOSE MANUEL DIAZ ENCARNACION"), escritos, CAMPOS_VACIOS);
    expect(resultado.campos.primerNombre).toBeUndefined();
    expect(resultado.campos.primerApellido).toBe("Diaz");
  });

  it("puede reemplazar lo que rellenó una consulta anterior", () => {
    const rellenos = { ...CAMPOS_VACIOS, primerNombre: "Juan", primerApellido: "Rodriguez" };
    const escritos = { ...rellenos };
    const resultado = completarEmpleadoConDgii(datosDgii("LEIDY SANCHEZ AQUINO"), escritos, rellenos);
    expect(resultado.campos.primerNombre).toBe("Leidy");
    expect(resultado.campos.primerApellido).toBe("Sanchez");
  });

  it("pero no lo reemplaza si el usuario lo editó después", () => {
    const rellenos = { ...CAMPOS_VACIOS, primerNombre: "Juan" };
    const escritos = { ...CAMPOS_VACIOS, primerNombre: "Pedro" };
    const resultado = completarEmpleadoConDgii(datosDgii("LEIDY SANCHEZ AQUINO"), escritos, rellenos);
    expect(resultado.campos.primerNombre).toBeUndefined();
    expect(resultado.campos.primerApellido).toBe("Sanchez");
    expect(resultado.mensaje).toBe("Datos de la DGII: se completó el nombre.");
  });

  it("avisa y no cambia nada cuando todo lo escrito difiere del registro", () => {
    const escritos = {
      primerNombre: "Pedro",
      segundoNombre: "Pablo",
      primerApellido: "Gomez",
      segundoApellido: "Duran",
    };
    const resultado = completarEmpleadoConDgii(datosDgii("JOSE MANUEL DIAZ ENCARNACION"), escritos, CAMPOS_VACIOS);
    expect(resultado.campos).toEqual({});
    expect(resultado.mensaje).toContain("La DGII encontró Jose Manuel Diaz Encarnacion");
    expect(resultado.mensaje).toContain("no se cambió lo que ya tenías escrito");
  });

  it("avisa cuando el nombre ya coincide", () => {
    const escritos = {
      primerNombre: "Jose",
      segundoNombre: "Manuel",
      primerApellido: "Diaz",
      segundoApellido: "Encarnacion",
    };
    const resultado = completarEmpleadoConDgii(datosDgii("JOSE MANUEL DIAZ ENCARNACION"), escritos, CAMPOS_VACIOS);
    expect(resultado.campos).toEqual({});
    expect(resultado.mensaje).toBe("El nombre ya coincide con el de la DGII.");
  });
});
