import { describe, expect, test } from "vitest";

import {
  construirFormularioDgii,
  extraerCamposOcultos,
  normalizarDocumentoDgii,
  parsearRespuestaDgii,
  validarDocumentoDgii,
} from "./consulta";

/** Tabla real devuelta por la DGII para el RNC 130893489 (consulta del 17/11/2026). */
const RESPUESTA_MEDOXIGAS = `
<div class="table-responsive">
  <div>
    <table class="table table-striped detailview" cellspacing="0" align="Center" rules="all" border="1" id="cphMain_dvDatosContribuyentes" style="border-collapse:collapse;">
      <tr><td style="font-weight:bold;">C&#233;dula/RNC</td><td>130-89348-9</td></tr>
      <tr><td style="font-weight:bold;">Nombre/Raz&#243;n Social</td><td>MEDOXIGAS ALC SRL</td></tr>
      <tr><td style="font-weight:bold;">Nombre Comercial</td><td>&nbsp;</td></tr>
      <tr><td style="font-weight:bold;">Categor&#237;a</td><td> </td></tr>
      <tr><td style="font-weight:bold;">R&#233;gimen de pagos</td><td>NORMAL</td></tr>
      <tr><td style="font-weight:bold;">Estado</td><td>ACTIVO</td></tr>
      <tr><td style="font-weight:bold;">Actividad Economica</td><td>VENTA AL POR MAYOR DE GASES INDUSTRIALES, METANOL</td></tr>
      <tr><td style="font-weight:bold;">Administracion Local</td><td>ADM LOCAL VILLA MELLA</td></tr>
      <tr><td style="font-weight:bold;">Facturador Electr&#243;nico</td><td>SI</td></tr>
    </table>
  </div>
</div>`;

/** Tabla con ubicación: la DGII todavía no la devuelve, pero el parser debe leerla si aparece. */
const RESPUESTA_CON_UBICACION = `
<table id="cphMain_dvDatosContribuyentes">
  <tr><td>Nombre/Raz&#243;n Social</td><td>Ferreter&#237;a Central, SRL</td></tr>
  <tr><td>Nombre Comercial</td><td>Ferreter&#237;a Central</td></tr>
  <tr><td>Municipio/Provincia</td><td>Santiago de los Caballeros / Santiago</td></tr>
  <tr><td>Direcci&#243;n</td><td>Av. 27 de Febrero #123</td></tr>
  <tr><td>Estado</td><td>ACTIVO</td></tr>
</table>`;

const FORMULARIO_DGII = `
<form method="post" action="./rnc.aspx" id="frmMain">
  <input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
  <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs123==" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="4F4BAA71" />
  <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="ev456==" />
  <input name="ctl00$cphMain$txtRNCCedula" type="text" maxlength="11" id="cphMain_txtRNCCedula" />
</form>`;

describe("validación del RNC y la cédula", () => {
  test("deja solo los dígitos", () => {
    expect(normalizarDocumentoDgii("1-31-12345-6")).toBe("131123456");
    expect(normalizarDocumentoDgii(" 001-1234567-8 ")).toBe("00112345678");
  });

  test("acepta RNC de 9 y cédula de 11, y rechaza el resto", () => {
    expect(validarDocumentoDgii("rnc", "130893489")).toEqual({ ok: true, numero: "130893489" });
    expect(validarDocumentoDgii("cedula", "00112345678")).toEqual({ ok: true, numero: "00112345678" });
    expect(validarDocumentoDgii("rnc", "13089348")).toEqual({ ok: false, error: "documento_invalido" });
    expect(validarDocumentoDgii("cedula", "130893489")).toEqual({ ok: false, error: "documento_invalido" });
    expect(validarDocumentoDgii("rnc", "")).toEqual({ ok: false, error: "documento_invalido" });
  });
});

describe("formulario ASP.NET de la DGII", () => {
  test("extrae los campos ocultos y la generación del viewstate", () => {
    expect(extraerCamposOcultos(FORMULARIO_DGII)).toEqual({
      viewState: "vs123==",
      viewStateGenerator: "4F4BAA71",
      eventValidation: "ev456==",
    });
  });

  test("sin event validation no se puede consultar", () => {
    expect(extraerCamposOcultos('<input name="__VIEWSTATE" value="solo" />')).toBeNull();
    expect(extraerCamposOcultos("<html>Acceso denegado</html>")).toBeNull();
  });

  test("arma el POST con el número y el botón de buscar", () => {
    const campos = extraerCamposOcultos(FORMULARIO_DGII);
    expect(campos).not.toBeNull();
    if (!campos) return;

    const formulario = construirFormularioDgii(campos, "130893489");
    expect(formulario.get("__VIEWSTATE")).toBe("vs123==");
    expect(formulario.get("__EVENTVALIDATION")).toBe("ev456==");
    expect(formulario.get("ctl00$cphMain$txtRNCCedula")).toBe("130893489");
    expect(formulario.get("ctl00$cphMain$btnBuscarPorRNC")).toBe("BUSCAR");
  });
});

describe("parser de la respuesta de la DGII", () => {
  test("lee el nombre real de MEDOXIGAS y decodifica las entidades", () => {
    const resultado = parsearRespuestaDgii(RESPUESTA_MEDOXIGAS);
    expect(resultado).toEqual({
      estado: "encontrado",
      datos: {
        nombre: "MEDOXIGAS ALC SRL",
        nombreComercial: null,
        municipioProvincia: null,
        direccion: null,
        estado: "ACTIVO",
      },
    });
  });

  test("prioriza la razón social sobre el nombre comercial y lee municipio y dirección", () => {
    const resultado = parsearRespuestaDgii(RESPUESTA_CON_UBICACION);
    expect(resultado.estado).toBe("encontrado");
    if (resultado.estado !== "encontrado") return;

    expect(resultado.datos.nombre).toBe("Ferretería Central, SRL");
    expect(resultado.datos.nombreComercial).toBe("Ferretería Central");
    expect(resultado.datos.municipioProvincia).toBe("Santiago de los Caballeros / Santiago");
    expect(resultado.datos.direccion).toBe("Av. 27 de Febrero #123");
  });

  test("usa el nombre comercial si la razón social viene vacía", () => {
    const resultado = parsearRespuestaDgii(
      '<table id="cphMain_dvDatosContribuyentes"><tr><td>Nombre/Raz&#243;n Social</td><td>&nbsp;</td></tr><tr><td>Nombre Comercial</td><td>Colmado La Esquina</td></tr></table>',
    );
    expect(resultado.estado).toBe("encontrado");
    if (resultado.estado !== "encontrado") return;
    expect(resultado.datos.nombre).toBe("Colmado La Esquina");
  });

  test("un RNC no inscrito se reporta como no encontrado", () => {
    expect(
      parsearRespuestaDgii(
        '<span id="cphMain_lblMensaje">El RNC/Cédula consultado no se encuentra inscrito como Contribuyente.</span>',
      ),
    ).toEqual({ estado: "no_encontrado" });
    expect(parsearRespuestaDgii('<table id="cphMain_dvDatosContribuyentes"> </table>')).toEqual({
      estado: "no_encontrado",
    });
  });

  test("una página sin la tabla de resultados no se confunde con un contribuyente", () => {
    expect(parsearRespuestaDgii("<html><body>Acceso Denegado - Error 403</body></html>")).toEqual({
      estado: "sin_respuesta",
    });
  });
});
