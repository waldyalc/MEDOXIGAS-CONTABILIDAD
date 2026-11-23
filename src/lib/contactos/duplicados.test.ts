import { describe, expect, test } from "vitest";

import {
  buscarContactoSimilar,
  type ContactoSimilar,
  identificacionParaComparar,
  motivoDuplicado,
  nombreParaComparar,
} from "./duplicados";

const fedra: ContactoSimilar = { id: "1", nombre: "FEDRA MEDINA", rnc_cedula: "131123456" };
const jose: ContactoSimilar = { id: "2", nombre: "José Peña", rnc_cedula: null };

describe("normalización para detectar duplicados", () => {
  test("el nombre ignora acentos, mayúsculas y espacios de más", () => {
    expect(nombreParaComparar("  José   Peña ")).toBe("jose pena");
    expect(nombreParaComparar("JOSE PENA")).toBe("jose pena");
    expect(nombreParaComparar("fedra medina")).toBe("fedra medina");
    expect(nombreParaComparar("FEDRA  MEDINA")).toBe("fedra medina");
  });

  test("el RNC y la cédula se comparan solo por sus dígitos", () => {
    expect(identificacionParaComparar("1-31-12345-6")).toBe("131123456");
    expect(identificacionParaComparar("001 1234567 8")).toBe("00112345678");
    expect(identificacionParaComparar(null)).toBe("");
  });

  test("mismo nombre con distinta escritura es duplicado", () => {
    expect(motivoDuplicado(jose, { nombre: "JOSE PENA", rnc_cedula: null })).toBe("nombre");
    expect(motivoDuplicado(fedra, { nombre: "  fedra   medina ", rnc_cedula: null })).toBe("nombre");
  });

  test("mismo RNC con guiones es duplicado aunque el nombre cambie", () => {
    expect(motivoDuplicado(fedra, { nombre: "FEDRA M. ALCANTARA", rnc_cedula: "1-31-12345-6" })).toBe("rnc");
  });

  test("RNC vacío no choca con otro contacto sin RNC", () => {
    expect(motivoDuplicado(jose, { nombre: "Otra persona", rnc_cedula: null })).toBeNull();
    expect(motivoDuplicado(jose, { nombre: "Otra persona", rnc_cedula: "" })).toBeNull();
  });

  test("nombre distinto y RNC distinto no es duplicado", () => {
    expect(motivoDuplicado(fedra, { nombre: "Pedro Pérez", rnc_cedula: "00112345678" })).toBeNull();
  });

  test("devuelve el primer contacto que coincide", () => {
    const resultado = buscarContactoSimilar([jose, fedra], { nombre: "Fedra Medina", rnc_cedula: null });
    expect(resultado?.contacto.id).toBe("1");
    expect(resultado?.motivo).toBe("nombre");
    expect(buscarContactoSimilar([jose, fedra], { nombre: "Nadie", rnc_cedula: null })).toBeNull();
  });
});
