/**
 * Manual Supabase Database Types
 * Generated from schema definition
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      verifier_applications: {
        Row: {
          id: string
          address: string
          applied_at: number
          status: 'PENDING' | 'APPROVED' | 'REJECTED'
          reviewed_by: string | null
          reviewed_at: number | null
          notes: string | null
          tx_hash: string | null
          processing: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          address: string
          applied_at: number
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          reviewed_by?: string | null
          reviewed_at?: number | null
          notes?: string | null
          tx_hash?: string | null
          processing?: boolean
        }
        Update: {
          address?: string
          applied_at?: number
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          reviewed_by?: string | null
          reviewed_at?: number | null
          notes?: string | null
          tx_hash?: string | null
          processing?: boolean
          updated_at?: string
        }
      }
      verifier_audit_log: {
        Row: {
          id: string
          application_id: string
          action: string
          actor_address: string
          details: Json | null
          timestamp: string
        }
        Insert: {
          application_id: string
          action: string
          actor_address: string
          details?: Json | null
        }
        Update: {
          application_id?: string
          action?: string
          actor_address?: string
          details?: Json | null
        }
      }
      impact_snapshots: {
        Row: {
          id: string
          snapshot_date: string
          generated_at: string
          total_cleanups: number | null
          total_contributors: number | null
          total_area_sqm: number | null
          total_weight_kg: number | null
          total_bags: number | null
          total_time_minutes: number | null
          top_locations: Json | null
          waste_breakdown: Json | null
          sdg_impact: Json | null
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          snapshot_date: string
          generated_at: string
          total_cleanups?: number | null
          total_contributors?: number | null
          total_area_sqm?: number | null
          total_weight_kg?: number | null
          total_bags?: number | null
          total_time_minutes?: number | null
          top_locations?: Json | null
          waste_breakdown?: Json | null
          sdg_impact?: Json | null
          raw_data?: Json | null
        }
        Update: {
          snapshot_date?: string
          generated_at?: string
          total_cleanups?: number | null
          total_contributors?: number | null
          total_area_sqm?: number | null
          total_weight_kg?: number | null
          total_bags?: number | null
          total_time_minutes?: number | null
          top_locations?: Json | null
          waste_breakdown?: Json | null
          sdg_impact?: Json | null
          raw_data?: Json | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
