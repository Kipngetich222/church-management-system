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
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          church_id: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          church_id: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          church_id?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      church_memberships: {
        Row: {
          address: string | null
          badges: Database['public']['Enums']['badge_type'][] | null
          church_id: string
          date_of_birth: string | null
          gender: string | null
          id: string
          is_baptized: boolean | null
          joined_at: string | null
          notes: string | null
          role: Database['public']['Enums']['user_role']
          status: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          badges?: Database['public']['Enums']['badge_type'][] | null
          church_id: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          is_baptized?: boolean | null
          joined_at?: string | null
          notes?: string | null
          role?: Database['public']['Enums']['user_role']
          status?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          badges?: Database['public']['Enums']['badge_type'][] | null
          church_id?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          is_baptized?: boolean | null
          joined_at?: string | null
          notes?: string | null
          role?: Database['public']['Enums']['user_role']
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'church_memberships_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'church_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          plan: Database['public']['Enums']['plan_tier'] | null
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          plan?: Database['public']['Enums']['plan_tier'] | null
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          plan?: Database['public']['Enums']['plan_tier'] | null
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'churches_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      department_members: {
        Row: {
          department_id: string
          id: string
          is_leader: boolean | null
          joined_at: string | null
          membership_id: string
        }
        Insert: {
          department_id: string
          id?: string
          is_leader?: boolean | null
          joined_at?: string | null
          membership_id: string
        }
        Update: {
          department_id?: string
          id?: string
          is_leader?: boolean | null
          joined_at?: string | null
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'department_members_department_id_fkey'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'department_members_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      departments: {
        Row: {
          church_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          church_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          church_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'departments_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      small_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          membership_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          membership_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'small_group_members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'small_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'small_group_members_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      small_groups: {
        Row: {
          church_id: string
          created_at: string | null
          description: string | null
          id: string
          leader_membership_id: string | null
          location: string | null
          meeting_day: string | null
          meeting_time: string | null
          name: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          leader_membership_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          leader_membership_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'small_groups_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'small_groups_leader_membership_id_fkey'
            columns: ['leader_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_church_admin: { Args: { church_uuid: string }; Returns: boolean }
      user_role_in_church: {
        Args: { church_uuid: string }
        Returns: Database['public']['Enums']['user_role']
      }
    }
    Enums: {
      badge_type:
        | 'pastor'
        | 'usher'
        | 'worship'
        | 'choir'
        | 'media'
        | 'youth'
        | 'children'
        | 'baptized'
        | 'elder'
        | 'deacon'
      plan_tier: 'basic' | 'premium'
      user_role: 'super_admin' | 'dept_admin' | 'member'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      badge_type: [
        'pastor',
        'usher',
        'worship',
        'choir',
        'media',
        'youth',
        'children',
        'baptized',
        'elder',
        'deacon',
      ],
      plan_tier: ['basic', 'premium'],
      user_role: ['super_admin', 'dept_admin', 'member'],
    },
  },
} as const
