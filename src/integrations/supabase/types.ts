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
      addresses: {
        Row: {
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          line1: string
          line2: string | null
          phone: string
          pincode: string
          state: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          line1: string
          line2?: string | null
          phone: string
          pincode: string
          state: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          line1?: string
          line2?: string | null
          phone?: string
          pincode?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          brand: string
          id: string
          image: string
          order_id: string
          price: number
          product_id: string | null
          qty: number
          title: string
        }
        Insert: {
          brand: string
          id?: string
          image: string
          order_id: string
          price: number
          product_id?: string | null
          qty: number
          title: string
        }
        Update: {
          brand?: string
          id?: string
          image?: string
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          payment_method: string
          payment_status: string
          shipping: number
          shipping_address: string
          shipping_name: string
          shipping_phone: string
          status: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_method?: string
          payment_status?: string
          shipping?: number
          shipping_address: string
          shipping_name: string
          shipping_phone: string
          status?: string
          subtotal: number
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_method?: string
          payment_status?: string
          shipping?: number
          shipping_address?: string
          shipping_name?: string
          shipping_phone?: string
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          category: string
          compatibility: string | null
          created_at: string
          highlights: string[] | null
          id: string
          image: string
          mrp: number
          price: number
          rating: number
          reviews: number
          stock: number
          title: string
          warranty: string | null
        }
        Insert: {
          brand: string
          category: string
          compatibility?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          image: string
          mrp: number
          price: number
          rating?: number
          reviews?: number
          stock?: number
          title: string
          warranty?: string | null
        }
        Update: {
          brand?: string
          category?: string
          compatibility?: string | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          image?: string
          mrp?: number
          price?: number
          rating?: number
          reviews?: number
          stock?: number
          title?: string
          warranty?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repair_bookings: {
        Row: {
          contact_phone: string
          created_at: string
          estimated_cost: number | null
          id: string
          issue_description: string | null
          laptop_brand: string
          laptop_model: string
          preferred_date: string | null
          service_type: string
          status: string
          user_id: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          issue_description?: string | null
          laptop_brand: string
          laptop_model: string
          preferred_date?: string | null
          service_type: string
          status?: string
          user_id: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          issue_description?: string | null
          laptop_brand?: string
          laptop_model?: string
          preferred_date?: string | null
          service_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_in_requests: {
        Row: {
          age_years: number
          brand: string
          condition: string
          created_at: string
          estimated_value: number | null
          id: string
          model: string
          notes: string | null
          ram_gb: number | null
          status: string
          storage_gb: number | null
          user_id: string
        }
        Insert: {
          age_years: number
          brand: string
          condition: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          model: string
          notes?: string | null
          ram_gb?: number | null
          status?: string
          storage_gb?: number | null
          user_id: string
        }
        Update: {
          age_years?: number
          brand?: string
          condition?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          model?: string
          notes?: string | null
          ram_gb?: number | null
          status?: string
          storage_gb?: number | null
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
