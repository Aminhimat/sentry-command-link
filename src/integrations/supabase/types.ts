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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          company_id: string
          created_at: string
          guard_id: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          guard_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          guard_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      checkpoint_scans: {
        Row: {
          checkpoint_id: string
          company_id: string
          created_at: string
          guard_id: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          property_id: string | null
          scanned_at: string
          shift_id: string | null
        }
        Insert: {
          checkpoint_id: string
          company_id: string
          created_at?: string
          guard_id: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          property_id?: string | null
          scanned_at?: string
          shift_id?: string | null
        }
        Update: {
          checkpoint_id?: string
          company_id?: string
          created_at?: string
          guard_id?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          property_id?: string | null
          scanned_at?: string
          shift_id?: string | null
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          name: string
          property_id: string
          qr_code: string | null
          qr_code_data: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          property_id: string
          qr_code?: string | null
          qr_code_data?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          property_id?: string
          qr_code?: string | null
          qr_code_data?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          license_limit: number
          logo_url: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_limit?: number
          logo_url?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_limit?: number
          logo_url?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: []
      }
      guard_locations: {
        Row: {
          created_at: string
          guard_id: string
          id: string
          location_address: string | null
          location_lat: number
          location_lng: number
          recorded_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          guard_id: string
          id?: string
          location_address?: string | null
          location_lat: number
          location_lng: number
          recorded_at?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          guard_id?: string
          id?: string
          location_address?: string | null
          location_lat?: number
          location_lng?: number
          recorded_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      guard_login_constraints: {
        Row: {
          created_at: string
          guard_id: string
          id: string
          login_location_lat: number | null
          login_location_lng: number | null
          max_distance_miles: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          guard_id: string
          id?: string
          login_location_lat?: number | null
          login_location_lng?: number | null
          max_distance_miles?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          guard_id?: string
          id?: string
          login_location_lat?: number | null
          login_location_lng?: number | null
          max_distance_miles?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      guard_reports: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          guard_id: string
          id: string
          image_url: string | null
          images: string[] | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          property_id: string | null
          report_type: string | null
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          guard_id: string
          id?: string
          image_url?: string | null
          images?: string[] | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          property_id?: string | null
          report_type?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          guard_id?: string
          id?: string
          image_url?: string | null
          images?: string[] | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          property_id?: string | null
          report_type?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guard_shifts: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          company_id: string
          created_at: string
          guard_id: string
          hourly_report: string | null
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          property_id: string | null
          updated_at: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          company_id: string
          created_at?: string
          guard_id: string
          hourly_report?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          company_id?: string
          created_at?: string
          guard_id?: string
          hourly_report?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          property_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_shifts_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          guard_id: string
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          severity: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          guard_id: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          severity?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          guard_id?: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          severity?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_property_id: string | null
          avatar_url: string | null
          company_id: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          login_location_lat: number | null
          login_location_lng: number | null
          phone: string | null
          requires_admin_approval: boolean | null
          requires_password_change: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          assigned_property_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          login_location_lat?: number | null
          login_location_lng?: number | null
          phone?: string | null
          requires_admin_approval?: boolean | null
          requires_password_change?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          assigned_property_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          login_location_lat?: number | null
          login_location_lng?: number | null
          phone?: string | null
          requires_admin_approval?: boolean | null
          requires_password_change?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_property"
            columns: ["assigned_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_shifts: {
        Row: {
          company_id: string
          created_at: string
          days_of_week: string[]
          end_date: string
          end_time: string
          guard_id: string
          id: string
          is_active: boolean
          property_id: string
          shift_name: string
          start_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days_of_week: string[]
          end_date: string
          end_time: string
          guard_id: string
          id?: string
          is_active?: boolean
          property_id: string
          shift_name: string
          start_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days_of_week?: string[]
          end_date?: string
          end_time?: string
          guard_id?: string
          id?: string
          is_active?: boolean
          property_id?: string
          shift_name?: string
          start_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_primary_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      company_status: "active" | "inactive" | "suspended"
      user_role: "platform_admin" | "company_admin" | "guard"
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
      company_status: ["active", "inactive", "suspended"],
      user_role: ["platform_admin", "company_admin", "guard"],
    },
  },
} as const
