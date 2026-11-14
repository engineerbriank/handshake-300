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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      assignment_budgets: {
        Row: {
          assignment_id: string
          funded_at: string
          funded_by: string | null
          funding_transaction_id: string | null
          id: string
          refunded_usd: number
          released_usd: number
          total_usd: number
        }
        Insert: {
          assignment_id: string
          funded_at?: string
          funded_by?: string | null
          funding_transaction_id?: string | null
          id?: string
          refunded_usd?: number
          released_usd?: number
          total_usd: number
        }
        Update: {
          assignment_id?: string
          funded_at?: string
          funded_by?: string | null
          funding_transaction_id?: string | null
          id?: string
          refunded_usd?: number
          released_usd?: number
          total_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_budgets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_claims: {
        Row: {
          assignment_id: string
          claimed_at: string
          credit_transaction_id: string | null
          credited_at: string | null
          deadline_notified_at: string | null
          due_at: string
          id: string
          revisions_used: number
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          claimed_at?: string
          credit_transaction_id?: string | null
          credited_at?: string | null
          deadline_notified_at?: string | null
          due_at: string
          id?: string
          revisions_used?: number
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          claimed_at?: string
          credit_transaction_id?: string | null
          credited_at?: string | null
          deadline_notified_at?: string | null
          due_at?: string
          id?: string
          revisions_used?: number
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_claims_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_disputes: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_disputes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "assignment_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          attachments: string[]
          claim_id: string
          content: string
          content_hash: string | null
          file_path: string | null
          id: string
          links: string[]
          revision_number: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[]
          claim_id: string
          content: string
          content_hash?: string | null
          file_path?: string | null
          id?: string
          links?: string[]
          revision_number?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[]
          claim_id?: string
          content?: string
          content_hash?: string | null
          file_path?: string | null
          id?: string
          links?: string[]
          revision_number?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "assignment_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          app_id: string | null
          category: string
          created_at: string
          created_by: string
          deadline: string
          deliverables: string
          description: string
          difficulty: string | null
          eligibility: string | null
          eligible_countries: string[]
          employer_id: string | null
          estimated_minutes: number
          id: string
          instructions: string
          max_revisions: number
          paused: boolean
          pay_usd: number
          publish_at: string | null
          published_at: string | null
          required_skills: string[]
          review_days: number
          review_requirements: string | null
          revision_policy: string | null
          slots: number
          slots_claimed: number
          sponsor_name: string
          sponsor_type: string
          status: Database["public"]["Enums"]["assignment_status"]
          submission_types: string[]
          template_id: string | null
          title: string
          updated_at: string
          verification_checklist: string[]
        }
        Insert: {
          app_id?: string | null
          category?: string
          created_at?: string
          created_by: string
          deadline: string
          deliverables: string
          description: string
          difficulty?: string | null
          eligibility?: string | null
          eligible_countries?: string[]
          employer_id?: string | null
          estimated_minutes: number
          id?: string
          instructions: string
          max_revisions?: number
          paused?: boolean
          pay_usd: number
          publish_at?: string | null
          published_at?: string | null
          required_skills?: string[]
          review_days?: number
          review_requirements?: string | null
          revision_policy?: string | null
          slots: number
          slots_claimed?: number
          sponsor_name?: string
          sponsor_type?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_types?: string[]
          template_id?: string | null
          title: string
          updated_at?: string
          verification_checklist?: string[]
        }
        Update: {
          app_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          deadline?: string
          deliverables?: string
          description?: string
          difficulty?: string | null
          eligibility?: string | null
          eligible_countries?: string[]
          employer_id?: string | null
          estimated_minutes?: number
          id?: string
          instructions?: string
          max_revisions?: number
          paused?: boolean
          pay_usd?: number
          publish_at?: string | null
          published_at?: string | null
          required_skills?: string[]
          review_days?: number
          review_requirements?: string | null
          revision_policy?: string | null
          slots?: number
          slots_claimed?: number
          sponsor_name?: string
          sponsor_type?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          submission_types?: string[]
          template_id?: string | null
          title?: string
          updated_at?: string
          verification_checklist?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assignments_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "task_app_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      employer_profiles: {
        Row: {
          billing_email: string | null
          company_name: string
          country: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          verified: boolean
          website: string | null
        }
        Insert: {
          billing_email?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          billing_email?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_verifications: {
        Row: {
          created_at: string
          document_path: string | null
          employer_id: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          employer_id: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          created_at?: string
          document_path?: string | null
          employer_id?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "employer_verifications_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base: string
          fetched_at: string
          id: string
          quote: string
          rate: number
          source: string
          source_timestamp: string | null
        }
        Insert: {
          base?: string
          fetched_at?: string
          id?: string
          quote: string
          rate: number
          source: string
          source_timestamp?: string | null
        }
        Update: {
          base?: string
          fetched_at?: string
          id?: string
          quote?: string
          rate?: number
          source?: string
          source_timestamp?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_at: string
          id: string
          job_id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          id?: string
          job_id: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_reports: {
        Row: {
          created_at: string
          id: string
          job_id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sources: {
        Row: {
          active_jobs: number
          attribution: string | null
          created_at: string
          credential_names: string[]
          enabled: boolean
          id: string
          kind: string
          last_error: string | null
          last_status: string
          last_sync_at: string | null
          name: string
          requires_credentials: boolean
          slug: string
          website: string | null
        }
        Insert: {
          active_jobs?: number
          attribution?: string | null
          created_at?: string
          credential_names?: string[]
          enabled?: boolean
          id?: string
          kind: string
          last_error?: string | null
          last_status?: string
          last_sync_at?: string | null
          name: string
          requires_credentials?: boolean
          slug: string
          website?: string | null
        }
        Update: {
          active_jobs?: number
          attribution?: string | null
          created_at?: string
          credential_names?: string[]
          enabled?: boolean
          id?: string
          kind?: string
          last_error?: string | null
          last_status?: string
          last_sync_at?: string | null
          name?: string
          requires_credentials?: boolean
          slug?: string
          website?: string | null
        }
        Relationships: []
      }
      job_sync_logs: {
        Row: {
          duplicates: number
          error: string | null
          expired: number
          fetched: number
          finished_at: string | null
          id: string
          invalid: number
          source_id: string
          started_at: string
          status: string
          upserted: number
        }
        Insert: {
          duplicates?: number
          error?: string | null
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          invalid?: number
          source_id: string
          started_at?: string
          status?: string
          upserted?: number
        }
        Update: {
          duplicates?: number
          error?: string | null
          expired?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          invalid?: number
          source_id?: string
          started_at?: string
          status?: string
          upserted?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_sync_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_url: string
          category: string
          created_at: string
          deadline: string | null
          dedupe_hash: string
          description: string
          eligible_countries: string[]
          employer: string
          employer_logo: string | null
          employment_type: string | null
          excerpt: string | null
          experience_level: string | null
          external_id: string
          id: string
          is_remote: boolean
          is_verified: boolean
          last_verified_at: string
          location: string
          published_at: string | null
          report_count: number
          requirements: string | null
          responsibilities: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          skills: string[]
          source_id: string
          source_url: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          worldwide: boolean
        }
        Insert: {
          apply_url: string
          category?: string
          created_at?: string
          deadline?: string | null
          dedupe_hash: string
          description: string
          eligible_countries?: string[]
          employer: string
          employer_logo?: string | null
          employment_type?: string | null
          excerpt?: string | null
          experience_level?: string | null
          external_id: string
          id?: string
          is_remote?: boolean
          is_verified?: boolean
          last_verified_at?: string
          location?: string
          published_at?: string | null
          report_count?: number
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          skills?: string[]
          source_id: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          worldwide?: boolean
        }
        Update: {
          apply_url?: string
          category?: string
          created_at?: string
          deadline?: string | null
          dedupe_hash?: string
          description?: string
          eligible_countries?: string[]
          employer?: string
          employer_logo?: string | null
          employment_type?: string | null
          excerpt?: string | null
          experience_level?: string | null
          external_id?: string
          id?: string
          is_remote?: boolean
          is_verified?: boolean
          last_verified_at?: string
          location?: string
          published_at?: string | null
          report_count?: number
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          skills?: string[]
          source_id?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          worldwide?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          external_reference: string | null
          id: string
          idempotency_key: string
          kind: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          external_reference?: string | null
          id?: string
          idempotency_key: string
          kind: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          external_reference?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          connection_status: string
          countries: string[]
          created_at: string
          currency: string
          enabled: boolean
          id: string
          last_checked_at: string | null
          last_error: string | null
          name: string
          notes: string | null
          purpose: string
          required_secrets: string[]
          slug: string
        }
        Insert: {
          connection_status?: string
          countries?: string[]
          created_at?: string
          currency: string
          enabled?: boolean
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          name: string
          notes?: string | null
          purpose: string
          required_secrets?: string[]
          slug: string
        }
        Update: {
          connection_status?: string
          countries?: string[]
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          name?: string
          notes?: string | null
          purpose?: string
          required_secrets?: string[]
          slug?: string
        }
        Relationships: []
      }
      payout_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          item_count: number
          notes: string | null
          scheduled_for: string
          status: string
          total_usd: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_count?: number
          notes?: string | null
          scheduled_for: string
          status?: string
          total_usd?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_count?: number
          notes?: string | null
          scheduled_for?: string
          status?: string
          total_usd?: number
        }
        Relationships: []
      }
      payout_transactions: {
        Row: {
          attempts: number
          batch_id: string
          callback_payload: Json | null
          confirmed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          provider: string
          provider_receipt: string | null
          provider_request_id: string | null
          status: string
          submitted_at: string | null
          withdrawal_id: string
        }
        Insert: {
          attempts?: number
          batch_id: string
          callback_payload?: Json | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          provider: string
          provider_receipt?: string | null
          provider_request_id?: string | null
          status?: string
          submitted_at?: string | null
          withdrawal_id: string
        }
        Update: {
          attempts?: number
          batch_id?: string
          callback_payload?: Json | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          provider?: string
          provider_receipt?: string | null
          provider_request_id?: string | null
          status?: string
          submitted_at?: string | null
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: true
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          active: boolean
          flat_usd: number
          id: string
          kind: string
          percent: number
          provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          flat_usd?: number
          id?: string
          kind: string
          percent?: number
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          flat_usd?: number
          id?: string
          kind?: string
          percent?: number
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string
          headline: string | null
          id: string
          last_name: string
          middle_name: string | null
          phone: string | null
          referral_code: string
          referred_by: string | null
          status_reason: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string
          headline?: string | null
          id: string
          last_name?: string
          middle_name?: string | null
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          status_reason?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string
          headline?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          status_reason?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string | null
          reviewer_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason?: string | null
          reviewer_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string | null
          reviewer_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          message: string
          priority: string
          staff_response: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          staff_response?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          staff_response?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      task_admin_settings: {
        Row: {
          default_pay_usd: number
          difficulty: string
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_pay_usd: number
          difficulty: string
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_pay_usd?: number
          difficulty?: string
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      task_app_directory: {
        Row: {
          category: string
          client_authorized: boolean
          created_at: string
          id: string
          last_verified_at: string | null
          listing_available: boolean
          name: string
          package_id: string | null
          play_store_url: string | null
          publisher: string | null
          supported_countries: string[] | null
          testing_instructions: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category: string
          client_authorized?: boolean
          created_at?: string
          id?: string
          last_verified_at?: string | null
          listing_available?: boolean
          name: string
          package_id?: string | null
          play_store_url?: string | null
          publisher?: string | null
          supported_countries?: string[] | null
          testing_instructions?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string
          client_authorized?: boolean
          created_at?: string
          id?: string
          last_verified_at?: string | null
          listing_available?: boolean
          name?: string
          package_id?: string | null
          play_store_url?: string | null
          publisher?: string | null
          supported_countries?: string[] | null
          testing_instructions?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          created_at: string
          description: string | null
          kind: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          kind?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          category_slug: string
          code: string
          created_at: string
          deliverables: string
          description: string
          difficulty: string
          estimated_minutes: number
          id: string
          instructions: string
          required_skills: string[]
          status: string
          submission_types: string[]
          suggested_pay_usd: number
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
          verification_checklist: string[]
        }
        Insert: {
          category_slug: string
          code: string
          created_at?: string
          deliverables: string
          description: string
          difficulty: string
          estimated_minutes: number
          id?: string
          instructions: string
          required_skills?: string[]
          status?: string
          submission_types?: string[]
          suggested_pay_usd: number
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
          verification_checklist?: string[]
        }
        Update: {
          category_slug?: string
          code?: string
          created_at?: string
          deliverables?: string
          description?: string
          difficulty?: string
          estimated_minutes?: number
          id?: string
          instructions?: string
          required_skills?: string[]
          status?: string
          submission_types?: string[]
          suggested_pay_usd?: number
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          verification_checklist?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_documents: {
        Row: {
          category: string
          created_at: string
          file_path: string | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          file_path?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_path?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_experience: {
        Row: {
          company: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          country: string | null
          created_at: string
          event: string
          id: string
          ip_address: string | null
          suspicious: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          event?: string
          id?: string
          ip_address?: string | null
          suspicious?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          event?: string
          id?: string
          ip_address?: string | null
          suspicious?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          created_at: string
          id: string
          level: string
          skill: string
          user_id: string
          years: number
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          skill: string
          user_id: string
          years?: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          skill?: string
          user_id?: string
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_verifications: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          kind: Database["public"]["Enums"]["verification_kind"]
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id?: string
          kind: Database["public"]["Enums"]["verification_kind"]
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["verification_kind"]
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_usd: number
          currency: string
          id: string
          pending_usd: number
          reserved_usd: number
          total_earned_usd: number
          total_withdrawn_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_usd?: number
          currency?: string
          id?: string
          pending_usd?: number
          reserved_usd?: number
          total_earned_usd?: number
          total_withdrawn_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_usd?: number
          currency?: string
          id?: string
          pending_usd?: number
          reserved_usd?: number
          total_earned_usd?: number
          total_withdrawn_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_methods: {
        Row: {
          account_name: string
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_default: boolean
          label: string
          ownership_status: Database["public"]["Enums"]["verification_status"]
          phone: string | null
          provider: string
          review_notes: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          country: string
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          label: string
          ownership_status?: Database["public"]["Enums"]["verification_status"]
          phone?: string | null
          provider: string
          review_notes?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          label?: string
          ownership_status?: Database["public"]["Enums"]["verification_status"]
          phone?: string | null
          provider?: string
          review_notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount_usd: number
          batch_id: string | null
          created_at: string
          exchange_rate: number
          exchange_rate_source: string | null
          failure_reason: string | null
          fee_local: number
          fee_usd: number
          gross_local: number
          id: string
          idempotency_key: string
          local_currency: string
          method_id: string
          net_local: number
          net_usd: number
          provider: string
          provider_reference: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          batch_id?: string | null
          created_at?: string
          exchange_rate?: number
          exchange_rate_source?: string | null
          failure_reason?: string | null
          fee_local?: number
          fee_usd?: number
          gross_local: number
          id?: string
          idempotency_key: string
          local_currency?: string
          method_id: string
          net_local: number
          net_usd: number
          provider: string
          provider_reference?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          batch_id?: string | null
          created_at?: string
          exchange_rate?: number
          exchange_rate_source?: string | null
          failure_reason?: string | null
          fee_local?: number
          fee_usd?: number
          gross_local?: number
          id?: string
          idempotency_key?: string
          local_currency?: string
          method_id?: string
          net_local?: number
          net_usd?: number
          provider?: string
          provider_reference?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _account_balance: { Args: { _code: string }; Returns: number }
      _account_id: { Args: { _code: string }; Returns: string }
      _audit: {
        Args: {
          _action: string
          _details?: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: undefined
      }
      _ensure_user_accounts: { Args: { _user: string }; Returns: undefined }
      _notify: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _type: string
          _user: string
        }
        Returns: undefined
      }
      _post_txn: {
        Args: {
          _description: string
          _entries: Json
          _external_ref?: string
          _key: string
          _kind: string
          _ref_id: string
          _ref_type: string
        }
        Returns: string
      }
      _profile_completion: { Args: { _user: string }; Returns: undefined }
      _recompute_status: { Args: { _user: string }; Returns: undefined }
      _refresh_wallet: { Args: { _user: string }; Returns: undefined }
      _release_withdrawal: {
        Args: {
          _reason: string
          _status: Database["public"]["Enums"]["withdrawal_status"]
          _wid: string
        }
        Returns: undefined
      }
      _require_staff: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: string
      }
      _setting_bool: {
        Args: { _default: boolean; _key: string }
        Returns: boolean
      }
      _setting_num: {
        Args: { _default: number; _key: string }
        Returns: number
      }
      abandon_claim: { Args: { _claim: string }; Returns: undefined }
      admin_broadcast: {
        Args: { _body: string; _link: string; _title: string }
        Returns: number
      }
      admin_close_assignment: { Args: { _assignment: string }; Returns: number }
      admin_create_task_from_template: {
        Args: {
          _app?: string
          _deadline: string
          _employer?: string
          _pay: number
          _publish_at?: string
          _slots: number
          _sponsor_name?: string
          _sponsor_type?: string
          _template: string
        }
        Returns: string
      }
      admin_fund_assignment: {
        Args: { _assignment: string; _idempotency_key: string }
        Returns: string
      }
      admin_fund_task: {
        Args: {
          _assignment: string
          _fit_to_funds?: boolean
          _idempotency_key: string
        }
        Returns: Json
      }
      admin_grant_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: undefined
      }
      admin_publish_assignment: {
        Args: { _assignment: string }
        Returns: undefined
      }
      admin_reconciliation: { Args: never; Returns: Json }
      admin_record_deposit: {
        Args: {
          _amount: number
          _external_reference: string
          _idempotency_key: string
          _note: string
        }
        Returns: string
      }
      admin_release_withdrawal: {
        Args: { _reason: string; _wid: string }
        Returns: undefined
      }
      admin_review_method: {
        Args: {
          _method: string
          _notes: string
          _status: Database["public"]["Enums"]["verification_status"]
        }
        Returns: undefined
      }
      admin_review_verification: {
        Args: {
          _notes: string
          _status: Database["public"]["Enums"]["verification_status"]
          _verification: string
        }
        Returns: undefined
      }
      admin_revoke_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: undefined
      }
      admin_set_fee: {
        Args: {
          _flat: number
          _kind: string
          _percent: number
          _provider: string
        }
        Returns: undefined
      }
      admin_set_task_paused: {
        Args: { _assignment: string; _paused: boolean }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          _reason: string
          _status: Database["public"]["Enums"]["account_status"]
          _user: string
        }
        Returns: undefined
      }
      admin_start_review: { Args: { _submission: string }; Returns: undefined }
      admin_task_stats: { Args: never; Returns: Json }
      admin_update_finance_setting: {
        Args: { _key: string; _value: number }
        Returns: undefined
      }
      admin_update_setting: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      admin_update_task_details: {
        Args: {
          _assignment: string
          _checklist: string[]
          _deadline: string
          _deliverables: string
          _instructions: string
        }
        Returns: undefined
      }
      cancel_withdrawal: { Args: { _wid: string }; Returns: undefined }
      claim_assignment: { Args: { _assignment: string }; Returns: string }
      create_payout_batch: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_phone_verified: { Args: never; Returns: undefined }
      next_payout_time: { Args: { _from?: string }; Returns: string }
      notify_task_deadlines: { Args: never; Returns: number }
      open_dispute: {
        Args: { _claim: string; _reason: string }
        Returns: string
      }
      payout_confirm: {
        Args: { _payload: Json; _payout: string; _receipt: string }
        Returns: undefined
      }
      payout_fail: {
        Args: { _payload: Json; _payout: string; _reason: string }
        Returns: undefined
      }
      payout_mark_attempt_error: {
        Args: { _error: string; _payout: string }
        Returns: undefined
      }
      payout_mark_submitted: {
        Args: { _payout: string; _provider_request_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { _amount: number; _idempotency_key: string; _method: string }
        Returns: string
      }
      review_submission: {
        Args: { _decision: string; _reason?: string; _submission: string }
        Returns: undefined
      }
      staff_has: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      start_claim: { Args: { _claim: string }; Returns: undefined }
      submit_assignment: {
        Args: { _claim: string; _content: string; _file_path?: string }
        Returns: string
      }
      submit_identity_verification: {
        Args: { _document_path: string }
        Returns: undefined
      }
      submit_task: {
        Args: {
          _attachments?: string[]
          _claim: string
          _content: string
          _links?: string[]
        }
        Returns: string
      }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      account_status:
        | "registered"
        | "email_pending"
        | "verification_pending"
        | "verified"
        | "active"
        | "restricted"
        | "suspended"
        | "under_review"
        | "closed"
      app_role:
        | "super_admin"
        | "operations_admin"
        | "job_manager"
        | "assignment_manager"
        | "finance_admin"
        | "support_admin"
        | "compliance_admin"
        | "client"
        | "user"
      assignment_status:
        | "draft"
        | "funded"
        | "published"
        | "closed"
        | "cancelled"
      claim_status:
        | "claimed"
        | "in_progress"
        | "submitted"
        | "under_review"
        | "revision_requested"
        | "approved"
        | "rejected"
        | "credited"
        | "abandoned"
        | "disputed"
        | "expired"
      job_status:
        | "active"
        | "expired"
        | "pending_review"
        | "rejected"
        | "removed"
      verification_kind:
        | "email"
        | "phone"
        | "profile"
        | "identity"
        | "payment_ownership"
      verification_status: "not_started" | "pending" | "approved" | "rejected"
      withdrawal_status:
        | "requested"
        | "reserved"
        | "on_hold"
        | "batched"
        | "submitted"
        | "paid"
        | "failed"
        | "cancelled"
        | "reversed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: [
        "registered",
        "email_pending",
        "verification_pending",
        "verified",
        "active",
        "restricted",
        "suspended",
        "under_review",
        "closed",
      ],
      app_role: [
        "super_admin",
        "operations_admin",
        "job_manager",
        "assignment_manager",
        "finance_admin",
        "support_admin",
        "compliance_admin",
        "client",
        "user",
      ],
      assignment_status: [
        "draft",
        "funded",
        "published",
        "closed",
        "cancelled",
      ],
      claim_status: [
        "claimed",
        "in_progress",
        "submitted",
        "under_review",
        "revision_requested",
        "approved",
        "rejected",
        "credited",
        "abandoned",
        "disputed",
        "expired",
      ],
      job_status: [
        "active",
        "expired",
        "pending_review",
        "rejected",
        "removed",
      ],
      verification_kind: [
        "email",
        "phone",
        "profile",
        "identity",
        "payment_ownership",
      ],
      verification_status: ["not_started", "pending", "approved", "rejected"],
      withdrawal_status: [
        "requested",
        "reserved",
        "on_hold",
        "batched",
        "submitted",
        "paid",
        "failed",
        "cancelled",
        "reversed",
      ],
    },
  },
} as const
