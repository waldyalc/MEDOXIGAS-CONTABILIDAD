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
      asiento_lineas: {
        Row: {
          asiento_id: string
          contacto_id: string | null
          credito: number
          cuenta_id: string
          debito: number
          descripcion: string | null
          id: string
        }
        Insert: {
          asiento_id: string
          contacto_id?: string | null
          credito?: number
          cuenta_id: string
          debito?: number
          descripcion?: string | null
          id?: string
        }
        Update: {
          asiento_id?: string
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
          nombre: string
          rnc_cedula: string | null
          telefono: string | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          cuenta_cxc_id?: string | null
          cuenta_cxp_id?: string | null
          direccion?: string | null
          id?: string
          nombre: string
          rnc_cedula?: string | null
          telefono?: string | null
          tipo?: string
        }
        Update: {
          activo?: boolean
          correo?: string | null
          creado_en?: string
          cuenta_cxc_id?: string | null
          cuenta_cxp_id?: string | null
          direccion?: string | null
          id?: string
          nombre?: string
          rnc_cedula?: string | null
          telefono?: string | null
          tipo?: string
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
        ]
      }
      cotizacion_lineas: {
        Row: {
          cantidad: number
          cotizacion_id: string
          descripcion: string
          descuento_pct: number
          id: string
          itbis: number
          itbis_tasa: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis?: number
          itbis_tasa?: number
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
          subtotal: number
          total: number
          vencimiento: string
        }
        Insert: {
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
          subtotal?: number
          total?: number
          vencimiento: string
        }
        Update: {
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
          subtotal?: number
          total?: number
          vencimiento?: string
        }
        Relationships: [
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
      factura_lineas: {
        Row: {
          cantidad: number
          costo_unitario: number
          descripcion: string
          descuento_pct: number
          factura_id: string
          id: string
          itbis: number
          itbis_tasa: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis_tasa?: number
          precio?: number
          producto_id?: string | null
          recurrente_id?: string
        }
        Relationships: [
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
          asiento_id: string | null
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
          pagado: number
          pie: string | null
          subtotal: number
          terminos: string | null
          tipo_comprobante: string
          total: number
          vencimiento: string
        }
        Insert: {
          asiento_id?: string | null
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
          pagado?: number
          pie?: string | null
          subtotal?: number
          terminos?: string | null
          tipo_comprobante: string
          total?: number
          vencimiento: string
        }
        Update: {
          asiento_id?: string | null
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
          pagado?: number
          pie?: string | null
          subtotal?: number
          terminos?: string | null
          tipo_comprobante?: string
          total?: number
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas_proveedor: {
        Row: {
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          estado: string
          fecha: string
          id: string
          itbis: number
          ncf: string | null
          notas: string | null
          numero: number
          pagado: number
          subtotal: number
          total: number
          vencimiento: string
        }
        Insert: {
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          pagado?: number
          subtotal?: number
          total?: number
          vencimiento: string
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          fecha?: string
          id?: string
          itbis?: number
          ncf?: string | null
          notas?: string | null
          numero?: number
          pagado?: number
          subtotal?: number
          total?: number
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_proveedor_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
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
          itbis: number
          itbis_tasa: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis: number
          itbis_tasa: number
          ncf: string | null
          numero: number
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
          itbis?: number
          itbis_tasa?: number
          ncf?: string | null
          numero?: number
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
          itbis?: number
          itbis_tasa?: number
          ncf?: string | null
          numero?: number
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
          itbis: number
          itbis_tasa: number
          nota_id: string
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
          itbis?: number
          itbis_tasa?: number
          nota_id: string
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
          itbis?: number
          itbis_tasa?: number
          nota_id?: string
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
          itbis: number
          itbis_tasa: number
          nota_id: string
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
          itbis?: number
          itbis_tasa?: number
          nota_id: string
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
          itbis?: number
          itbis_tasa?: number
          nota_id?: string
          precio?: number
          producto_id?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
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
      notas_credito_venta: {
        Row: {
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
          subtotal: number
          total: number
        }
        Insert: {
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
          subtotal?: number
          total?: number
        }
        Update: {
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
          subtotal?: number
          total?: number
        }
        Relationships: [
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
      pagos_proveedor: {
        Row: {
          asiento_id: string | null
          contacto_id: string
          creado_en: string
          creado_por: string | null
          cuenta_id: string
          estado: string
          factura_proveedor_id: string
          fecha: string
          id: string
          metodo: string
          monto: number
          notas: string | null
          numero: number
        }
        Insert: {
          asiento_id?: string | null
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id: string
          estado?: string
          factura_proveedor_id: string
          fecha?: string
          id?: string
          metodo?: string
          monto: number
          notas?: string | null
          numero?: number
        }
        Update: {
          asiento_id?: string | null
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          cuenta_id?: string
          estado?: string
          factura_proveedor_id?: string
          fecha?: string
          id?: string
          metodo?: string
          monto?: number
          notas?: string | null
          numero?: number
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
      productos: {
        Row: {
          activo: boolean
          cantidad: number
          costo: number
          creado_en: string
          cuenta_costo_id: string | null
          cuenta_ingreso_id: string | null
          cuenta_inventario_id: string | null
          descripcion: string | null
          id: string
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
          costo?: number
          creado_en?: string
          cuenta_costo_id?: string | null
          cuenta_ingreso_id?: string | null
          cuenta_inventario_id?: string | null
          descripcion?: string | null
          id?: string
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
          costo?: number
          creado_en?: string
          cuenta_costo_id?: string | null
          cuenta_ingreso_id?: string | null
          cuenta_inventario_id?: string | null
          descripcion?: string | null
          id?: string
          inventariable?: boolean
          itbis_tasa?: number
          nombre?: string
          precio?: number
          referencia?: string | null
          tipo?: string
        }
        Relationships: [
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
        ]
      }
      remision_lineas: {
        Row: {
          cantidad: number
          descripcion: string
          descuento_pct: number
          id: string
          itbis: number
          itbis_tasa: number
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
          itbis?: number
          itbis_tasa?: number
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
          itbis?: number
          itbis_tasa?: number
          precio?: number
          producto_id?: string | null
          remision_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
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
          contacto_id: string
          creado_en: string
          creado_por: string | null
          estado: string
          factura_id: string | null
          fecha: string
          id: string
          itbis: number
          notas: string | null
          numero: number
          subtotal: number
          total: number
          vencimiento: string
        }
        Insert: {
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          subtotal?: number
          total?: number
          vencimiento: string
        }
        Update: {
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          estado?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          itbis?: number
          notas?: string | null
          numero?: number
          subtotal?: number
          total?: number
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "remisiones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remisiones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _crear_asiento: {
        Args: {
          p_descripcion: string
          p_fecha: string
          p_lineas: Json
          p_origen_id: string
          p_origen_tipo: string
        }
        Returns: string
      }
      _crear_documento_no_contable: {
        Args: { p: Json; p_tipo: string }
        Returns: string
      }
      _cuenta_config: { Args: { p_clave: string }; Returns: string }
      actualizar_contacto: { Args: { p: Json; p_id: string }; Returns: string }
      actualizar_cuenta: { Args: { p: Json }; Returns: string }
      actualizar_numeracion: { Args: { p: Json }; Returns: string }
      actualizar_producto: { Args: { p: Json; p_id: string }; Returns: string }
      anular_documento: {
        Args: { p_id: string; p_tipo: string }
        Returns: string
      }
      convertir_a_factura: { Args: { p: Json }; Returns: string }
      crear_asiento_manual: { Args: { p: Json }; Returns: string }
      crear_contacto: { Args: { p: Json }; Returns: string }
      crear_cotizacion: { Args: { p: Json }; Returns: string }
      crear_cuenta: { Args: { p: Json }; Returns: string }
      crear_cuenta_banco: { Args: { p: Json }; Returns: string }
      crear_factura: { Args: { p: Json }; Returns: string }
      crear_factura_proveedor: { Args: { p: Json }; Returns: string }
      crear_factura_recurrente: { Args: { p: Json }; Returns: string }
      crear_gasto_menor: { Args: { p: Json }; Returns: string }
      crear_nota_credito_venta: { Args: { p: Json }; Returns: string }
      crear_nota_debito_venta: { Args: { p: Json }; Returns: string }
      crear_producto: { Args: { p: Json }; Returns: string }
      crear_remision: { Args: { p: Json }; Returns: string }
      generar_factura_recurrente: {
        Args: { p_fecha?: string; p_recurrente_id: string }
        Returns: string
      }
      registrar_deposito: { Args: { p: Json }; Returns: string }
      registrar_pago_proveedor: { Args: { p: Json }; Returns: string }
      registrar_pago_recibido: { Args: { p: Json }; Returns: string }
      reporte_balance_comprobacion: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          creditos: number
          cuenta_codigo: string
          cuenta_nombre: string
          debitos: number
          saldo: number
          tipo: string
        }[]
      }
      reporte_cxc: {
        Args: { p_fecha: string }
        Returns: {
          contacto_id: string
          contacto_nombre: string
          dias_vencida: number
          factura_id: string
          fecha: string
          ncf: string
          numero: number
          pagado: number
          saldo: number
          total: number
          vencimiento: string
        }[]
      }
      reporte_estado_resultados: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          cuenta_codigo: string
          cuenta_nombre: string
          monto: number
          tipo: string
        }[]
      }
      reporte_libro_diario: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          asiento_descripcion: string
          asiento_numero: number
          credito: number
          cuenta_codigo: string
          cuenta_nombre: string
          debito: number
          fecha: string
          origen_tipo: string
        }[]
      }
      reporte_movimientos: {
        Args: {
          p_contacto?: string
          p_cuentas?: string[]
          p_desde: string
          p_hasta: string
          p_origenes?: string[]
        }
        Returns: {
          asiento_id: string
          asiento_numero: number
          contacto_id: string
          credito: number
          cuenta_codigo: string
          cuenta_id: string
          cuenta_naturaleza: string
          cuenta_nombre: string
          debito: number
          documento: string
          estado: string
          fecha: string
          origen_tipo: string
          tercero: string
        }[]
      }
      reporte_saldos_cuentas: {
        Args: {
          p_cierre_anual?: boolean
          p_cuentas?: string[]
          p_desde: string
          p_hasta: string
        }
        Returns: {
          creditos: number
          cuenta_codigo: string
          cuenta_id: string
          cuenta_naturaleza: string
          cuenta_nombre: string
          cuenta_tipo: string
          debitos: number
          padre_id: string
          saldo_inicial: number
        }[]
      }
      reporte_saldos_tercero: {
        Args: {
          p_contacto?: string
          p_cuentas?: string[]
          p_desde: string
          p_hasta: string
          p_incluir_cero?: boolean
        }
        Returns: {
          contacto_id: string
          creditos: number
          cuenta_codigo: string
          cuenta_id: string
          cuenta_naturaleza: string
          cuenta_nombre: string
          cuenta_tipo: string
          debitos: number
          saldo_inicial: number
          tercero: string
        }[]
      }
      rol_actual: { Args: never; Returns: string }
      saldos_caja_banco: {
        Args: { p_fecha?: string }
        Returns: {
          codigo: string
          cuenta_id: string
          nombre: string
          saldo: number
        }[]
      }
      transferir_entre_cuentas: { Args: { p: Json }; Returns: string }
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
