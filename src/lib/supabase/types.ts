export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activo_depreciaciones: {
        Row: {
          activo_id: string
          asiento_id: string
          creado_en: string
          creado_por: string | null
          id: string
          monto: number
          periodo: string
        }
        Insert: {
          activo_id: string
          asiento_id: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          monto: number
          periodo: string
        }
        Update: {
          activo_id?: string
          asiento_id?: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          monto?: number
          periodo?: string
        }
        Relationships: [
          {
            foreignKeyName: "activo_depreciaciones_activo_id_fkey"
            columns: ["activo_id"]
            isOneToOne: false
            referencedRelation: "activos_fijos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activo_depreciaciones_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
        ]
      }
      activos_fijos: {
        Row: {
          asiento_id: string | null
          cantidad: number
          costo_unitario: number
          creado_en: string
          creado_por: string | null
          cuenta_activo_id: string
          cuenta_depreciacion_id: string
          cuenta_gasto_id: string
          fecha_adquisicion: string
          fecha_inicio_depreciacion: string
          id: string
          monto_total: number
          nombre: string
          proveedor_contacto_id: string | null
          referencia: string | null
          tipo_activo: string
          valor_residual: number
          vida_util_meses: number
        }
        Insert: {
          asiento_id?: string | null
          cantidad?: number
          costo_unitario: number
          creado_en?: string
          creado_por?: string | null
          cuenta_activo_id: string
          cuenta_depreciacion_id: string
          cuenta_gasto_id: string
          fecha_adquisicion?: string
          fecha_inicio_depreciacion?: string
          id?: string
          monto_total: number
          nombre: string
          proveedor_contacto_id?: string | null
          referencia?: string | null
          tipo_activo?: string
          valor_residual?: number
          vida_util_meses: number
        }
        Update: {
          asiento_id?: string | null
          cantidad?: number
          costo_unitario?: number
          creado_en?: string
          creado_por?: string | null
          cuenta_activo_id?: string
          cuenta_depreciacion_id?: string
          cuenta_gasto_id?: string
          fecha_adquisicion?: string
          fecha_inicio_depreciacion?: string
          id?: string
          monto_total?: number
          nombre?: string
          proveedor_contacto_id?: string | null
          referencia?: string | null
          tipo_activo?: string
          valor_residual?: number
          vida_util_meses?: number
        }
        Relationships: [
          {
            foreignKeyName: "activos_fijos_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activos_fijos_cuenta_activo_id_fkey"
            columns: ["cuenta_activo_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activos_fijos_cuenta_depreciacion_id_fkey"
            columns: ["cuenta_depreciacion_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activos_fijos_cuenta_gasto_id_fkey"
            columns: ["cuenta_gasto_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activos_fijos_proveedor_contacto_id_fkey"
            columns: ["proveedor_contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      ajuste_inventario_lineas: {
        Row: {
          ajuste_id: string
          cantidad: number
          costo_unitario: number
          id: string
          producto_id: string
          tipo: string
          total: number
        }
        Insert: {
          ajuste_id: string
          cantidad: number
          costo_unitario?: number
          id?: string
          producto_id: string
          tipo: string
          total?: number
        }
        Update: {
          ajuste_id?: string
          cantidad?: number
          costo_unitario?: number
          id?: string
          producto_id?: string
          tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajuste_inventario_lineas_ajuste_id_fkey"
            columns: ["ajuste_id"]
            isOneToOne: false
            referencedRelation: "ajustes_inventario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_inventario_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_inventario: {
        Row: {
          almacen_id: string
          asiento_id: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          fecha: string
          id: string
          numero: number
          observaciones: string | null
          total: number
        }
        Insert: {
          almacen_id: string
          asiento_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha?: string
          id?: string
          numero?: number
          observaciones?: string | null
          total?: number
        }
        Update: {
          almacen_id?: string
          asiento_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha?: string
          id?: string
          numero?: number
          observaciones?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_inventario_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_inventario_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
        ]
      }
      almacenes: {
        Row: {
          activo: boolean
          creado_en: string
          es_principal: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          es_principal?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          es_principal?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      asiento_lineas: {
        Row: {
          asiento_id: string
          centro_costo_id: string | null
          contacto_id: string | null
          credito: number
          cuenta_id: string
          debito: number
          descripcion: string | null
          id: string
        }
        Insert: {
          asiento_id: string
          centro_costo_id?: string | null
          contacto_id?: string | null
          credito?: number
          cuenta_id: string
          debito?: number
          descripcion?: string | null
          id?: string
        }
        Update: {
          asiento_id?: string
          centro_costo_id?: string | null
          contacto_id?: string | null
          credito?: number
          cuenta_id?: string
          debito?: number
          descripcion?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asiento_lineas_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asiento_lineas_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asiento_lineas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asiento_lineas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      asientos: {
        Row: {
          anula_asiento_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string
          fecha: string
          id: string
          numeracion_egreso: string | null
          numeracion_ingreso: string | null
          numero: number
          origen_id: string | null
          origen_tipo: string
          total: number
        }
        Insert: {
          anula_asiento_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion: string
          fecha?: string
          id?: string
          numeracion_egreso?: string | null
          numeracion_ingreso?: string | null
          numero?: number
          origen_id?: string | null
          origen_tipo: string
          total?: number
        }
        Update: {
          anula_asiento_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          numeracion_egreso?: string | null
          numeracion_ingreso?: string | null
          numero?: number
          origen_id?: string | null
          origen_tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "asientos_anula_asiento_id_fkey"
            columns: ["anula_asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_productos: {
        Row: {
          activo: boolean
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      centros_costo: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      cierres_resultados: {
        Row: {
          anio: number
          asiento_id: string
          creado_en: string
          creado_por: string | null
          total: number
        }
        Insert: {
          anio: number
          asiento_id: string
          creado_en?: string
          creado_por?: string | null
          total?: number
        }
        Update: {
          anio?: number
          asiento_id?: string
          creado_en?: string
          creado_por?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cierres_resultados_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacion_movimientos: {
        Row: {
          asiento_linea_id: string
          conciliacion_id: string
        }
        Insert: {
          asiento_linea_id: string
          conciliacion_id: string
        }
        Update: {
          asiento_linea_id?: string
          conciliacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacion_movimientos_asiento_linea_id_fkey"
            columns: ["asiento_linea_id"]
            isOneToOne: true
            referencedRelation: "asiento_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacion_movimientos_conciliacion_id_fkey"
            columns: ["conciliacion_id"]
            isOneToOne: false
            referencedRelation: "conciliaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliaciones: {
        Row: {
          asiento_id: string | null
          conciliado_en: string | null
          creado_en: string
          creado_por: string | null
          cuenta_entradas_id: string | null
          cuenta_gastos_id: string | null
          cuenta_id: string
          cuenta_impuestos_id: string | null
          entradas_bancarias: number
          estado: string
          fecha_desde: string
          fecha_hasta: string
          gastos_bancarios: number
          id: string
          impuestos_bancarios: number
          saldo_bancario: number | null
        }
        Insert: {
          asiento_id?: string | null
          conciliado_en?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_entradas_id?: string | null
          cuenta_gastos_id?: string | null
          cuenta_id: string
          cuenta_impuestos_id?: string | null
          entradas_bancarias?: number
          estado?: string
          fecha_desde: string
          fecha_hasta: string
          gastos_bancarios?: number
          id?: string
          impuestos_bancarios?: number
          saldo_bancario?: number | null
        }
        Update: {
          asiento_id?: string | null
          conciliado_en?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_entradas_id?: string | null
          cuenta_gastos_id?: string | null
          cuenta_id?: string
          cuenta_impuestos_id?: string | null
          entradas_bancarias?: number
          estado?: string
          fecha_desde?: string
          fecha_hasta?: string
          gastos_bancarios?: number
          id?: string
          impuestos_bancarios?: number
          saldo_bancario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliaciones_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliaciones_cuenta_entradas_id_fkey"
            columns: ["cuenta_entradas_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliaciones_cuenta_gastos_id_fkey"
            columns: ["cuenta_gastos_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliaciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliaciones_cuenta_impuestos_id_fkey"
            columns: ["cuenta_impuestos_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_contable: {
        Row: {
          clave: string
          cuenta_id: string
        }
        Insert: {
          clave: string
          cuenta_id: string
        }
        Update: {
          clave?: string
          cuenta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_contable_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          activo: boolean
          correo: string | null
          creado_en: string
          cuenta_cxc_id: string | null
          cuenta_cxp_id: string | null
          direccion: string | null
          id: string
          lista_precio_id: string | null
          municipio_provincia: string | null
          nombre: string
          rnc_cedula: string | null
          telefono: string | null
          tipo: string
          tipo_identificacion: string | null
        }
        Insert: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          cuenta_cxc_id?: string | null
          cuenta_cxp_id?: string | null
          direccion?: string | null
          id?: string
          lista_precio_id?: string | null
          municipio_provincia?: string | null
          nombre: string
          rnc_cedula?: string | null
          telefono?: string | null
          tipo?: string
          tipo_identificacion?: string | null
        }
        Update: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          cuenta_cxc_id?: string | null
          cuenta_cxp_id?: string | null
          direccion?: string | null
          id?: string
          lista_precio_id?: string | null
          municipio_provincia?: string | null
          nombre?: string
          rnc_cedula?: string | null
          telefono?: string | null
          tipo?: string
          tipo_identificacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cuenta_cxc_id_fkey"
            columns: ["cuenta_cxc_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cuenta_cxp_id_fkey"
            columns: ["cuenta_cxp_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_lineas: {
        Row: {
          cantidad: number
          cotizacion_id: string
          descripcion: string
          descuento_pct: number
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          orden: number
          precio: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_lineas_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          centro_costo_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          descuento: number
          estado: string
          factura_id: string | null
          fecha: string
          id: string
          itbis: number
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          remision_id: string | null
          subtotal: number
          terminos: string | null
          total: number
          vencimiento: string
          vendedor_id: string | null
        }
        Insert: {
          centro_costo_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          remision_id?: string | null
          subtotal?: number
          terminos?: string | null
          total?: number
          vencimiento: string
          vendedor_id?: string | null
        }
        Update: {
          centro_costo_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          remision_id?: string | null
          subtotal?: number
          terminos?: string | null
          total?: number
          vencimiento?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas: {
        Row: {
          acepta_movimientos: boolean
          activa: boolean
          codigo: string
          descripcion: string | null
          es_caja_banco: boolean
          id: string
          naturaleza: string
          nombre: string
          numero_cuenta: string | null
          padre_id: string | null
          tipo: string
          tipo_banco: string | null
        }
        Insert: {
          acepta_movimientos?: boolean
          activa?: boolean
          codigo: string
          descripcion?: string | null
          es_caja_banco?: boolean
          id?: string
          naturaleza: string
          nombre: string
          numero_cuenta?: string | null
          padre_id?: string | null
          tipo: string
          tipo_banco?: string | null
        }
        Update: {
          acepta_movimientos?: boolean
          activa?: boolean
          codigo?: string
          descripcion?: string | null
          es_caja_banco?: boolean
          id?: string
          naturaleza?: string
          nombre?: string
          numero_cuenta?: string | null
          padre_id?: string | null
          tipo?: string
          tipo_banco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          correo: string | null
          direccion: string | null
          id: number
          logo_url: string | null
          nombre: string
          rnc: string | null
          telefono: string | null
        }
        Insert: {
          correo?: string | null
          direccion?: string | null
          id?: number
          logo_url?: string | null
          nombre: string
          rnc?: string | null
          telefono?: string | null
        }
        Update: {
          correo?: string | null
          direccion?: string | null
          id?: number
          logo_url?: string | null
          nombre?: string
          rnc?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      existencias: {
        Row: {
          almacen_id: string
          cantidad: number
          producto_id: string
        }
        Insert: {
          almacen_id: string
          cantidad?: number
          producto_id: string
        }
        Update: {
          almacen_id?: string
          cantidad?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "existencias_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "existencias_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_lineas: {
        Row: {
          cantidad: number
          costo_unitario: number
          descripcion: string
          descuento_pct: number
          factura_id: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          orden: number
          precio: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          costo_unitario?: number
          descripcion?: string
          descuento_pct?: number
          factura_id: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          descripcion?: string
          descuento_pct?: number
          factura_id?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "factura_lineas_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_recurrente_generaciones: {
        Row: {
          creado_en: string
          creado_por: string | null
          factura_id: string
          id: string
          periodo: string
          recurrente_id: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          factura_id: string
          id?: string
          periodo: string
          recurrente_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          factura_id?: string
          id?: string
          periodo?: string
          recurrente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_recurrente_generaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_recurrente_generaciones_recurrente_id_fkey"
            columns: ["recurrente_id"]
            isOneToOne: false
            referencedRelation: "facturas_recurrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      factura_recurrente_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          descuento_pct: number
          id: string
          impuesto_id: string | null
          itbis_tasa: number
          precio: number
          producto_id: string | null
          recurrente_id: string
        }
        Insert: {
          cantidad: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis_tasa?: number
          precio?: number
          producto_id?: string | null
          recurrente_id: string
        }
        Update: {
          cantidad?: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis_tasa?: number
          precio?: number
          producto_id?: string | null
          recurrente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_recurrente_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_recurrente_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factura_recurrente_lineas_recurrente_id_fkey"
            columns: ["recurrente_id"]
            isOneToOne: false
            referencedRelation: "facturas_recurrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          almacen_id: string | null
          asiento_id: string | null
          centro_costo_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          credito: number
          descuento: number
          estado: string
          fecha: string
          id: string
          itbis: number
          ncf: string
          notas: string | null
          numero: number
          otros_impuestos: number
          pagado: number
          pie: string | null
          propina: number
          retenido: number
          subtotal: number
          terminos: string | null
          tipo_comprobante: string
          total: number
          vencimiento: string
          vendedor_id: string | null
        }
        Insert: {
          almacen_id?: string | null
          asiento_id?: string | null
          centro_costo_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          credito?: number
          descuento?: number
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          pagado?: number
          pie?: string | null
          propina?: number
          retenido?: number
          subtotal?: number
          terminos?: string | null
          tipo_comprobante: string
          total?: number
          vencimiento: string
          vendedor_id?: string | null
        }
        Update: {
          almacen_id?: string | null
          asiento_id?: string | null
          centro_costo_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          credito?: number
          descuento?: number
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          pagado?: number
          pie?: string | null
          propina?: number
          retenido?: number
          subtotal?: number
          terminos?: string | null
          tipo_comprobante?: string
          total?: number
          vencimiento?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_proveedor: {
        Row: {
          almacen_id: string | null
          asiento_id: string | null
          centro_costo_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          credito: number
          estado: string
          fecha: string
          id: string
          itbis: number
          ncf: string | null
          notas: string | null
          numero: number
          otros_impuestos: number
          pagado: number
          propina: number
          retenido: number
          subtotal: number
          total: number
          vencimiento: string
        }
        Insert: {
          almacen_id?: string | null
          asiento_id?: string | null
          centro_costo_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          credito?: number
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          pagado?: number
          propina?: number
          retenido?: number
          subtotal?: number
          total?: number
          vencimiento: string
        }
        Update: {
          almacen_id?: string | null
          asiento_id?: string | null
          centro_costo_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          credito?: number
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          pagado?: number
          propina?: number
          retenido?: number
          subtotal?: number
          total?: number
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_proveedor_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_proveedor_lineas: {
        Row: {
          cantidad: number
          costo: number
          cuenta_id: string | null
          descripcion: string
          factura_proveedor_id: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          orden: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          factura_proveedor_id: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          factura_proveedor_id?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "facturas_proveedor_lineas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_lineas_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_proveedor_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_recurrentes: {
        Row: {
          contacto_id: string
          creado_en: string
          creado_por: string | null
          fecha_inicio: string
          frecuencia_meses: number
          id: string
          notas: string | null
          numero: number
          pie: string | null
          plazo_dias: number
          terminos: string | null
          tipo_comprobante: string
          vigencia_hasta: string | null
        }
        Insert: {
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          fecha_inicio?: string
          frecuencia_meses?: number
          id?: string
          notas?: string | null
          numero?: number
          pie?: string | null
          plazo_dias?: number
          terminos?: string | null
          tipo_comprobante?: string
          vigencia_hasta?: string | null
        }
        Update: {
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          fecha_inicio?: string
          frecuencia_meses?: number
          id?: string
          notas?: string | null
          numero?: number
          pie?: string | null
          plazo_dias?: number
          terminos?: string | null
          tipo_comprobante?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_recurrentes_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_menores: {
        Row: {
          asiento_id: string | null
          contacto_id: string | null
          creado_en: string
          creado_por: string | null
          cuenta_gasto_id: string
          cuenta_pago_id: string
          descripcion: string
          estado: string
          fecha: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          ncf: string | null
          numero: number
          otros_impuestos: number
          pago_recurrente_id: string | null
          periodo: string | null
          propina: number
          subtotal: number
          total: number
        }
        Insert: {
          asiento_id?: string | null
          contacto_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_gasto_id?: string
          cuenta_pago_id?: string
          descripcion: string
          estado?: string
          fecha?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          ncf?: string | null
          numero?: number
          otros_impuestos?: number
          pago_recurrente_id?: string | null
          periodo?: string | null
          propina?: number
          subtotal?: number
          total?: number
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_gasto_id?: string
          cuenta_pago_id?: string
          descripcion?: string
          estado?: string
          fecha?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          ncf?: string | null
          numero?: number
          otros_impuestos?: number
          pago_recurrente_id?: string | null
          periodo?: string | null
          propina?: number
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_menores_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_menores_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_menores_cuenta_gasto_id_fkey"
            columns: ["cuenta_gasto_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_menores_cuenta_pago_id_fkey"
            columns: ["cuenta_pago_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_menores_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_menores_pago_recurrente_id_fkey"
            columns: ["pago_recurrente_id"]
            isOneToOne: false
            referencedRelation: "pagos_recurrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      impuestos: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          cuenta_id: string | null
          id: string
          nombre: string
          orden: number
          tarifa: number
          tipo: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          cuenta_id?: string | null
          id?: string
          nombre: string
          orden?: number
          tarifa?: number
          tipo: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          cuenta_id?: string | null
          id?: string
          nombre?: string
          orden?: number
          tarifa?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "impuestos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_precios: {
        Row: {
          activo: boolean
          creado_en: string
          es_principal: boolean
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          es_principal?: boolean
          id?: string
          nombre: string
          tipo?: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          es_principal?: boolean
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: []
      }
      monedas: {
        Row: {
          activo: boolean
          codigo: string
          creado_en: string
          es_base: boolean
          nombre: string
          simbolo: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_en?: string
          es_base?: boolean
          nombre: string
          simbolo: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_en?: string
          es_base?: boolean
          nombre?: string
          simbolo?: string
        }
        Relationships: []
      }
      nota_credito_compra_lineas: {
        Row: {
          cantidad: number
          costo: number
          cuenta_id: string | null
          descripcion: string
          factura_proveedor_linea_id: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          nota_id: string
          orden: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          factura_proveedor_linea_id: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id: string
          orden?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          factura_proveedor_linea_id?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id?: string
          orden?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_credito_compra_lineas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_compra_lineas_factura_proveedor_linea_id_fkey"
            columns: ["factura_proveedor_linea_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_compra_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_compra_lineas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_credito_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_compra_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_credito_venta_lineas: {
        Row: {
          cantidad: number
          costo_unitario: number
          descripcion: string
          descuento_pct: number
          factura_linea_id: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          nota_id: string
          orden: number
          precio: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          costo_unitario?: number
          descripcion?: string
          descuento_pct?: number
          factura_linea_id: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id: string
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          descripcion?: string
          descuento_pct?: number
          factura_linea_id?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id?: string
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_credito_venta_lineas_factura_linea_id_fkey"
            columns: ["factura_linea_id"]
            isOneToOne: false
            referencedRelation: "factura_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_venta_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_venta_lineas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_credito_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_credito_venta_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      nota_debito_venta_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          descuento_pct: number
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          nota_id: string
          orden: number
          precio: number
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id: string
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          nota_id?: string
          orden?: number
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_debito_venta_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_debito_venta_lineas_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_debito_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nota_debito_venta_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_credito_compra: {
        Row: {
          almacen_id: string | null
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          devuelve_inventario: boolean
          estado: string
          factura_proveedor_id: string
          fecha: string
          id: string
          itbis: number
          ncf: string | null
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          subtotal: number
          total: number
        }
        Insert: {
          almacen_id?: string | null
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          devuelve_inventario?: boolean
          estado?: string
          factura_proveedor_id: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          total?: number
        }
        Update: {
          almacen_id?: string | null
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          devuelve_inventario?: boolean
          estado?: string
          factura_proveedor_id?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_credito_compra_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_compra_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_compra_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_compra_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_credito_venta: {
        Row: {
          almacen_id: string | null
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          devuelve_inventario: boolean
          estado: string
          factura_id: string
          fecha: string
          id: string
          itbis: number
          ncf: string
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          subtotal: number
          total: number
        }
        Insert: {
          almacen_id?: string | null
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          devuelve_inventario?: boolean
          estado?: string
          factura_id: string
          fecha?: string
          id?: string
          itbis?: number
          ncf: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          total?: number
        }
        Update: {
          almacen_id?: string | null
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          devuelve_inventario?: boolean
          estado?: string
          factura_id?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_credito_venta_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_venta_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_venta_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_credito_venta_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_debito_venta: {
        Row: {
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          descuento: number
          estado: string
          factura_id: string
          fecha: string
          id: string
          itbis: number
          ncf: string
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          subtotal: number
          tipo: string
          total: number
        }
        Insert: {
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          estado?: string
          factura_id: string
          fecha?: string
          id?: string
          itbis?: number
          ncf: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          tipo: string
          total?: number
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          estado?: string
          factura_id?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_debito_venta_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_debito_venta_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_debito_venta_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      numeraciones: {
        Row: {
          activa: boolean
          hasta: number | null
          id: string
          nombre: string
          prefijo: string
          siguiente: number
          tipo_comprobante: string
          vence: string | null
        }
        Insert: {
          activa?: boolean
          hasta?: number | null
          id?: string
          nombre: string
          prefijo: string
          siguiente?: number
          tipo_comprobante: string
          vence?: string | null
        }
        Update: {
          activa?: boolean
          hasta?: number | null
          id?: string
          nombre?: string
          prefijo?: string
          siguiente?: number
          tipo_comprobante?: string
          vence?: string | null
        }
        Relationships: []
      }
      orden_compra_lineas: {
        Row: {
          cantidad: number
          costo: number
          cuenta_id: string | null
          descripcion: string
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          orden: number
          orden_id: string
          producto_id: string | null
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          orden_id: string
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          costo?: number
          cuenta_id?: string | null
          descripcion?: string
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          orden_id?: string
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_compra_lineas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_lineas_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          contacto_id: string
          creado_en: string
          creado_por: string | null
          estado: string
          factura_proveedor_id: string | null
          fecha: string
          fecha_entrega: string
          id: string
          itbis: number
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          subtotal: number
          terminos: string | null
          total: number
        }
        Insert: {
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_proveedor_id?: string | null
          fecha?: string
          fecha_entrega?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          terminos?: string | null
          total?: number
        }
        Update: {
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_proveedor_id?: string | null
          fecha?: string
          fecha_entrega?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          terminos?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_compra_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_proveedor_aplicacion_retenciones: {
        Row: {
          aplicacion_id: string
          base: number
          id: string
          monto: number
          porcentaje: number
          retencion_id: string
        }
        Insert: {
          aplicacion_id: string
          base?: number
          id?: string
          monto: number
          porcentaje?: number
          retencion_id: string
        }
        Update: {
          aplicacion_id?: string
          base?: number
          id?: string
          monto?: number
          porcentaje?: number
          retencion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_proveedor_aplicacion_retenciones_aplicacion_id_fkey"
            columns: ["aplicacion_id"]
            isOneToOne: false
            referencedRelation: "pago_proveedor_aplicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_proveedor_aplicacion_retenciones_retencion_id_fkey"
            columns: ["retencion_id"]
            isOneToOne: false
            referencedRelation: "retenciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_proveedor_aplicaciones: {
        Row: {
          factura_proveedor_id: string
          id: string
          monto: number
          pago_id: string
          retenido: number
        }
        Insert: {
          factura_proveedor_id: string
          id?: string
          monto: number
          pago_id: string
          retenido?: number
        }
        Update: {
          factura_proveedor_id?: string
          id?: string
          monto?: number
          pago_id?: string
          retenido?: number
        }
        Relationships: [
          {
            foreignKeyName: "pago_proveedor_aplicaciones_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_proveedor_aplicaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_proveedor_retenciones: {
        Row: {
          base: number
          id: string
          monto: number
          pago_id: string
          porcentaje: number
          retencion_id: string
        }
        Insert: {
          base?: number
          id?: string
          monto: number
          pago_id: string
          porcentaje?: number
          retencion_id: string
        }
        Update: {
          base?: number
          id?: string
          monto?: number
          pago_id?: string
          porcentaje?: number
          retencion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_proveedor_retenciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_proveedor_retenciones_retencion_id_fkey"
            columns: ["retencion_id"]
            isOneToOne: false
            referencedRelation: "retenciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_recibido_aplicacion_retenciones: {
        Row: {
          aplicacion_id: string
          base: number
          id: string
          monto: number
          porcentaje: number
          retencion_id: string
        }
        Insert: {
          aplicacion_id: string
          base?: number
          id?: string
          monto: number
          porcentaje?: number
          retencion_id: string
        }
        Update: {
          aplicacion_id?: string
          base?: number
          id?: string
          monto?: number
          porcentaje?: number
          retencion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_recibido_aplicacion_retenciones_aplicacion_id_fkey"
            columns: ["aplicacion_id"]
            isOneToOne: false
            referencedRelation: "pago_recibido_aplicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_recibido_aplicacion_retenciones_retencion_id_fkey"
            columns: ["retencion_id"]
            isOneToOne: false
            referencedRelation: "retenciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_recibido_aplicaciones: {
        Row: {
          factura_id: string
          id: string
          monto: number
          pago_id: string
          retenido: number
        }
        Insert: {
          factura_id: string
          id?: string
          monto: number
          pago_id: string
          retenido?: number
        }
        Update: {
          factura_id?: string
          id?: string
          monto?: number
          pago_id?: string
          retenido?: number
        }
        Relationships: [
          {
            foreignKeyName: "pago_recibido_aplicaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_recibido_aplicaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos_recibidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_recibido_retenciones: {
        Row: {
          base: number
          id: string
          monto: number
          pago_id: string
          porcentaje: number
          retencion_id: string
        }
        Insert: {
          base?: number
          id?: string
          monto: number
          pago_id: string
          porcentaje?: number
          retencion_id: string
        }
        Update: {
          base?: number
          id?: string
          monto?: number
          pago_id?: string
          porcentaje?: number
          retencion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_recibido_retenciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos_recibidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_recibido_retenciones_retencion_id_fkey"
            columns: ["retencion_id"]
            isOneToOne: false
            referencedRelation: "retenciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_proveedor: {
        Row: {
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          cuenta_id: string
          estado: string
          factura_proveedor_id: string | null
          fecha: string
          id: string
          metodo: string
          monto: number
          notas: string | null
          numero: number
          retenido: number
        }
        Insert: {
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id: string
          estado?: string
          factura_proveedor_id?: string | null
          fecha?: string
          id?: string
          metodo?: string
          monto: number
          notas?: string | null
          numero?: number
          retenido?: number
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id?: string
          estado?: string
          factura_proveedor_id?: string | null
          fecha?: string
          id?: string
          metodo?: string
          monto?: number
          notas?: string | null
          numero?: number
          retenido?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagos_proveedor_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_proveedor_factura_proveedor_id_fkey"
            columns: ["factura_proveedor_id"]
            isOneToOne: false
            referencedRelation: "facturas_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_recibidos: {
        Row: {
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          cuenta_id: string
          estado: string
          factura_id: string | null
          fecha: string
          id: string
          metodo: string
          monto: number
          notas: string | null
          numero: number
          retenido: number
        }
        Insert: {
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id: string
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          metodo?: string
          monto: number
          notas?: string | null
          numero?: number
          retenido?: number
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id?: string
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          metodo?: string
          monto?: number
          notas?: string | null
          numero?: number
          retenido?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagos_recibidos_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recibidos_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recibidos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recibidos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_recurrentes: {
        Row: {
          activo: boolean
          contacto_id: string | null
          creado_en: string
          creado_por: string | null
          cuenta_gasto_id: string
          cuenta_pago_id: string
          fecha_inicio: string
          frecuencia_meses: number
          id: string
          impuesto_id: string | null
          itbis_tasa: number
          nombre: string
          notas: string | null
          subtotal: number
          vigencia_hasta: string | null
        }
        Insert: {
          activo?: boolean
          contacto_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_gasto_id: string
          cuenta_pago_id: string
          fecha_inicio?: string
          frecuencia_meses: number
          id?: string
          impuesto_id?: string | null
          itbis_tasa?: number
          nombre: string
          notas?: string | null
          subtotal: number
          vigencia_hasta?: string | null
        }
        Update: {
          activo?: boolean
          contacto_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta_gasto_id?: string
          cuenta_pago_id?: string
          fecha_inicio?: string
          frecuencia_meses?: number
          id?: string
          impuesto_id?: string | null
          itbis_tasa?: number
          nombre?: string
          notas?: string | null
          subtotal?: number
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_recurrentes_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recurrentes_cuenta_gasto_id_fkey"
            columns: ["cuenta_gasto_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recurrentes_cuenta_pago_id_fkey"
            columns: ["cuenta_pago_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_recurrentes_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          creado_en: string
          nombre: string | null
          rol: string
          user_id: string
        }
        Insert: {
          creado_en?: string
          nombre?: string | null
          rol: string
          user_id: string
        }
        Update: {
          creado_en?: string
          nombre?: string | null
          rol?: string
          user_id?: string
        }
        Relationships: []
      }
      periodos_contables: {
        Row: {
          actualizado_en: string
          cerrado_en: string | null
          cerrado_por: string | null
          estado: string
          periodo: string
        }
        Insert: {
          actualizado_en?: string
          cerrado_en?: string | null
          cerrado_por?: string | null
          estado?: string
          periodo: string
        }
        Update: {
          actualizado_en?: string
          cerrado_en?: string | null
          cerrado_por?: string | null
          estado?: string
          periodo?: string
        }
        Relationships: []
      }
      plantillas_impresion: {
        Row: {
          actualizado_en: string
          mostrar_logo: boolean
          notas_pie: string | null
          terminos: string | null
          tipo_documento: string
        }
        Insert: {
          actualizado_en?: string
          mostrar_logo?: boolean
          notas_pie?: string | null
          terminos?: string | null
          tipo_documento: string
        }
        Update: {
          actualizado_en?: string
          mostrar_logo?: boolean
          notas_pie?: string | null
          terminos?: string | null
          tipo_documento?: string
        }
        Relationships: []
      }
      producto_precios: {
        Row: {
          lista_id: string
          precio: number
          producto_id: string
        }
        Insert: {
          lista_id: string
          precio: number
          producto_id: string
        }
        Update: {
          lista_id?: string
          precio?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_precios_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_precios_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          cantidad: number
          categoria_id: string | null
          costo: number
          creado_en: string
          cuenta_costo_id: string | null
          cuenta_ingreso_id: string | null
          cuenta_inventario_id: string | null
          descripcion: string | null
          id: string
          impuesto_id: string | null
          inventariable: boolean
          itbis_tasa: number
          nombre: string
          precio: number
          referencia: string | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          cantidad?: number
          categoria_id?: string | null
          costo?: number
          creado_en?: string
          cuenta_costo_id?: string | null
          cuenta_ingreso_id?: string | null
          cuenta_inventario_id?: string | null
          descripcion?: string | null
          id?: string
          impuesto_id?: string | null
          inventariable?: boolean
          itbis_tasa?: number
          nombre: string
          precio?: number
          referencia?: string | null
          tipo?: string
        }
        Update: {
          activo?: boolean
          cantidad?: number
          categoria_id?: string | null
          costo?: number
          creado_en?: string
          cuenta_costo_id?: string | null
          cuenta_ingreso_id?: string | null
          cuenta_inventario_id?: string | null
          descripcion?: string | null
          id?: string
          impuesto_id?: string | null
          inventariable?: boolean
          itbis_tasa?: number
          nombre?: string
          precio?: number
          referencia?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_cuenta_costo_id_fkey"
            columns: ["cuenta_costo_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_cuenta_ingreso_id_fkey"
            columns: ["cuenta_ingreso_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_cuenta_inventario_id_fkey"
            columns: ["cuenta_inventario_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      remision_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          descuento_pct: number
          id: string
          impuesto_id: string | null
          itbis: number
          itbis_tasa: number
          orden: number
          precio: number
          producto_id: string | null
          remision_id: string
          subtotal: number
          total: number
        }
        Insert: {
          cantidad: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          remision_id: string
          subtotal?: number
          total?: number
        }
        Update: {
          cantidad?: number
          descripcion?: string
          descuento_pct?: number
          id?: string
          impuesto_id?: string | null
          itbis?: number
          itbis_tasa?: number
          orden?: number
          precio?: number
          producto_id?: string | null
          remision_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "remision_lineas_impuesto_id_fkey"
            columns: ["impuesto_id"]
            isOneToOne: false
            referencedRelation: "impuestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remision_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remision_lineas_remision_id_fkey"
            columns: ["remision_id"]
            isOneToOne: false
            referencedRelation: "remisiones"
            referencedColumns: ["id"]
          },
        ]
      }
      remisiones: {
        Row: {
          centro_costo_id: string | null
          contacto_id: string
          cotizacion_id: string | null
          creado_en: string
          creado_por: string | null
          estado: string
          factura_id: string | null
          fecha: string
          id: string
          itbis: number
          notas: string | null
          numero: number
          otros_impuestos: number
          propina: number
          subtotal: number
          terminos: string | null
          total: number
          vencimiento: string
          vendedor_id: string | null
        }
        Insert: {
          centro_costo_id?: string | null
          contacto_id: string
          cotizacion_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          terminos?: string | null
          total?: number
          vencimiento: string
          vendedor_id?: string | null
        }
        Update: {
          centro_costo_id?: string | null
          contacto_id?: string
          cotizacion_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          otros_impuestos?: number
          propina?: number
          subtotal?: number
          terminos?: string | null
          total?: number
          vencimiento?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      retenciones: {
        Row: {
          activa: boolean
          creado_en: string
          cuenta_anticipo_id: string | null
          cuenta_id: string
          id: string
          nombre: string
          porcentaje: number
          tipo: string
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          cuenta_anticipo_id?: string | null
          cuenta_id: string
          id?: string
          nombre: string
          porcentaje: number
          tipo: string
        }
        Update: {
          activa?: boolean
          creado_en?: string
          cuenta_anticipo_id?: string | null
          cuenta_id?: string
          id?: string
          nombre?: string
          porcentaje?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "retenciones_cuenta_anticipo_id_fkey"
            columns: ["cuenta_anticipo_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retenciones_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      tasas_cambio: {
        Row: {
          creado_en: string
          fecha: string
          id: string
          moneda_codigo: string
          tasa: number
        }
        Insert: {
          creado_en?: string
          fecha?: string
          id?: string
          moneda_codigo: string
          tasa: number
        }
        Update: {
          creado_en?: string
          fecha?: string
          id?: string
          moneda_codigo?: string
          tasa?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasas_cambio_moneda_codigo_fkey"
            columns: ["moneda_codigo"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      terminos_pago: {
        Row: {
          activo: boolean
          creado_en: string
          dias: number
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          dias?: number
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          dias?: number
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      transferencia_inventario_lineas: {
        Row: {
          cantidad: number
          id: string
          producto_id: string
          transferencia_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          producto_id: string
          transferencia_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          producto_id?: string
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencia_inventario_lineas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencia_inventario_lineas_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_inventario"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_inventario: {
        Row: {
          creado_en: string
          creado_por: string | null
          destino_id: string
          estado: string
          fecha: string
          id: string
          numero: number
          observaciones: string | null
          origen_id: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          destino_id: string
          estado?: string
          fecha?: string
          id?: string
          numero?: number
          observaciones?: string | null
          origen_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          destino_id?: string
          estado?: string
          fecha?: string
          id?: string
          numero?: number
          observaciones?: string | null
          origen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_inventario_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_inventario_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          identificacion: string | null
          nombre: string
          observacion: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          identificacion?: string | null
          nombre: string
          observacion?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          identificacion?: string | null
          nombre?: string
          observacion?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _actualizar_producto_sin_impuestos: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      _almacen_principal: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _anular_documento_base: {
        Args: {
          p_tipo: string
          p_id: string
        }
        Returns: string
      }
      _conciliacion_lineas: {
        Args: {
          p_lineas: Json
        }
        Returns: string[]
      }
      _crear_asiento: {
        Args: {
          p_fecha: string
          p_descripcion: string
          p_origen_tipo: string
          p_origen_id: string
          p_lineas: Json
        }
        Returns: string
      }
      _crear_documento_no_contable: {
        Args: {
          p_tipo: string
          p: Json
        }
        Returns: string
      }
      _crear_documento_no_contable_sin_impuestos: {
        Args: {
          p_tipo: string
          p: Json
        }
        Returns: string
      }
      _crear_factura_proveedor_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_factura_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_gasto_menor_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_nota_credito_compra_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_nota_credito_venta_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_nota_debito_venta_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_orden_compra_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _crear_producto_sin_impuestos: {
        Args: {
          p: Json
        }
        Returns: string
      }
      _cuenta_conciliacion: {
        Args: {
          p_cuenta_id: string
          p_nombre: string
          p_codigo: string
          p_tipo: string
          p_naturaleza: string
          p_padre_codigo: string
        }
        Returns: string
      }
      _cuenta_config: {
        Args: {
          p_clave: string
        }
        Returns: string
      }
      _editar_documento_no_contable: {
        Args: {
          p_tipo: string
          p: Json
        }
        Returns: string
      }
      _editar_documento_no_contable_sin_impuestos: {
        Args: {
          p_tipo: string
          p: Json
        }
        Returns: string
      }
      _guardar_conciliacion_cabecera: {
        Args: {
          p_conciliacion_id: string
          p_cuenta_id: string
          p_desde: string
          p_hasta: string
          p_saldo: number
          p_gastos: number
          p_impuestos: number
          p_entradas: number
          p_cuenta_gastos: string
          p_cuenta_impuestos: string
          p_cuenta_entradas: string
        }
        Returns: string
      }
      _impuesto_id_por_tasa: {
        Args: {
          p_tasa: number
        }
        Returns: string
      }
      _impuestos_actualizar_totales: {
        Args: {
          p_tabla_documento: string
          p_documento_id: string
          p_tabla_lineas: string
          p_clave: string
        }
        Returns: undefined
      }
      _impuestos_dividir_asiento: {
        Args: {
          p_asiento_id: string
          p_cuenta_impuesto: string
          p_tabla_lineas: string
          p_clave: string
          p_documento_id: string
          p_lado: string
          p_etiqueta: string
        }
        Returns: undefined
      }
      _impuestos_preparar: {
        Args: {
          p_lineas: Json
        }
        Returns: Json
      }
      _impuestos_preparar_fuente: {
        Args: {
          p_lineas: Json
          p_tabla: string
          p_clave: string
        }
        Returns: Json
      }
      _impuestos_sincronizar: {
        Args: {
          p_tabla: string
          p_clave: string
          p_documento_id: string
        }
        Returns: undefined
      }
      _mover_existencia: {
        Args: {
          p_producto_id: string
          p_almacen_id: string
          p_cantidad: number
        }
        Returns: undefined
      }
      _resolver_impuesto: {
        Args: {
          p_impuesto_id: string
          p_tasa: number
        }
        Returns: {
          activo: boolean
          codigo: string
          creado_en: string
          cuenta_id: string | null
          id: string
          nombre: string
          orden: number
          tarifa: number
          tipo: string
        }
      }
      _sumar_existencia: {
        Args: {
          p_producto_id: string
          p_almacen_id: string
          p_cantidad: number
        }
        Returns: undefined
      }
      _validar_movimientos_conciliacion: {
        Args: {
          p_cuenta_id: string
          p_desde: string
          p_hasta: string
          p_lineas: string[]
          p_conciliacion_id: string
        }
        Returns: undefined
      }
      _validar_pago_recurrente: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      actualizar_almacen: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_categoria_producto: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_centro_costo: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_contacto: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_cuenta: {
        Args: {
          p: Json
        }
        Returns: string
      }
      actualizar_empresa: {
        Args: {
          p: Json
        }
        Returns: undefined
      }
      actualizar_lista_precio: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_numeracion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      actualizar_pago_recurrente: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_producto: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      actualizar_retencion: {
        Args: {
          p: Json
        }
        Returns: undefined
      }
      actualizar_vendedor: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: string
      }
      anular_documento: {
        Args: {
          p_tipo: string
          p_id: string
        }
        Returns: string
      }
      anular_transferencia_inventario: {
        Args: {
          p_id: string
        }
        Returns: string
      }
      catalogo_saldos: {
        Args: {
          p_hasta?: string
        }
        Returns: {
          cuenta_codigo: string
          saldo: number
        }[]
      }
      cerrar_periodo: {
        Args: {
          p_periodo: string
        }
        Returns: string
      }
      cerrar_resultados_anio: {
        Args: {
          p_anio: number
        }
        Returns: string
      }
      conciliar_cuenta: {
        Args: {
          p: Json
        }
        Returns: string
      }
      convertir_a_factura: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_activo_fijo: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_ajuste_inventario: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_almacen: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_asiento_manual: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_categoria_producto: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_centro_costo: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_contacto: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_cotizacion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_cuenta: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_cuenta_banco: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_factura: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_factura_proveedor: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_factura_recurrente: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_gasto_menor: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_lista_precio: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_nota_credito_compra: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_nota_credito_venta: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_nota_debito_venta: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_orden_compra: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_pago_recurrente: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_producto: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_remision: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_remision_desde_cotizacion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_retencion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_termino_pago: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_transferencia_inventario: {
        Args: {
          p: Json
        }
        Returns: string
      }
      crear_vendedor: {
        Args: {
          p: Json
        }
        Returns: string
      }
      dashboard_resumen: {
        Args: {
          p_desde: string
          p_hasta: string
        }
        Returns: Json
      }
      depreciar_activo: {
        Args: {
          p_activo_id: string
          p_periodo?: string
        }
        Returns: string
      }
      editar_cotizacion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      editar_remision: {
        Args: {
          p: Json
        }
        Returns: string
      }
      generar_factura_recurrente: {
        Args: {
          p_recurrente_id: string
          p_fecha?: string
        }
        Returns: string
      }
      generar_pago_recurrente: {
        Args: {
          p_id: string
        }
        Returns: string
      }
      guardar_borrador_conciliacion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      guardar_plantilla_impresion: {
        Args: {
          p: Json
        }
        Returns: string
      }
      guardar_tasa_cambio: {
        Args: {
          p: Json
        }
        Returns: string
      }
      listar_perfiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          nombre: string
          correo: string
          rol: string
          creado_en: string
        }[]
      }
      listar_retenciones: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          tipo: string
          porcentaje: number
          cuenta_id: string
          cuenta_codigo: string
          cuenta_nombre: string
          cuenta_anticipo_id: string
          cuenta_anticipo_codigo: string
          cuenta_anticipo_nombre: string
          activa: boolean
        }[]
      }
      listar_terminos_pago: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          dias: number
          activo: boolean
        }[]
      }
      reabrir_periodo: {
        Args: {
          p_periodo: string
        }
        Returns: string
      }
      registrar_deposito: {
        Args: {
          p: Json
        }
        Returns: string
      }
      registrar_pago_proveedor: {
        Args: {
          p: Json
        }
        Returns: string
      }
      registrar_pago_proveedor_multi: {
        Args: {
          p_encabezado: Json
          p_aplicaciones: Json
        }
        Returns: string
      }
      registrar_pago_recibido: {
        Args: {
          p: Json
        }
        Returns: string
      }
      registrar_pago_recibido_multi: {
        Args: {
          p_encabezado: Json
          p_aplicaciones: Json
        }
        Returns: string
      }
      registrar_saldos_iniciales: {
        Args: {
          p: Json
        }
        Returns: string
      }
      reporte_balance_comprobacion: {
        Args: {
          p_desde: string
          p_hasta: string
        }
        Returns: {
          cuenta_codigo: string
          cuenta_nombre: string
          tipo: string
          debitos: number
          creditos: number
          saldo: number
        }[]
      }
      reporte_cxc: {
        Args: {
          p_fecha: string
        }
        Returns: {
          contacto_id: string
          contacto_nombre: string
          factura_id: string
          numero: number
          ncf: string
          fecha: string
          vencimiento: string
          total: number
          pagado: number
          saldo: number
          dias_vencida: number
        }[]
      }
      reporte_estado_resultados: {
        Args: {
          p_desde: string
          p_hasta: string
        }
        Returns: {
          tipo: string
          cuenta_codigo: string
          cuenta_nombre: string
          monto: number
        }[]
      }
      reporte_estado_resultados_centro: {
        Args: {
          p_desde: string
          p_hasta: string
          p_centro_costo?: string
        }
        Returns: {
          tipo: string
          cuenta_codigo: string
          cuenta_nombre: string
          monto: number
        }[]
      }
      reporte_libro_diario: {
        Args: {
          p_desde: string
          p_hasta: string
        }
        Returns: {
          asiento_numero: number
          fecha: string
          asiento_descripcion: string
          origen_tipo: string
          cuenta_codigo: string
          cuenta_nombre: string
          debito: number
          credito: number
        }[]
      }
      reporte_movimientos: {
        Args: {
          p_desde: string
          p_hasta: string
          p_cuentas?: string[]
          p_contacto?: string
          p_origenes?: string[]
        }
        Returns: {
          asiento_id: string
          asiento_numero: number
          fecha: string
          estado: string
          origen_tipo: string
          documento: string
          contacto_id: string
          tercero: string
          cuenta_id: string
          cuenta_codigo: string
          cuenta_nombre: string
          cuenta_naturaleza: string
          debito: number
          credito: number
        }[]
      }
      reporte_saldos_cuentas: {
        Args: {
          p_desde: string
          p_hasta: string
          p_cierre_anual?: boolean
          p_cuentas?: string[]
        }
        Returns: {
          cuenta_id: string
          cuenta_codigo: string
          cuenta_nombre: string
          cuenta_tipo: string
          cuenta_naturaleza: string
          padre_id: string
          saldo_inicial: number
          debitos: number
          creditos: number
        }[]
      }
      reporte_saldos_tercero: {
        Args: {
          p_desde: string
          p_hasta: string
          p_cuentas?: string[]
          p_contacto?: string
          p_incluir_cero?: boolean
        }
        Returns: {
          cuenta_id: string
          cuenta_codigo: string
          cuenta_nombre: string
          cuenta_tipo: string
          cuenta_naturaleza: string
          contacto_id: string
          tercero: string
          saldo_inicial: number
          debitos: number
          creditos: number
        }[]
      }
      rol_actual: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      saldos_caja_banco: {
        Args: {
          p_fecha?: string
        }
        Returns: {
          cuenta_id: string
          codigo: string
          nombre: string
          saldo: number
        }[]
      }
      transferir_entre_cuentas: {
        Args: {
          p: Json
        }
        Returns: string
      }
      vincular_orden_compra: {
        Args: {
          p_orden_id: string
          p_factura_proveedor_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
