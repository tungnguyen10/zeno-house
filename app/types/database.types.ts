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
      ai_action_plans: {
        Row: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }
        Insert: {
          action_type: string
          building_id?: string | null
          confirmed_at?: string | null
          conversation_id: string
          created_at?: string
          error?: Json | null
          executed_at?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string
          normalized_payload: Json
          payload_hash: string
          preview?: Json
          resource_versions?: Json
          result?: Json | null
          status?: string
          summary: string
          title: string
          updated_at?: string
          user_id: string
          warnings?: Json
        }
        Update: {
          action_type?: string
          building_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string
          created_at?: string
          error?: Json | null
          executed_at?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string
          normalized_payload?: Json
          payload_hash?: string
          preview?: Json
          resource_versions?: Json
          result?: Json | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_plans_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_plans_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limit_buckets: {
        Row: {
          expires_at: string
          request_count: number
          scope: string
          subject_hash: string
          window_started: string
        }
        Insert: {
          expires_at: string
          request_count?: number
          scope: string
          subject_hash: string
          window_started: string
        }
        Update: {
          expires_at?: string
          request_count?: number
          scope?: string
          subject_hash?: string
          window_started?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          building_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          building_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          building_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          billing_period_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          billing_period_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          billing_period_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "billing_audit_events_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          building_id: string
          closed_at: string | null
          created_at: string
          id: string
          issued_at: string | null
          opened_by: string | null
          period_month: number
          period_year: number
          status: string
          updated_at: string
        }
        Insert: {
          building_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          opened_by?: string | null
          period_month: number
          period_year: number
          status?: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          opened_by?: string | null
          period_month?: number
          period_year?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_utility_usages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billable_usage: number
          billing_period_id: string
          created_at: string
          created_by: string | null
          current_reading_id: string | null
          current_reading_value: number
          id: string
          meter_type: string
          new_meter_start_value: number | null
          note: string | null
          old_meter_final_value: number | null
          previous_reading_id: string | null
          previous_reading_value: number
          reason: string
          room_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billable_usage: number
          billing_period_id: string
          created_at?: string
          created_by?: string | null
          current_reading_id?: string | null
          current_reading_value: number
          id?: string
          meter_type: string
          new_meter_start_value?: number | null
          note?: string | null
          old_meter_final_value?: number | null
          previous_reading_id?: string | null
          previous_reading_value: number
          reason?: string
          room_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billable_usage?: number
          billing_period_id?: string
          created_at?: string
          created_by?: string | null
          current_reading_id?: string | null
          current_reading_value?: number
          id?: string
          meter_type?: string
          new_meter_start_value?: number | null
          note?: string | null
          old_meter_final_value?: number | null
          previous_reading_id?: string | null
          previous_reading_value?: number
          reason?: string
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_utility_usages_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_utility_usages_current_reading_id_fkey"
            columns: ["current_reading_id"]
            isOneToOne: false
            referencedRelation: "meter_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_utility_usages_previous_reading_id_fkey"
            columns: ["previous_reading_id"]
            isOneToOne: false
            referencedRelation: "meter_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_utility_usages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      building_expenses: {
        Row: {
          amount: number
          building_id: string
          category: string
          created_at: string
          created_by: string | null
          expense_date: string | null
          funded_by: string
          id: string
          note: string | null
          payee: string | null
          payment_method: string | null
          period_month: number
          period_year: number
          receipt_url: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          building_id: string
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string | null
          funded_by?: string
          id?: string
          note?: string | null
          payee?: string | null
          payment_method?: string | null
          period_month: number
          period_year: number
          receipt_url?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          building_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string | null
          funded_by?: string
          id?: string
          note?: string | null
          payee?: string | null
          payment_method?: string | null
          period_month?: number
          period_year?: number
          receipt_url?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_fixed_costs: {
        Row: {
          amount: number
          building_id: string
          category: string
          created_at: string
          created_by: string | null
          effective_from_period_month: number
          effective_from_period_year: number
          effective_to_period_month: number | null
          effective_to_period_year: number | null
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          building_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          effective_from_period_month: number
          effective_from_period_year: number
          effective_to_period_month?: number | null
          effective_to_period_year?: number | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          building_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          effective_from_period_month?: number
          effective_from_period_year?: number
          effective_to_period_month?: number | null
          effective_to_period_year?: number | null
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_fixed_costs_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_reserve_fund_rates: {
        Row: {
          building_id: string
          created_at: string
          created_by: string | null
          effective_from_period_month: number
          effective_from_period_year: number
          effective_to_period_month: number | null
          effective_to_period_year: number | null
          id: string
          reserve_rate_percent: number
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          created_by?: string | null
          effective_from_period_month: number
          effective_from_period_year: number
          effective_to_period_month?: number | null
          effective_to_period_year?: number | null
          id?: string
          reserve_rate_percent: number
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          created_by?: string | null
          effective_from_period_month?: number
          effective_from_period_year?: number
          effective_to_period_month?: number | null
          effective_to_period_year?: number | null
          id?: string
          reserve_rate_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_reserve_fund_rates_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      building_services: {
        Row: {
          building_id: string
          catalog_id: string
          created_at: string | null
          default_amount: number
          id: string
          is_active: boolean
          pricing_type: string | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          building_id: string
          catalog_id: string
          created_at?: string | null
          default_amount?: number
          id?: string
          is_active?: boolean
          pricing_type?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          building_id?: string
          catalog_id?: string
          created_at?: string | null
          default_amount?: number
          id?: string
          is_active?: boolean
          pricing_type?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "building_services_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_services_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string
          billing_generation_day: number | null
          code: string
          created_at: string
          created_by: string | null
          default_electricity_rate: number | null
          default_water_rate: number | null
          description: string | null
          electricity_pricing_type: string
          grace_period_days: number
          id: string
          meter_reading_day: number | null
          name: string
          operational_start_month: number | null
          operational_start_year: number | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_user_id: string | null
          payment_due_day: number | null
          reserve_fund_rate_percent: number | null
          slug: string
          status: string
          updated_at: string
          water_pricing_type: string
        }
        Insert: {
          address: string
          billing_generation_day?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          default_electricity_rate?: number | null
          default_water_rate?: number | null
          description?: string | null
          electricity_pricing_type?: string
          grace_period_days?: number
          id?: string
          meter_reading_day?: number | null
          name: string
          operational_start_month?: number | null
          operational_start_year?: number | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_user_id?: string | null
          payment_due_day?: number | null
          reserve_fund_rate_percent?: number | null
          slug: string
          status?: string
          updated_at?: string
          water_pricing_type?: string
        }
        Update: {
          address?: string
          billing_generation_day?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          default_electricity_rate?: number | null
          default_water_rate?: number | null
          description?: string | null
          electricity_pricing_type?: string
          grace_period_days?: number
          id?: string
          meter_reading_day?: number | null
          name?: string
          operational_start_month?: number | null
          operational_start_year?: number | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_user_id?: string | null
          payment_due_day?: number | null
          reserve_fund_rate_percent?: number | null
          slug?: string
          status?: string
          updated_at?: string
          water_pricing_type?: string
        }
        Relationships: []
      }
      contract_occupants: {
        Row: {
          billing_counted: boolean
          contract_id: string
          created_at: string
          id: string
          move_in_date: string
          move_out_date: string | null
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_counted?: boolean
          contract_id: string
          created_at?: string
          id?: string
          move_in_date: string
          move_out_date?: string | null
          role?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_counted?: boolean
          contract_id?: string
          created_at?: string
          id?: string
          move_in_date?: string
          move_out_date?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_occupants_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_occupants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_payments: {
        Row: {
          amount: number
          contract_id: string
          covered_period_end: string | null
          covered_period_start: string | null
          created_at: string
          id: string
          note: string | null
          paid_at: string
          payment_method: string | null
          payment_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          covered_period_end?: string | null
          covered_period_start?: string | null
          created_at?: string
          id?: string
          note?: string | null
          paid_at: string
          payment_method?: string | null
          payment_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          covered_period_end?: string | null
          covered_period_start?: string | null
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          payment_method?: string | null
          payment_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_renewals: {
        Row: {
          contract_id: string
          created_at: string
          created_by: string
          id: string
          mode: string
          new_contract_id: string | null
          new_end_date: string
          new_monthly_rent: number
          old_end_date: string
          old_monthly_rent: number
          reason: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by: string
          id?: string
          mode: string
          new_contract_id?: string | null
          new_end_date: string
          new_monthly_rent: number
          old_end_date: string
          old_monthly_rent: number
          reason?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by?: string
          id?: string
          mode?: string
          new_contract_id?: string | null
          new_end_date?: string
          new_monthly_rent?: number
          old_end_date?: string
          old_monthly_rent?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_renewals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_renewals_new_contract_id_fkey"
            columns: ["new_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_services: {
        Row: {
          amount: number
          catalog_id: string
          contract_id: string
          created_at: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          amount: number
          catalog_id: string
          contract_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          catalog_id?: string
          contract_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          building_id: string
          contract_code: string
          created_at: string
          deposit: number
          discount_amount: number
          end_date: string
          id: string
          monthly_rent: number
          notes: string | null
          occupant_count: number
          original_end_date: string | null
          payment_day: number | null
          previous_contract_id: string | null
          renewal_count: number
          room_id: string
          start_date: string
          status: string
          surcharge_amount: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          building_id: string
          contract_code: string
          created_at?: string
          deposit?: number
          discount_amount?: number
          end_date: string
          id?: string
          monthly_rent: number
          notes?: string | null
          occupant_count?: number
          original_end_date?: string | null
          payment_day?: number | null
          previous_contract_id?: string | null
          renewal_count?: number
          room_id: string
          start_date: string
          status?: string
          surcharge_amount?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          contract_code?: string
          created_at?: string
          deposit?: number
          discount_amount?: number
          end_date?: string
          id?: string
          monthly_rent?: number
          notes?: string | null
          occupant_count?: number
          original_end_date?: string | null
          payment_day?: number | null
          previous_contract_id?: string | null
          renewal_count?: number
          room_id?: string
          start_date?: string
          status?: string
          surcharge_amount?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_previous_contract_id_fkey"
            columns: ["previous_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_charges: {
        Row: {
          amount: number
          charge_type: string
          created_at: string
          id: string
          invoice_id: string
          label: string
          metadata: Json
          quantity: number
          sort_order: number
          source_id: string | null
          source_type: string | null
          unit_price: number
        }
        Insert: {
          amount?: number
          charge_type: string
          created_at?: string
          id?: string
          invoice_id: string
          label: string
          metadata?: Json
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          unit_price?: number
        }
        Update: {
          amount?: number
          charge_type?: string
          created_at?: string
          id?: string
          invoice_id?: string
          label?: string
          metadata?: Json
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_charges_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          invoice_id: string
          note: string | null
          paid_at: string
          payment_method: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          invoice_id: string
          note?: string | null
          paid_at: string
          payment_method?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          invoice_id?: string
          note?: string | null
          paid_at?: string
          payment_method?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_amount: number
          billing_period_id: string
          contract_id: string
          created_at: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_code: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          room_id: string
          status: string
          subtotal_amount: number
          superseded_by_invoice_id: string | null
          supersedes_invoice_id: string | null
          surcharge_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          balance_amount?: number
          billing_period_id: string
          contract_id: string
          created_at?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_code: string
          issued_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          room_id: string
          status?: string
          subtotal_amount?: number
          superseded_by_invoice_id?: string | null
          supersedes_invoice_id?: string | null
          surcharge_amount?: number
          tenant_id: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          balance_amount?: number
          billing_period_id?: string
          contract_id?: string
          created_at?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_code?: string
          issued_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          room_id?: string
          status?: string
          subtotal_amount?: number
          superseded_by_invoice_id?: string | null
          supersedes_invoice_id?: string | null
          surcharge_amount?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_superseded_by_invoice_id_fkey"
            columns: ["superseded_by_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supersedes_invoice_id_fkey"
            columns: ["supersedes_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          adjustment_reason: string | null
          building_id: string
          consumption: number | null
          created_at: string | null
          id: string
          is_adjusted: boolean
          is_estimated: boolean
          meter_type: string
          new_reading: number | null
          notes: string | null
          old_reading: number | null
          period_month: number
          period_year: number
          reading_date: string
          reading_type: string
          reading_value: number
          recorded_by: string | null
          room_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          adjustment_reason?: string | null
          building_id: string
          consumption?: number | null
          created_at?: string | null
          id?: string
          is_adjusted?: boolean
          is_estimated?: boolean
          meter_type: string
          new_reading?: number | null
          notes?: string | null
          old_reading?: number | null
          period_month: number
          period_year: number
          reading_date: string
          reading_type: string
          reading_value: number
          recorded_by?: string | null
          room_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          adjustment_reason?: string | null
          building_id?: string
          consumption?: number | null
          created_at?: string | null
          id?: string
          is_adjusted?: boolean
          is_estimated?: boolean
          meter_type?: string
          new_reading?: number | null
          notes?: string | null
          old_reading?: number | null
          period_month?: number
          period_year?: number
          reading_date?: string
          reading_type?: string
          reading_value?: number
          recorded_by?: string | null
          room_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meter_readings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_report_periods: {
        Row: {
          auto_closed: boolean
          building_id: string
          close_reason: string | null
          close_source: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          period_month: number
          period_year: number
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reserve_allocation_mode: string
          reserve_allocation_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_closed?: boolean
          building_id: string
          close_reason?: string | null
          close_source?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period_month: number
          period_year: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reserve_allocation_mode?: string
          reserve_allocation_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_closed?: boolean
          building_id?: string
          close_reason?: string | null
          close_source?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period_month?: number
          period_year?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reserve_allocation_mode?: string
          reserve_allocation_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_report_periods_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaid_expenses: {
        Row: {
          building_id: string
          category: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          monthly_amount: number
          name: string
          note: string | null
          receipt_url: string | null
          start_date: string
          status: string
          total_amount: number
          total_months: number
          updated_at: string
        }
        Insert: {
          building_id: string
          category: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          monthly_amount: number
          name: string
          note?: string | null
          receipt_url?: string | null
          start_date: string
          status?: string
          total_amount: number
          total_months: number
          updated_at?: string
        }
        Update: {
          building_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          monthly_amount?: number
          name?: string
          note?: string | null
          receipt_url?: string | null
          start_date?: string
          status?: string
          total_amount?: number
          total_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          anchor_day: number
          building_id: string
          category: string
          created_at: string
          created_by: string | null
          estimated_amount: number
          frequency: string
          id: string
          is_active: boolean
          name: string
          next_reminder_at: string
          updated_at: string
        }
        Insert: {
          anchor_day: number
          building_id: string
          category: string
          created_at?: string
          created_by?: string | null
          estimated_amount: number
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          next_reminder_at: string
          updated_at?: string
        }
        Update: {
          anchor_day?: number
          building_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          estimated_amount?: number
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_reminder_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      reserve_fund_transactions: {
        Row: {
          amount: number
          billing_period_id: string | null
          created_at: string
          created_by: string | null
          date: string
          fund_id: string
          id: string
          idempotency_key: string | null
          issued_revenue: number | null
          linked_expense_id: string | null
          note: string | null
          period_month: number | null
          period_year: number | null
          reserve_rate_percent: number | null
          source: string
          type: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          billing_period_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          fund_id: string
          id?: string
          idempotency_key?: string | null
          issued_revenue?: number | null
          linked_expense_id?: string | null
          note?: string | null
          period_month?: number | null
          period_year?: number | null
          reserve_rate_percent?: number | null
          source?: string
          type: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          billing_period_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          fund_id?: string
          id?: string
          idempotency_key?: string | null
          issued_revenue?: number | null
          linked_expense_id?: string | null
          note?: string | null
          period_month?: number | null
          period_year?: number | null
          reserve_rate_percent?: number | null
          source?: string
          type?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reserve_fund_transactions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_fund_transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "reserve_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserve_fund_transactions_linked_expense_id_fkey"
            columns: ["linked_expense_id"]
            isOneToOne: false
            referencedRelation: "building_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      reserve_funds: {
        Row: {
          building_id: string
          created_at: string
          id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserve_funds_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: true
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          area: number | null
          building_id: string
          code: string
          created_at: string
          description: string | null
          floor: number
          id: string
          monthly_rent: number
          room_number: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          area?: number | null
          building_id: string
          code: string
          created_at?: string
          description?: string | null
          floor?: number
          id?: string
          monthly_rent?: number
          room_number: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          area?: number | null
          building_id?: string
          code?: string
          created_at?: string
          description?: string | null
          floor?: number
          id?: string
          monthly_rent?: number
          room_number?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          building_id: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          pricing_type: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          building_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pricing_type: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          building_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pricing_type?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_expense_buildings: {
        Row: {
          building_id: string
          created_at: string
          id: string
          shared_expense_id: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          shared_expense_id: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          shared_expense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_expense_buildings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expense_buildings_shared_expense_id_fkey"
            columns: ["shared_expense_id"]
            isOneToOne: false
            referencedRelation: "shared_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_user_links: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: string | null
          id: string
          id_card_back_path: string | null
          id_card_front_path: string | null
          id_issued_date: string | null
          id_issued_place: string | null
          id_number: string | null
          notes: string | null
          occupation: string | null
          permanent_address: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: string | null
          id?: string
          id_card_back_path?: string | null
          id_card_front_path?: string | null
          id_issued_date?: string | null
          id_issued_place?: string | null
          id_number?: string | null
          notes?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          id_card_back_path?: string | null
          id_card_front_path?: string | null
          id_issued_date?: string | null
          id_issued_place?: string | null
          id_number?: string | null
          notes?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_building_assignments: {
        Row: {
          building_id: string
          can_delete_master_data: boolean
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          building_id: string
          can_delete_master_data?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          building_id?: string
          can_delete_master_data?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_building_assignments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_invoice_adjustment_with_audit: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_correlation_id: string
          p_expected_updated_at: string
          p_invoice_id: string
          p_label: string
          p_reason: string
          p_reference_invoice_id: string
        }
        Returns: Json
      }
      allocate_shared_expense: {
        Args: {
          p_actor_id: string
          p_period_month: number
          p_period_year: number
          p_shared_expense_id: string
        }
        Returns: {
          amount: number
          building_id: string
          expense_id: string
        }[]
      }
      billing_audit_search_page: {
        Args: {
          p_actions: string[]
          p_actor_ids: string[]
          p_correlation_id: string
          p_cursor: string
          p_cursor_id: string
          p_from: string
          p_limit: number
          p_period_id: string
          p_query: string
          p_to: string
        }
        Returns: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          billing_period_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "billing_audit_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      billing_period_input_snapshot: {
        Args: { p_period_id: string }
        Returns: Json
      }
      bulk_master_data_action: {
        Args: { p_action: string; p_entity: string; p_ids: string[] }
        Returns: {
          id: string
          reason: string
          succeeded: boolean
        }[]
      }
      cancel_ai_action_plan: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_action_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_ai_action_plan: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_action_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_ai_conversations: {
        Args: { p_limit?: number }
        Returns: number
      }
      cleanup_expired_ai_rate_limits: {
        Args: { p_limit?: number }
        Returns: number
      }
      complete_ai_action_plan: {
        Args: { p_plan_id: string; p_result: Json; p_user_id: string }
        Returns: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_action_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_ai_rate_limit: {
        Args: {
          p_limit: number
          p_now?: string
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_contract_with_handover: {
        Args: {
          p_building_id: string
          p_deposit: number
          p_discount_amount: number
          p_end_date: string
          p_handover_electricity_reading: number
          p_handover_reading_date: string
          p_handover_water_reading: number
          p_monthly_rent: number
          p_notes: string
          p_occupant_count: number
          p_payment_day: number
          p_recorded_by: string
          p_room_id: string
          p_start_date: string
          p_status: string
          p_surcharge_amount: number
          p_tenant_id: string
        }
        Returns: {
          building_id: string
          contract_code: string
          created_at: string
          deposit: number
          discount_amount: number
          end_date: string
          id: string
          monthly_rent: number
          notes: string | null
          occupant_count: number
          original_end_date: string | null
          payment_day: number | null
          previous_contract_id: string | null
          renewal_count: number
          room_id: string
          start_date: string
          status: string
          surcharge_amount: number
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dashboard_source_snapshot: {
        Args: {
          p_building_ids: string[]
          p_current_month: number
          p_current_year: number
          p_expiring_soon: string
          p_expiring_urgent: string
          p_today: string
        }
        Returns: Json
      }
      fail_ai_action_plan: {
        Args: { p_error: Json; p_plan_id: string; p_user_id: string }
        Returns: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_action_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      issue_and_pay: {
        Args: {
          p_actor_id: string
          p_contract_id: string
          p_correlation_id?: string
          p_draft: Json
          p_due_date: string
          p_issued_at: string
          p_note: string
          p_payment_date: string
          p_payment_method: string
          p_period_id: string
        }
        Returns: {
          balance_amount: number
          billing_period_id: string
          contract_id: string
          created_at: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_code: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          room_id: string
          status: string
          subtotal_amount: number
          superseded_by_invoice_id: string | null
          supersedes_invoice_id: string | null
          surcharge_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      issue_period_invoices: {
        Args: {
          p_actor_id: string
          p_correlation_id?: string
          p_drafts: Json
          p_due_date: string
          p_issued_at: string
          p_period_id: string
          p_requested_contract_ids: string[]
        }
        Returns: {
          balance_amount: number
          billing_period_id: string
          contract_id: string
          created_at: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_code: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          room_id: string
          status: string
          subtotal_amount: number
          superseded_by_invoice_id: string | null
          supersedes_invoice_id: string | null
          surcharge_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_ai_action_plan_stale: {
        Args: { p_error: Json; p_plan_id: string; p_user_id: string }
        Returns: {
          action_type: string
          building_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          error: Json | null
          executed_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          normalized_payload: Json
          payload_hash: string
          preview: Json
          resource_versions: Json
          result: Json | null
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_action_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      open_or_get_billing_period_with_audit: {
        Args: {
          p_action_plan_id?: string
          p_actor_id: string
          p_building_id: string
          p_idempotency_key?: string
          p_period_month: number
          p_period_year: number
          p_source?: string
        }
        Returns: {
          building_id: string
          closed_at: string
          created: boolean
          created_at: string
          id: string
          issued_at: string
          opened_by: string
          period_month: number
          period_year: number
          status: string
          updated_at: string
        }[]
      }
      operations_report_snapshot: {
        Args: {
          p_building_id: string
          p_period_month: number
          p_period_year: number
        }
        Returns: Json
      }
      owner_has_building_scope: {
        Args: { p_building_id: string }
        Returns: boolean
      }
      record_bulk_payments: {
        Args: {
          p_actor_id: string
          p_correlation_id?: string
          p_payments: Json
        }
        Returns: {
          amount: number
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          invoice_id: string
          note: string | null
          paid_at: string
          payment_method: string | null
          recorded_by: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "invoice_payments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reissue_invoice_with_audit: {
        Args: {
          p_actor_id: string
          p_correlation_id: string
          p_draft: Json
          p_due_date: string
          p_expected_updated_at: string
          p_issued_at: string
          p_notes: string
          p_reason: string
          p_voided_invoice_id: string
        }
        Returns: {
          balance_amount: number
          billing_period_id: string
          contract_id: string
          created_at: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_code: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          room_id: string
          status: string
          subtotal_amount: number
          superseded_by_invoice_id: string | null
          supersedes_invoice_id: string | null
          surcharge_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_meter_readings_with_audit: {
        Args: {
          p_action_plan_id?: string
          p_actor_id: string
          p_idempotency_key?: string
          p_readings: Json
          p_source?: string
        }
        Returns: {
          adjustment_reason: string | null
          building_id: string
          consumption: number | null
          created_at: string | null
          id: string
          is_adjusted: boolean
          is_estimated: boolean
          meter_type: string
          new_reading: number | null
          notes: string | null
          old_reading: number | null
          period_month: number
          period_year: number
          reading_date: string
          reading_type: string
          reading_value: number
          recorded_by: string | null
          room_id: string
          updated_at: string | null
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "meter_readings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_utility_usage_override_with_audit: {
        Args: {
          p_action_plan_id?: string
          p_actor_id: string
          p_billing_period_id: string
          p_expected_updated_at: string
          p_idempotency_key?: string
          p_override: Json
          p_source?: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          billable_usage: number
          billing_period_id: string
          created_at: string
          created_by: string | null
          current_reading_id: string | null
          current_reading_value: number
          id: string
          meter_type: string
          new_meter_start_value: number | null
          note: string | null
          old_meter_final_value: number | null
          previous_reading_id: string | null
          previous_reading_value: number
          reason: string
          room_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "billing_utility_usages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      slugify_text: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      void_invoice_with_audit: {
        Args: {
          p_actor_id: string
          p_correlation_id: string
          p_expected_updated_at: string
          p_invoice_id: string
          p_reason: string
        }
        Returns: {
          balance_amount: number
          billing_period_id: string
          contract_id: string
          created_at: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_code: string
          issued_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          room_id: string
          status: string
          subtotal_amount: number
          superseded_by_invoice_id: string | null
          supersedes_invoice_id: string | null
          surcharge_amount: number
          tenant_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      utility_type: "electricity" | "water"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      utility_type: ["electricity", "water"],
    },
  },
} as const
