/**
 * Manual Supabase Database Types
 * Generated from schema definition
 */

type VerifierApplicationStatus =
  | 'PENDING'
  | 'PENDING_ONCHAIN'
  | 'APPROVED'
  | 'REJECTED'

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
      cleanup_feed: {
        Row: {
          submission_id: string
          chain_id: number
          submitter: string
          eoa_address: string | null
          submitted_at: string | null
          verified_at: string | null
          latitude: number | null
          longitude: number | null
          location_type: string
          location_place_name: string | null
          location_label: string
          area_sqm: number
          weight_kg: number
          bags: number
          duration_minutes: number
          waste_types: Json
          contributors_count: number
          has_impact_report: boolean
          has_recyclables: boolean
          recyclables_amount_kg: number | null
          recyclables_amount_display: string | null
          recyclables_photo_cid: string
          recyclables_receipt_cid: string
          before_photo_cid: string
          after_photo_cid: string
          impact_ipfs_cid: string
          optional_video_cid: string
          summary: string
          synced_at: string
          created_at: string
        }
        Insert: {
          submission_id: string
          chain_id: number
          submitter: string
          eoa_address?: string | null
          submitted_at?: string | null
          verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          location_type?: string
          location_place_name?: string | null
          location_label?: string
          area_sqm?: number
          weight_kg?: number
          bags?: number
          duration_minutes?: number
          waste_types?: Json
          contributors_count?: number
          has_impact_report?: boolean
          has_recyclables?: boolean
          recyclables_amount_kg?: number | null
          recyclables_amount_display?: string | null
          recyclables_photo_cid?: string
          recyclables_receipt_cid?: string
          before_photo_cid?: string
          after_photo_cid?: string
          impact_ipfs_cid?: string
          optional_video_cid?: string
          summary?: string
          synced_at?: string
        }
        Update: {
          submitter?: string
          eoa_address?: string | null
          submitted_at?: string | null
          verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          location_type?: string
          location_place_name?: string | null
          location_label?: string
          area_sqm?: number
          weight_kg?: number
          bags?: number
          duration_minutes?: number
          waste_types?: Json
          contributors_count?: number
          has_impact_report?: boolean
          has_recyclables?: boolean
          recyclables_amount_kg?: number | null
          recyclables_amount_display?: string | null
          recyclables_photo_cid?: string
          recyclables_receipt_cid?: string
          before_photo_cid?: string
          after_photo_cid?: string
          impact_ipfs_cid?: string
          optional_video_cid?: string
          summary?: string
          synced_at?: string
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
          at_uri: string | null
          at_cid: string | null
          at_published_at: string | null
          at_publish_error: string | null
          at_version: string | null
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
          at_uri?: string | null
          at_cid?: string | null
          at_published_at?: string | null
          at_publish_error?: string | null
          at_version?: string | null
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
          at_uri?: string | null
          at_cid?: string | null
          at_published_at?: string | null
          at_publish_error?: string | null
          at_version?: string | null
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
