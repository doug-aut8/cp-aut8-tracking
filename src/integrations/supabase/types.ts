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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          columns_mobile: number | null
          created_at: string
          id: string
          is_popular_category: boolean
          name: string
          order: number
          show_in_category_nav: boolean
          updated_at: string
          visible: boolean
        }
        Insert: {
          columns_mobile?: number | null
          created_at?: string
          id: string
          is_popular_category?: boolean
          name: string
          order?: number
          show_in_category_nav?: boolean
          updated_at?: string
          visible?: boolean
        }
        Update: {
          columns_mobile?: number | null
          created_at?: string
          id?: string
          is_popular_category?: boolean
          name?: string
          order?: number
          show_in_category_nav?: boolean
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      ceps_especiais: {
        Row: {
          cep: string | null
          created_at: string
          id: number
          valor: number | null
        }
        Insert: {
          cep?: string | null
          created_at?: string
          id?: number
          valor?: number | null
        }
        Update: {
          cep?: string | null
          created_at?: string
          id?: number
          valor?: number | null
        }
        Relationships: []
      }
      checkout_events: {
        Row: {
          cart_total: number | null
          created_at: string
          cupom_id: string | null
          cupom_name: string | null
          discount_value: number | null
          event_type: string
          id: string
          session_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          cart_total?: number | null
          created_at?: string
          cupom_id?: string | null
          cupom_name?: string | null
          discount_value?: number | null
          event_type: string
          id?: string
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          cart_total?: number | null
          created_at?: string
          cupom_id?: string | null
          cupom_name?: string | null
          discount_value?: number | null
          event_type?: string
          id?: string
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_checkout_events_cupom"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string | null
          empresa_id: string | null
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      cupons: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          limite_uso: number | null
          nome: string
          origem: string | null
          primeira_compra_apenas: boolean
          produto_brinde: Json | null
          produtos_requeridos: Json | null
          tipo: string
          usos: number | null
          usos_por_usuario: number | null
          valor: number
          valor_minimo_pedido: number | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          limite_uso?: number | null
          nome: string
          origem?: string | null
          primeira_compra_apenas?: boolean
          produto_brinde?: Json | null
          produtos_requeridos?: Json | null
          tipo: string
          usos?: number | null
          usos_por_usuario?: number | null
          valor: number
          valor_minimo_pedido?: number | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          limite_uso?: number | null
          nome?: string
          origem?: string | null
          primeira_compra_apenas?: boolean
          produto_brinde?: Json | null
          produtos_requeridos?: Json | null
          tipo?: string
          usos?: number | null
          usos_por_usuario?: number | null
          valor?: number
          valor_minimo_pedido?: number | null
        }
        Relationships: []
      }
      cupons_usos: {
        Row: {
          cupom_id: string | null
          data_uso: string | null
          id: string
          pedido_id: string | null
          user_id: string | null
        }
        Insert: {
          cupom_id?: string | null
          data_uso?: string | null
          id?: string
          pedido_id?: string | null
          user_id?: string | null
        }
        Update: {
          cupom_id?: string | null
          data_uso?: string | null
          id?: string
          pedido_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_usos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_usos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_data: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          id: string
          name: string
          neighborhood: string | null
          number: string | null
          phone: string
          state: string | null
          street: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          name: string
          neighborhood?: string | null
          number?: string | null
          phone: string
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          id?: string
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      empresa_info: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string | null
          default_altura_cm: number | null
          default_comprimento_cm: number | null
          default_largura_cm: number | null
          default_peso_g: number | null
          endereco: string | null
          estado: string | null
          horarios_funcionamento: Json
          id: string
          modelo_frete: string | null
          nome: string
          numero: string | null
          pais: string | null
          rua: string | null
          sobre: string | null
          superfrete_sandbox: boolean
          superfrete_servicos: Json
          superfrete_token: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          default_altura_cm?: number | null
          default_comprimento_cm?: number | null
          default_largura_cm?: number | null
          default_peso_g?: number | null
          endereco?: string | null
          estado?: string | null
          horarios_funcionamento?: Json
          id?: string
          modelo_frete?: string | null
          nome: string
          numero?: string | null
          pais?: string | null
          rua?: string | null
          sobre?: string | null
          superfrete_sandbox?: boolean
          superfrete_servicos?: Json
          superfrete_token?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          default_altura_cm?: number | null
          default_comprimento_cm?: number | null
          default_largura_cm?: number | null
          default_peso_g?: number | null
          endereco?: string | null
          estado?: string | null
          horarios_funcionamento?: Json
          id?: string
          modelo_frete?: string | null
          nome?: string
          numero?: string | null
          pais?: string | null
          rua?: string | null
          sobre?: string | null
          superfrete_sandbox?: boolean
          superfrete_servicos?: Json
          superfrete_token?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      faixas_frete: {
        Row: {
          created_at: string | null
          id: string
          km_final: number
          km_inicial: number
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          km_final: number
          km_inicial: number
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          id?: string
          km_final?: number
          km_inicial?: number
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      fidelidade_historico: {
        Row: {
          cupom_codigo: string | null
          data: string | null
          id: string
          nome_cliente: string | null
          observacao: string | null
          premio_concedido: boolean | null
          premio_descricao: string | null
          regra_id: string | null
          resgatado: boolean
          telefone_cliente: string | null
          user_id: string | null
        }
        Insert: {
          cupom_codigo?: string | null
          data?: string | null
          id?: string
          nome_cliente?: string | null
          observacao?: string | null
          premio_concedido?: boolean | null
          premio_descricao?: string | null
          regra_id?: string | null
          resgatado?: boolean
          telefone_cliente?: string | null
          user_id?: string | null
        }
        Update: {
          cupom_codigo?: string | null
          data?: string | null
          id?: string
          nome_cliente?: string | null
          observacao?: string | null
          premio_concedido?: boolean | null
          premio_descricao?: string | null
          regra_id?: string | null
          resgatado?: boolean
          telefone_cliente?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_historico_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_progresso: {
        Row: {
          contagem_pizzas: number
          criado_em: string | null
          eventos: Json
          id: string
          nome_cliente: string | null
          regra_id: string | null
          telefone_cliente: string
          ultima_atualizacao: string | null
          user_id: string | null
          valor_gasto_pizzas: number
        }
        Insert: {
          contagem_pizzas?: number
          criado_em?: string | null
          eventos?: Json
          id?: string
          nome_cliente?: string | null
          regra_id?: string | null
          telefone_cliente: string
          ultima_atualizacao?: string | null
          user_id?: string | null
          valor_gasto_pizzas?: number
        }
        Update: {
          contagem_pizzas?: number
          criado_em?: string | null
          eventos?: Json
          id?: string
          nome_cliente?: string | null
          regra_id?: string | null
          telefone_cliente?: string
          ultima_atualizacao?: string | null
          user_id?: string | null
          valor_gasto_pizzas?: number
        }
        Relationships: []
      }
      fidelidade_regras: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          criterio: string | null
          descricao: string | null
          id: string
          meta: number | null
          nome: string
          premio_cupom_tipo: string | null
          premio_cupom_valor: number | null
          premio_id: string | null
          premio_produto: Json | null
          premio_tipo: string
          premio_validade_dias: number
          produto_requerido: Json | null
          quantidade_necessaria: number
          validade_dias: number
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          criterio?: string | null
          descricao?: string | null
          id?: string
          meta?: number | null
          nome: string
          premio_cupom_tipo?: string | null
          premio_cupom_valor?: number | null
          premio_id?: string | null
          premio_produto?: Json | null
          premio_tipo: string
          premio_validade_dias?: number
          produto_requerido?: Json | null
          quantidade_necessaria?: number
          validade_dias?: number
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          criterio?: string | null
          descricao?: string | null
          id?: string
          meta?: number | null
          nome?: string
          premio_cupom_tipo?: string | null
          premio_cupom_valor?: number | null
          premio_id?: string | null
          premio_produto?: Json | null
          premio_tipo?: string
          premio_validade_dias?: number
          produto_requerido?: Json | null
          quantidade_necessaria?: number
          validade_dias?: number
        }
        Relationships: []
      }
      ga4_snapshots: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          report_type: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          id?: string
          report_type: string
          snapshot_date: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          report_type?: string
          snapshot_date?: string
        }
        Relationships: []
      }
      keep_alive: {
        Row: {
          check: string | null
          created_at: string
          id: number
        }
        Insert: {
          check?: string | null
          created_at?: string
          id?: number
        }
        Update: {
          check?: string | null
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          additional_categories: string[] | null
          available: boolean | null
          borders_position: number | null
          category: string
          combination: Json | null
          cost: number | null
          created_at: string
          deeplink: string | null
          description: string
          display_order: number
          frete_gratis: boolean | null
          has_variations: boolean | null
          height_cm: number | null
          hidden_in_menu: boolean
          id: string
          image: string
          is_half_pizza: boolean | null
          length_cm: number | null
          max_sabores: number | null
          name: string
          permite_combinacao: boolean | null
          pizza_borders: Json | null
          pizza_sizes: Json
          popular: boolean | null
          price: number
          price_from: boolean | null
          sku: string | null
          stock: number | null
          submenu_description: string | null
          submenu_item_ids: string[]
          submenu_name: string | null
          tipo: string | null
          updated_at: string
          variation_groups: Json | null
          weight_g: number | null
          width_cm: number | null
        }
        Insert: {
          additional_categories?: string[] | null
          available?: boolean | null
          borders_position?: number | null
          category: string
          combination?: Json | null
          cost?: number | null
          created_at?: string
          deeplink?: string | null
          description?: string
          display_order?: number
          frete_gratis?: boolean | null
          has_variations?: boolean | null
          height_cm?: number | null
          hidden_in_menu?: boolean
          id: string
          image?: string
          is_half_pizza?: boolean | null
          length_cm?: number | null
          max_sabores?: number | null
          name: string
          permite_combinacao?: boolean | null
          pizza_borders?: Json | null
          pizza_sizes?: Json
          popular?: boolean | null
          price?: number
          price_from?: boolean | null
          sku?: string | null
          stock?: number | null
          submenu_description?: string | null
          submenu_item_ids?: string[]
          submenu_name?: string | null
          tipo?: string | null
          updated_at?: string
          variation_groups?: Json | null
          weight_g?: number | null
          width_cm?: number | null
        }
        Update: {
          additional_categories?: string[] | null
          available?: boolean | null
          borders_position?: number | null
          category?: string
          combination?: Json | null
          cost?: number | null
          created_at?: string
          deeplink?: string | null
          description?: string
          display_order?: number
          frete_gratis?: boolean | null
          has_variations?: boolean | null
          height_cm?: number | null
          hidden_in_menu?: boolean
          id?: string
          image?: string
          is_half_pizza?: boolean | null
          length_cm?: number | null
          max_sabores?: number | null
          name?: string
          permite_combinacao?: boolean | null
          pizza_borders?: Json | null
          pizza_sizes?: Json
          popular?: boolean | null
          price?: number
          price_from?: boolean | null
          sku?: string | null
          stock?: number | null
          submenu_description?: string | null
          submenu_item_ids?: string[]
          submenu_name?: string | null
          tipo?: string | null
          updated_at?: string
          variation_groups?: Json | null
          weight_g?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      pedidos_sabor_delivery: {
        Row: {
          atualizado_em: string | null
          atualizado_em_banco: string | null
          bairro: string | null
          cidade: string | null
          codigo_curto: string | null
          codigo_pedido: string | null
          criado_em: string | null
          cupom_desconto: string | null
          data_criacao: string | null
          desconto: number | null
          endereco_entrega: string | null
          firebase_id: string | null
          frete: number | null
          horario_recebido: string | null
          id: string
          itens: Json | null
          metodo_pagamento: string | null
          motivo_cancelamento: string | null
          nome_cliente: string | null
          observacoes: string | null
          origem: string | null
          payment_status: string | null
          status_atual: string | null
          subtotal: number | null
          telefone_cliente: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_total: number | null
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_em_banco?: string | null
          bairro?: string | null
          cidade?: string | null
          codigo_curto?: string | null
          codigo_pedido?: string | null
          criado_em?: string | null
          cupom_desconto?: string | null
          data_criacao?: string | null
          desconto?: number | null
          endereco_entrega?: string | null
          firebase_id?: string | null
          frete?: number | null
          horario_recebido?: string | null
          id?: string
          itens?: Json | null
          metodo_pagamento?: string | null
          motivo_cancelamento?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          origem?: string | null
          payment_status?: string | null
          status_atual?: string | null
          subtotal?: number | null
          telefone_cliente?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_total?: number | null
        }
        Update: {
          atualizado_em?: string | null
          atualizado_em_banco?: string | null
          bairro?: string | null
          cidade?: string | null
          codigo_curto?: string | null
          codigo_pedido?: string | null
          criado_em?: string | null
          cupom_desconto?: string | null
          data_criacao?: string | null
          desconto?: number | null
          endereco_entrega?: string | null
          firebase_id?: string | null
          frete?: number | null
          horario_recebido?: string | null
          id?: string
          itens?: Json | null
          metodo_pagamento?: string | null
          motivo_cancelamento?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          origem?: string | null
          payment_status?: string | null
          status_atual?: string | null
          subtotal?: number | null
          telefone_cliente?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      pizza_borders: {
        Row: {
          additional_price: number
          available: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          additional_price?: number
          available?: boolean
          created_at?: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          additional_price?: number
          available?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          category: string | null
          created_at: string
          event_type: string
          id: string
          price: number | null
          product_id: string
          product_name: string
          quantity: number | null
          session_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          event_type: string
          id?: string
          price?: number | null
          product_id: string
          product_name: string
          quantity?: number | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          event_type?: string
          id?: string
          price?: number | null
          product_id?: string
          product_name?: string
          quantity?: number | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags_rastreamento: {
        Row: {
          capi_ativo: boolean
          gtm_container_id: string | null
          id: number
          meta_access_token: string | null
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          updated_at: string | null
        }
        Insert: {
          capi_ativo?: boolean
          gtm_container_id?: string | null
          id?: number
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          updated_at?: string | null
        }
        Update: {
          capi_ativo?: boolean
          gtm_container_id?: string | null
          id?: number
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string
          email: string | null
          firebase_id: string | null
          first_utm_campaign: string | null
          first_utm_source: string | null
          id: string
          last_sign_in_at: string | null
          name: string | null
          numero: string | null
          phone: string | null
          role: string | null
          rua: string | null
          user_id: string | null
          whatsapp_auth_code: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at: string
          email?: string | null
          firebase_id?: string | null
          first_utm_campaign?: string | null
          first_utm_source?: string | null
          id?: string
          last_sign_in_at?: string | null
          name?: string | null
          numero?: string | null
          phone?: string | null
          role?: string | null
          rua?: string | null
          user_id?: string | null
          whatsapp_auth_code?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          firebase_id?: string | null
          first_utm_campaign?: string | null
          first_utm_source?: string | null
          id?: string
          last_sign_in_at?: string | null
          name?: string | null
          numero?: string | null
          phone?: string | null
          role?: string | null
          rua?: string | null
          user_id?: string | null
          whatsapp_auth_code?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          created_at: string | null
          email: string
          empresa: string | null
          firebase_id: string | null
          id: string
          role: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          empresa?: string | null
          firebase_id?: string | null
          id?: string
          role?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          empresa?: string | null
          firebase_id?: string | null
          id?: string
          role?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      variation_groups: {
        Row: {
          allow_per_half: boolean | null
          apply_to_half_pizza: boolean | null
          collapsible: boolean
          created_at: string
          custom_message: string | null
          hide_main_quantity_selector: boolean
          id: string
          internal_name: string | null
          max_allowed: number
          min_required: number
          name: string
          updated_at: string
          variations: string[]
        }
        Insert: {
          allow_per_half?: boolean | null
          apply_to_half_pizza?: boolean | null
          collapsible?: boolean
          created_at?: string
          custom_message?: string | null
          hide_main_quantity_selector?: boolean
          id: string
          internal_name?: string | null
          max_allowed?: number
          min_required?: number
          name: string
          updated_at?: string
          variations?: string[]
        }
        Update: {
          allow_per_half?: boolean | null
          apply_to_half_pizza?: boolean | null
          collapsible?: boolean
          created_at?: string
          custom_message?: string | null
          hide_main_quantity_selector?: boolean
          id?: string
          internal_name?: string | null
          max_allowed?: number
          min_required?: number
          name?: string
          updated_at?: string
          variations?: string[]
        }
        Relationships: []
      }
      variations: {
        Row: {
          additional_price: number
          available: boolean
          category_ids: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          additional_price?: number
          available?: boolean
          category_ids?: string[]
          created_at?: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          additional_price?: number
          available?: boolean
          category_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      tags_rastreamento_public: {
        Row: {
          capi_ativo: boolean | null
          gtm_container_id: string | null
          id: number | null
          meta_pixel_id: string | null
          updated_at: string | null
        }
        Insert: {
          capi_ativo?: boolean | null
          gtm_container_id?: string | null
          id?: number | null
          meta_pixel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          capi_ativo?: boolean | null
          gtm_container_id?: string | null
          id?: number | null
          meta_pixel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_phones: { Args: never; Returns: string[] }
      decrement_menu_item_stock: {
        Args: { _item_id: string; _qty: number }
        Returns: undefined
      }
      execute_cron_update: {
        Args: {
          anon_key: string
          cron_expression: string
          function_url: string
        }
        Returns: undefined
      }
      get_ltv_by_utm_campaign: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_ltv: number
          customer_count: number
          total_revenue: number
          utm_campaign: string
        }[]
      }
      get_ltv_by_utm_source: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_ltv: number
          customer_count: number
          total_revenue: number
          utm_source: string
        }[]
      }
      get_user_role:
        | {
            Args: { user_uid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_user_role(user_uid => text), public.get_user_role(user_uid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { user_uid: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_user_role(user_uid => text), public.get_user_role(user_uid => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super-admin"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "super-admin"],
    },
  },
} as const
