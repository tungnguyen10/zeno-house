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
      buildings: {
        Row: {
          address: string
          billing_generation_day: number | null
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
          status: string
          updated_at: string
          water_pricing_type: string
        }
        Insert: {
          address: string
          billing_generation_day?: number | null
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
          status?: string
          updated_at?: string
          water_pricing_type?: string
        }
        Update: {
          address?: string
          billing_generation_day?: number | null
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
          status?: string
          updated_at?: string
          water_pricing_type?: string
        }
        Relationships: []
      }
      building_services: {
        Row: {
          id: string
          building_id: string
          catalog_id: string
          default_amount: number
          pricing_type: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          building_id: string
          catalog_id: string
          default_amount?: number
          pricing_type?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          building_id?: string
          catalog_id?: string
          default_amount?: number
          pricing_type?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
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
      contract_payments: {
        Row: {
          id: string
          contract_id: string
          payment_type: string
          amount: number
          covered_period_start: string | null
          covered_period_end: string | null
          paid_at: string
          payment_method: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          payment_type: string
          amount: number
          covered_period_start?: string | null
          covered_period_end?: string | null
          paid_at: string
          payment_method?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          payment_type?: string
          amount?: number
          covered_period_start?: string | null
          covered_period_end?: string | null
          paid_at?: string
          payment_method?: string | null
          note?: string | null
          created_at?: string
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
      contract_renewals: {
        Row: {
          id: string
          contract_id: string
          new_contract_id: string | null
          mode: string
          old_end_date: string
          new_end_date: string
          old_monthly_rent: number
          new_monthly_rent: number
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          new_contract_id?: string | null
          mode: string
          old_end_date: string
          new_end_date: string
          old_monthly_rent: number
          new_monthly_rent: number
          reason?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          new_contract_id?: string | null
          mode?: string
          old_end_date?: string
          new_end_date?: string
          old_monthly_rent?: number
          new_monthly_rent?: number
          reason?: string | null
          created_by?: string
          created_at?: string
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
          id: string
          contract_id: string
          catalog_id: string
          amount: number
          quantity: number
          is_enabled: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          catalog_id: string
          amount: number
          quantity?: number
          is_enabled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          catalog_id?: string
          amount?: number
          quantity?: number
          is_enabled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_services_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          building_id: string
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
      meter_readings: {
        Row: {
          building_id: string
          created_at: string
          id: string
          is_estimated: boolean
          meter_type: string
          notes: string | null
          period_month: number
          period_year: number
          reading_date: string
          reading_type: string
          reading_value: number
          recorded_by: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          id?: string
          is_estimated?: boolean
          meter_type: string
          notes?: string | null
          period_month: number
          period_year: number
          reading_date: string
          reading_type: string
          reading_value: number
          recorded_by?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          id?: string
          is_estimated?: boolean
          meter_type?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          reading_date?: string
          reading_type?: string
          reading_value?: number
          recorded_by?: string | null
          room_id?: string
          updated_at?: string
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
          created_at: string
          description: string | null
          floor: number
          id: string
          monthly_rent: number
          room_number: string
          status: string
          updated_at: string
        }
        Insert: {
          area?: number | null
          building_id: string
          created_at?: string
          description?: string | null
          floor?: number
          id?: string
          monthly_rent?: number
          room_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          area?: number | null
          building_id?: string
          created_at?: string
          description?: string | null
          floor?: number
          id?: string
          monthly_rent?: number
          room_number?: string
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
          id: string
          code: string
          name: string
          pricing_type: string
          unit: string | null
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          pricing_type: string
          unit?: string | null
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          pricing_type?: string
          unit?: string | null
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
