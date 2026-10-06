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
      announcements: {
        Row: {
          body: string
          church_id: string
          created_at: string | null
          created_by: string | null
          id: string
          pinned: boolean | null
          published: boolean | null
          published_at: string | null
          title: string
        }
        Insert: {
          body: string
          church_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          published?: boolean | null
          published_at?: string | null
          title: string
        }
        Update: {
          body?: string
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          published?: boolean | null
          published_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'announcements_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'announcements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
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
      campaigns: {
        Row: {
          church_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          end_date: string | null
          goal_amount: number
          id: string
          image_url: string | null
          name: string
          start_date: string
          status: Database['public']['Enums']['campaign_status'] | null
        }
        Insert: {
          church_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          goal_amount: number
          id?: string
          image_url?: string | null
          name: string
          start_date: string
          status?: Database['public']['Enums']['campaign_status'] | null
        }
        Update: {
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_date?: string | null
          goal_amount?: number
          id?: string
          image_url?: string | null
          name?: string
          start_date?: string
          status?: Database['public']['Enums']['campaign_status'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'campaigns_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
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
      event_attendance: {
        Row: {
          event_id: string
          id: string
          membership_id: string | null
          method: string | null
          registration_id: string | null
          scanned_at: string | null
        }
        Insert: {
          event_id: string
          id?: string
          membership_id?: string | null
          method?: string | null
          registration_id?: string | null
          scanned_at?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          membership_id?: string | null
          method?: string | null
          registration_id?: string | null
          scanned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_attendance_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_attendance_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_attendance_registration_id_fkey'
            columns: ['registration_id']
            isOneToOne: false
            referencedRelation: 'event_registrations'
            referencedColumns: ['id']
          },
        ]
      }
      event_registrations: {
        Row: {
          amount_paid: number | null
          checked_in_at: string | null
          church_membership_id: string | null
          created_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          payment_reference: string | null
          payment_status: string | null
          status: string | null
          ticket_code: string | null
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          checked_in_at?: string | null
          church_membership_id?: string | null
          created_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          status?: string | null
          ticket_code?: string | null
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          checked_in_at?: string | null
          church_membership_id?: string | null
          created_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          status?: string | null
          ticket_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_registrations_church_membership_id_fkey'
            columns: ['church_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_registrations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_registrations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          all_day: boolean | null
          capacity: number | null
          church_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          end_time: string | null
          id: string
          is_registration_required: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          poster_url: string | null
          price: number | null
          qr_code: string | null
          registration_deadline: string | null
          slug: string
          start_time: string
          status: Database['public']['Enums']['event_status'] | null
          title: string
          updated_at: string | null
          visibility: Database['public']['Enums']['event_visibility'] | null
        }
        Insert: {
          address?: string | null
          all_day?: boolean | null
          capacity?: number | null
          church_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_registration_required?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          poster_url?: string | null
          price?: number | null
          qr_code?: string | null
          registration_deadline?: string | null
          slug: string
          start_time: string
          status?: Database['public']['Enums']['event_status'] | null
          title: string
          updated_at?: string | null
          visibility?: Database['public']['Enums']['event_visibility'] | null
        }
        Update: {
          address?: string | null
          all_day?: boolean | null
          capacity?: number | null
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_registration_required?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          poster_url?: string | null
          price?: number | null
          qr_code?: string | null
          registration_deadline?: string | null
          slug?: string
          start_time?: string
          status?: Database['public']['Enums']['event_status'] | null
          title?: string
          updated_at?: string | null
          visibility?: Database['public']['Enums']['event_visibility'] | null
        }
        Relationships: [
          {
            foreignKeyName: 'events_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      expense_categories: {
        Row: {
          church_id: string
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          church_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          church_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expense_categories_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          church_id: string
          created_at: string | null
          currency: string | null
          description: string
          id: string
          method: Database['public']['Enums']['payment_method'] | null
          receipt_url: string | null
          recorded_by: string | null
          reference: string | null
          spent_at: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          church_id: string
          created_at?: string | null
          currency?: string | null
          description: string
          id?: string
          method?: Database['public']['Enums']['payment_method'] | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          spent_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          church_id?: string
          created_at?: string | null
          currency?: string | null
          description?: string
          id?: string
          method?: Database['public']['Enums']['payment_method'] | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference?: string | null
          spent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'expense_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      message_campaigns: {
        Row: {
          body: string
          channel: Database['public']['Enums']['communication_channel']
          church_id: string
          created_at: string | null
          created_by: string | null
          failed_count: number | null
          id: string
          recipient_filter: Json | null
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number | null
          status: string | null
          subject: string | null
          total_recipients: number | null
        }
        Insert: {
          body: string
          channel?: Database['public']['Enums']['communication_channel']
          church_id: string
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          total_recipients?: number | null
        }
        Update: {
          body?: string
          channel?: Database['public']['Enums']['communication_channel']
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string | null
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'message_campaigns_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_campaigns_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          body: string
          campaign_id: string | null
          channel: Database['public']['Enums']['communication_channel']
          church_id: string
          created_at: string | null
          delivered_at: string | null
          error: string | null
          id: string
          membership_id: string | null
          provider_id: string | null
          provider_response: Json | null
          sent_at: string | null
          status: Database['public']['Enums']['sms_status'] | null
          to_address: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          channel?: Database['public']['Enums']['communication_channel']
          church_id: string
          created_at?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          membership_id?: string | null
          provider_id?: string | null
          provider_response?: Json | null
          sent_at?: string | null
          status?: Database['public']['Enums']['sms_status'] | null
          to_address: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          channel?: Database['public']['Enums']['communication_channel']
          church_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          membership_id?: string | null
          provider_id?: string | null
          provider_response?: Json | null
          sent_at?: string | null
          status?: Database['public']['Enums']['sms_status'] | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'message_campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      offerings: {
        Row: {
          amount: number
          campaign_id: string | null
          church_id: string
          created_at: string | null
          currency: string | null
          given_at: string | null
          id: string
          membership_id: string | null
          method: Database['public']['Enums']['payment_method']
          notes: string | null
          pledge_id: string | null
          receipt_number: string | null
          recorded_by: string | null
          reference: string | null
          type: Database['public']['Enums']['offering_type']
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          church_id: string
          created_at?: string | null
          currency?: string | null
          given_at?: string | null
          id?: string
          membership_id?: string | null
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          pledge_id?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          reference?: string | null
          type?: Database['public']['Enums']['offering_type']
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          church_id?: string
          created_at?: string | null
          currency?: string | null
          given_at?: string | null
          id?: string
          membership_id?: string | null
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          pledge_id?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          reference?: string | null
          type?: Database['public']['Enums']['offering_type']
        }
        Relationships: [
          {
            foreignKeyName: 'offerings_campaign_fk'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offerings_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offerings_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offerings_pledge_fk'
            columns: ['pledge_id']
            isOneToOne: false
            referencedRelation: 'pledges'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offerings_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      pastoral_notes: {
        Row: {
          author_membership_id: string | null
          body: string
          church_id: string
          created_at: string | null
          id: string
          membership_id: string
          tags: string[] | null
        }
        Insert: {
          author_membership_id?: string | null
          body: string
          church_id: string
          created_at?: string | null
          id?: string
          membership_id: string
          tags?: string[] | null
        }
        Update: {
          author_membership_id?: string | null
          body?: string
          church_id?: string
          created_at?: string | null
          id?: string
          membership_id?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'pastoral_notes_author_membership_id_fkey'
            columns: ['author_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pastoral_notes_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pastoral_notes_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      pledges: {
        Row: {
          amount_pledged: number
          campaign_id: string | null
          church_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          ends_on: string | null
          frequency: string | null
          id: string
          membership_id: string
          notes: string | null
          starts_on: string
        }
        Insert: {
          amount_pledged: number
          campaign_id?: string | null
          church_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          ends_on?: string | null
          frequency?: string | null
          id?: string
          membership_id: string
          notes?: string | null
          starts_on?: string
        }
        Update: {
          amount_pledged?: number
          campaign_id?: string | null
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          ends_on?: string | null
          frequency?: string | null
          id?: string
          membership_id?: string
          notes?: string | null
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pledges_campaign_id_fkey'
            columns: ['campaign_id']
            isOneToOne: false
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pledges_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pledges_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pledges_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      prayer_interactions: {
        Row: {
          author_membership_id: string
          body: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          request_id: string
        }
        Insert: {
          author_membership_id: string
          body: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          request_id: string
        }
        Update: {
          author_membership_id?: string
          body?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'prayer_interactions_author_membership_id_fkey'
            columns: ['author_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prayer_interactions_request_id_fkey'
            columns: ['request_id']
            isOneToOne: false
            referencedRelation: 'prayer_requests'
            referencedColumns: ['id']
          },
        ]
      }
      prayer_requests: {
        Row: {
          assigned_to: string | null
          body: string
          category: string | null
          church_id: string
          closed_at: string | null
          created_at: string | null
          id: string
          membership_id: string
          status: Database['public']['Enums']['prayer_request_status']
          title: string
          type: Database['public']['Enums']['prayer_request_type']
          updated_at: string | null
          visibility: Database['public']['Enums']['prayer_visibility']
        }
        Insert: {
          assigned_to?: string | null
          body: string
          category?: string | null
          church_id: string
          closed_at?: string | null
          created_at?: string | null
          id?: string
          membership_id: string
          status?: Database['public']['Enums']['prayer_request_status']
          title: string
          type?: Database['public']['Enums']['prayer_request_type']
          updated_at?: string | null
          visibility?: Database['public']['Enums']['prayer_visibility']
        }
        Update: {
          assigned_to?: string | null
          body?: string
          category?: string | null
          church_id?: string
          closed_at?: string | null
          created_at?: string | null
          id?: string
          membership_id?: string
          status?: Database['public']['Enums']['prayer_request_status']
          title?: string
          type?: Database['public']['Enums']['prayer_request_type']
          updated_at?: string | null
          visibility?: Database['public']['Enums']['prayer_visibility']
        }
        Relationships: [
          {
            foreignKeyName: 'prayer_requests_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prayer_requests_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prayer_requests_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      resource_bookings: {
        Row: {
          approved_by: string | null
          church_id: string
          created_at: string | null
          ends_at: string
          id: string
          membership_id: string | null
          purpose: string | null
          resource_id: string
          starts_at: string
          status: string | null
          title: string
        }
        Insert: {
          approved_by?: string | null
          church_id: string
          created_at?: string | null
          ends_at: string
          id?: string
          membership_id?: string | null
          purpose?: string | null
          resource_id: string
          starts_at: string
          status?: string | null
          title: string
        }
        Update: {
          approved_by?: string | null
          church_id?: string
          created_at?: string | null
          ends_at?: string
          id?: string
          membership_id?: string | null
          purpose?: string | null
          resource_id?: string
          starts_at?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_bookings_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_bookings_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_bookings_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_bookings_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resources: {
        Row: {
          active: boolean | null
          capacity: number | null
          church_id: string
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          type: string
        }
        Insert: {
          active?: boolean | null
          capacity?: number | null
          church_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          type: string
        }
        Update: {
          active?: boolean | null
          capacity?: number | null
          church_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resources_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      role_permissions: {
        Row: {
          church_id: string
          created_at: string | null
          id: string
          permissions: string[]
          role: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          id?: string
          permissions?: string[]
          role: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          id?: string
          permissions?: string[]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: 'role_permissions_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      sermons: {
        Row: {
          church_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          preached_at: string
          published: boolean | null
          scripture_ref: string | null
          series: string | null
          speaker: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          youtube_id: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          preached_at: string
          published?: boolean | null
          scripture_ref?: string | null
          series?: string | null
          speaker?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          youtube_id: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          preached_at?: string
          published?: boolean | null
          scripture_ref?: string | null
          series?: string | null
          speaker?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sermons_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sermons_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
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
      visitor_followups: {
        Row: {
          author_membership_id: string | null
          created_at: string | null
          id: string
          method: string | null
          notes: string
          visitor_id: string
        }
        Insert: {
          author_membership_id?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          notes: string
          visitor_id: string
        }
        Update: {
          author_membership_id?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          notes?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'visitor_followups_author_membership_id_fkey'
            columns: ['author_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'visitor_followups_visitor_id_fkey'
            columns: ['visitor_id']
            isOneToOne: false
            referencedRelation: 'visitors'
            referencedColumns: ['id']
          },
        ]
      }
      visitors: {
        Row: {
          assigned_to: string | null
          church_id: string
          created_at: string | null
          email: string | null
          first_visit_date: string | null
          full_name: string
          id: string
          invited_by_membership_id: string | null
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          church_id: string
          created_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          full_name: string
          id?: string
          invited_by_membership_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          church_id?: string
          created_at?: string | null
          email?: string | null
          first_visit_date?: string | null
          full_name?: string
          id?: string
          invited_by_membership_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'visitors_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'visitors_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'visitors_invited_by_membership_id_fkey'
            columns: ['invited_by_membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      volunteer_roles: {
        Row: {
          church_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          church_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          church_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'volunteer_roles_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
        ]
      }
      volunteer_shifts: {
        Row: {
          church_id: string
          created_at: string | null
          created_by: string | null
          ends_at: string
          event_id: string | null
          id: string
          location: string | null
          notes: string | null
          role_id: string | null
          slots: number
          starts_at: string
          title: string
        }
        Insert: {
          church_id: string
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          role_id?: string | null
          slots?: number
          starts_at: string
          title: string
        }
        Update: {
          church_id?: string
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          role_id?: string | null
          slots?: number
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'volunteer_shifts_church_id_fkey'
            columns: ['church_id']
            isOneToOne: false
            referencedRelation: 'churches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'volunteer_shifts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'volunteer_shifts_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'volunteer_shifts_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'volunteer_roles'
            referencedColumns: ['id']
          },
        ]
      }
      volunteer_signups: {
        Row: {
          id: string
          membership_id: string
          shift_id: string
          signed_up_at: string | null
          status: string | null
        }
        Insert: {
          id?: string
          membership_id: string
          shift_id: string
          signed_up_at?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          membership_id?: string
          shift_id?: string
          signed_up_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'volunteer_signups_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'church_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'volunteer_signups_shift_id_fkey'
            columns: ['shift_id']
            isOneToOne: false
            referencedRelation: 'volunteer_shifts'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attendance_by_event: {
        Args: { p_church_id: string }
        Returns: {
          count: number
          event_date: string
          event_title: string
        }[]
      }
      is_church_admin: { Args: { church_uuid: string }; Returns: boolean }
      member_growth_by_month: {
        Args: { p_church_id: string }
        Returns: {
          count: number
          month: string
        }[]
      }
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
      campaign_status: 'active' | 'completed' | 'paused' | 'cancelled'
      communication_channel: 'sms' | 'email' | 'in_app'
      event_status: 'draft' | 'published' | 'cancelled' | 'completed'
      event_visibility: 'public' | 'members_only'
      offering_type:
        | 'tithe'
        | 'general'
        | 'missions'
        | 'building_fund'
        | 'welfare'
        | 'thanksgiving'
        | 'pledge'
        | 'other'
      payment_method:
        | 'cash'
        | 'mpesa'
        | 'bank_transfer'
        | 'cheque'
        | 'card'
        | 'online'
        | 'other'
      plan_tier: 'basic' | 'premium'
      prayer_request_status: 'open' | 'in_progress' | 'closed' | 'answered'
      prayer_request_type: 'prayer' | 'counseling'
      prayer_visibility:
        'private' | 'pastors_only' | 'public_anonymous' | 'public_named'
      sms_status: 'queued' | 'sending' | 'sent' | 'failed' | 'delivered'
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
      campaign_status: ['active', 'completed', 'paused', 'cancelled'],
      communication_channel: ['sms', 'email', 'in_app'],
      event_status: ['draft', 'published', 'cancelled', 'completed'],
      event_visibility: ['public', 'members_only'],
      offering_type: [
        'tithe',
        'general',
        'missions',
        'building_fund',
        'welfare',
        'thanksgiving',
        'pledge',
        'other',
      ],
      payment_method: [
        'cash',
        'mpesa',
        'bank_transfer',
        'cheque',
        'card',
        'online',
        'other',
      ],
      plan_tier: ['basic', 'premium'],
      prayer_request_status: ['open', 'in_progress', 'closed', 'answered'],
      prayer_request_type: ['prayer', 'counseling'],
      prayer_visibility: [
        'private',
        'pastors_only',
        'public_anonymous',
        'public_named',
      ],
      sms_status: ['queued', 'sending', 'sent', 'failed', 'delivered'],
      user_role: ['super_admin', 'dept_admin', 'member'],
    },
  },
} as const
