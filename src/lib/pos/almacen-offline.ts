import type { AlmacenColaOffline, OperacionOffline } from "./cola-offline";

export type StoreOffline = "carritos" | "operaciones" | "catalogo" | "contactos" | "config";

let apertura: Promise<IDBDatabase> | undefined;

function abrir(): Promise<IDBDatabase> {
  if (apertura !== undefined) return apertura;
  apertura = new Promise((resolve, reject) => {
    const solicitud = indexedDB.open("medoxigas-pos-offline", 1);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      for (const nombre of ["carritos", "operaciones", "catalogo", "contactos", "config"]) {
        db.createObjectStore(nombre);
      }
    };
    solicitud.onsuccess = () => {
      const db = solicitud.result;
      db.onversionchange = () => {
        db.close();
        apertura = undefined;
      };
      resolve(db);
    };
    solicitud.onerror = () => {
      apertura = undefined;
      reject(solicitud.error);
    };
    solicitud.onblocked = () => {
      apertura = undefined;
      reject(new Error("Cierra las otras pestañas del POS para actualizar el almacenamiento local."));
    };
  });
  return apertura;
}

export async function leerOffline<T>(store: StoreOffline, clave: string): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(store, "readonly");
    const solicitud = transaccion.objectStore(store).get(clave);
    transaccion.oncomplete = () => resolve(solicitud.result as T | undefined);
    transaccion.onabort = () => reject(transaccion.error);
    transaccion.onerror = () => reject(transaccion.error);
  });
}

export async function guardarOffline<T>(store: StoreOffline, clave: string, valor: T): Promise<void> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(store, "readwrite");
    transaccion.objectStore(store).put(valor, clave);
    transaccion.oncomplete = () => resolve();
    transaccion.onabort = () => reject(transaccion.error ?? new Error("No se pudo guardar en este dispositivo."));
    transaccion.onerror = () => reject(transaccion.error);
  });
}

export async function borrarOffline(store: StoreOffline, clave: string): Promise<void> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const transaccion = db.transaction(store, "readwrite");
    transaccion.objectStore(store).delete(clave);
    transaccion.oncomplete = () => resolve();
    transaccion.onabort = () => reject(transaccion.error ?? new Error("No se pudo borrar en este dispositivo."));
    transaccion.onerror = () => reject(transaccion.error);
  });
}

export const almacenColaOffline: AlmacenColaOffline = {
  listar: async (ambito) => {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const transaccion = db.transaction("operaciones", "readonly");
      const solicitud = transaccion.objectStore("operaciones").getAll();
      transaccion.oncomplete = () => {
        const filas = solicitud.result as OperacionOffline[];
        resolve(filas.filter((fila) => fila.ambito === ambito));
      };
      transaccion.onerror = () => reject(transaccion.error);
      transaccion.onabort = () => reject(transaccion.error);
    });
  },
  guardar: (operacion) => guardarOffline("operaciones", `${operacion.ambito}/${operacion.uuid}`, operacion),
  eliminar: (ambito, uuid) => borrarOffline("operaciones", `${ambito}/${uuid}`),
};

export async function conBloqueoOffline<T>(ambito: string, accion: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error("Este navegador no admite el bloqueo seguro de la cola offline.");
  return navigator.locks.request(`pos-offline:${ambito}`, accion);
}

export async function siguienteSecuenciaOffline(ambito: string): Promise<number> {
  const clave = `${ambito}/secuencia`;
  const anterior = (await leerOffline<number>("config", clave)) ?? 0;
  const siguiente = anterior + 1;
  await guardarOffline("config", clave, siguiente);
  return siguiente;
}
