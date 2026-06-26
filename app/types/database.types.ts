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
      billing_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          billing_period_id: string | null
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
          default_electricity_rate: number | null
          default_water_rate: number | null
          description: string | null
          electricity_pricing_type: string
          grace_period_days: number
          id: string
          meter_reading_day: number | null
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          payment_due_day: number | null
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
          default_electricity_rate?: number | null
          default_water_rate?: number | null
          description?: string | null
          electricity_pricing_type?: string
          grace_period_days?: number
          id?: string
          meter_reading_day?: number | null
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_due_day?: number | null
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
          default_electricity_rate?: number | null
          default_water_rate?: number | null
          description?: string | null
          electricity_pricing_type?: string
          grace_period_days?: number
          id?: string
          meter_reading_day?: number | null
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_due_day?: number | null
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
        Relationships: []
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
          id_issued_date: string | null
          id_issued_place: string | null
          id_number: string | null
          notes: string | null
          occupation: string | null
          permanent_address: string | null
          phone: string
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
          id_issued_date?: string | null
          id_issued_place?: string | null
          id_number?: string | null
          notes?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone: string
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
          id_issued_date?: string | null
          id_issued_place?: string | null
          id_number?: string | null
          notes?: string | null
          occupation?: string | null
          permanent_address?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      issue_period_invoices: {
        Args: {
          p_actor_id: string
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
      record_bulk_payments: {
        Args: { p_actor_id: string; p_payments: Json }
        Returns: {
          amount: number
          created_at: string
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
      slugify_text: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
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
