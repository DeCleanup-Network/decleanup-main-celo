/**
 * Manual Supabase Database Types
 * Generated from schema definition
 */

import type { VerifierApplicationStatus } from '../verifier/types'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      verifier_applications: {
        Row: {
          id: string
          address: string
          applied_at: number
          status: VerifierApplicationStatus
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
          status?: VerifierApplicationStatus
          reviewed_by?: string | null
          reviewed_at?: number | null
          notes?: string | null
          tx_hash?: string | null
          processing?: boolean
        }
        Update: {
          address?: string
          applied_at?: number
          status?: VerifierApplicationStatus
          reviewed_by?: string | null
          reviewed_at?: number | null
          notes?: string | null
          tx_hash?: string | null
          processing?: boolean
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      impact_portfolios: {
        Row: {
          address: string
          display_name: string
          bio: string
          location_label: string
          location_coords: string
          show_precise_location: boolean
          creator_name: string
          creator_role: string
          projects: string
          open_to: string
          farcaster_url: string
          twitter_url: string
          dapp_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          address: string
          display_name: string
          bio: string
          location_label: string
          location_coords: string
          show_precise_location: boolean
          creator_name: string
          creator_role: string
          projects: string
          open_to: string
          farcaster_url: string
          twitter_url: string
          dapp_url: string
        }
        Update: {
          address?: string
          display_name?: string
          bio?: string
          location_label?: string
          location_coords?: string
          show_precise_location?: boolean
          creator_name?: string
          creator_role?: string
          projects?: string
          open_to?: string
          farcaster_url?: string
          twitter_url?: string
          dapp_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      hypercert_requests: {
        Row: {
          id: string
          requester: string
          metadata: Json
          status: string
          submitted_at: number
          reviewed_at: number | null
          reviewed_by: string | null
          rejection_reason: string | null
          metadata_cid: string | null
          hypercert_id: string | null
          tx_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          requester: string
          metadata: Json
          status: string
          submitted_at: number
          reviewed_at?: number | null
          reviewed_by?: string | null
          rejection_reason?: string | null
          metadata_cid?: string | null
          hypercert_id?: string | null
          tx_hash?: string | null
        }
        Update: {
          requester?: string
          metadata?: Json
          status?: string
          reviewed_at?: number | null
          reviewed_by?: string | null
          rejection_reason?: string | null
          metadata_cid?: string | null
          hypercert_id?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
