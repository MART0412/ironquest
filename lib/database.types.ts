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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          arm_cm: number | null
          bf_estimate: number | null
          chest_cm: number | null
          created_at: string
          date: string
          id: string
          neck_cm: number | null
          photo_paths: string[]
          thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          bf_estimate?: number | null
          chest_cm?: number | null
          created_at?: string
          date: string
          id?: string
          neck_cm?: number | null
          photo_paths?: string[]
          thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          bf_estimate?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          id?: string
          neck_cm?: number | null
          photo_paths?: string[]
          thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      cosmetic_equipped: {
        Row: {
          cosmetic_id: string
          equipped_at: string
          user_id: string
        }
        Insert: {
          cosmetic_id: string
          equipped_at?: string
          user_id: string
        }
        Update: {
          cosmetic_id?: string
          equipped_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmetic_equipped_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetic_unlocks: {
        Row: {
          cosmetic_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          cosmetic_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          cosmetic_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmetic_unlocks_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetics: {
        Row: {
          cost_points: number
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          sort_order: number
          type: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          sort_order?: number
          type: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      equivalence_milestones: {
        Row: {
          id: string
          metric: string
          points: number
          sort_order: number
          threshold: number
          xp: number
        }
        Insert: {
          id: string
          metric: string
          points?: number
          sort_order?: number
          threshold: number
          xp?: number
        }
        Update: {
          id?: string
          metric?: string
          points?: number
          sort_order?: number
          threshold?: number
          xp?: number
        }
        Relationships: []
      }
      exercises: {
        Row: {
          branch: string
          created_at: string
          demo_notes: string | null
          id: string
          is_custom: boolean
          movement_family: string | null
          name: string
          slug: string | null
          tier: number
          unlock_criteria: Json | null
          user_id: string | null
        }
        Insert: {
          branch: string
          created_at?: string
          demo_notes?: string | null
          id?: string
          is_custom?: boolean
          movement_family?: string | null
          name: string
          slug?: string | null
          tier: number
          unlock_criteria?: Json | null
          user_id?: string | null
        }
        Update: {
          branch?: string
          created_at?: string
          demo_notes?: string | null
          id?: string
          is_custom?: boolean
          movement_family?: string | null
          name?: string
          slug?: string | null
          tier?: number
          unlock_criteria?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          id: string
          kcal: number
          name: string
          protein_g: number
          serving: string | null
          source: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          kcal: number
          name: string
          protein_g?: number
          serving?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          serving?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          ai_raw: Json | null
          carbs_g: number
          comp_mode: string
          comp_quest_status: string | null
          created_at: string
          fat_g: number
          food_id: string | null
          id: string
          indulgence: boolean
          kcal: number
          protein_g: number
          ts: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_raw?: Json | null
          carbs_g?: number
          comp_mode?: string
          comp_quest_status?: string | null
          created_at?: string
          fat_g?: number
          food_id?: string | null
          id?: string
          indulgence?: boolean
          kcal: number
          protein_g?: number
          ts?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_raw?: Json | null
          carbs_g?: number
          comp_mode?: string
          comp_quest_status?: string | null
          created_at?: string
          fat_g?: number
          food_id?: string | null
          id?: string
          indulgence?: boolean
          kcal?: number
          protein_g?: number
          ts?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_adjustments: {
        Row: {
          created_at: string
          exercise_id: string
          from_reps: number | null
          from_sets: number | null
          id: string
          kind: string
          outcome: string
          routine_item_id: string | null
          to_reps: number | null
          to_sets: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          from_reps?: number | null
          from_sets?: number | null
          id?: string
          kind: string
          outcome: string
          routine_item_id?: string | null
          to_reps?: number | null
          to_sets?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          from_reps?: number | null
          from_sets?: number | null
          id?: string
          kind?: string
          outcome?: string
          routine_item_id?: string | null
          to_reps?: number | null
          to_sets?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_adjustments_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_adjustments_routine_item_id_fkey"
            columns: ["routine_item_id"]
            isOneToOne: false
            referencedRelation: "routine_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_factor: number | null
          avatar_character: string | null
          cal_target: number | null
          carbs_g: number | null
          created_at: string
          display_name: string | null
          dob: string | null
          fat_g: number | null
          height_cm: number | null
          id: string
          onboarding_completed_at: string | null
          phase: string
          protein_g: number | null
          sex: string | null
          split_config: Json | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          activity_factor?: number | null
          avatar_character?: string | null
          cal_target?: number | null
          carbs_g?: number | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          fat_g?: number | null
          height_cm?: number | null
          id: string
          onboarding_completed_at?: string | null
          phase?: string
          protein_g?: number | null
          sex?: string | null
          split_config?: Json | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          activity_factor?: number | null
          avatar_character?: string | null
          cal_target?: number | null
          carbs_g?: number | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          fat_g?: number | null
          height_cm?: number | null
          id?: string
          onboarding_completed_at?: string | null
          phase?: string
          protein_g?: number | null
          sex?: string | null
          split_config?: Json | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          archived_at: string | null
          cost_points: number
          created_at: string
          id: string
          note: string | null
          redeemed_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cost_points: number
          created_at?: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cost_points?: number
          created_at?: string
          id?: string
          note?: string | null
          redeemed_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routine_items: {
        Row: {
          exercise_id: string
          id: string
          is_hold: boolean
          reps_or_seconds: number
          routine_id: string
          sets: number
          sort_order: number
        }
        Insert: {
          exercise_id: string
          id?: string
          is_hold?: boolean
          reps_or_seconds: number
          routine_id: string
          sets: number
          sort_order: number
        }
        Update: {
          exercise_id?: string
          id?: string
          is_hold?: boolean
          reps_or_seconds?: number
          routine_id?: string
          sets?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "routine_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_items_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          day_of_week: string[]
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: string[]
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: string[]
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      skill_challenges: {
        Row: {
          attempts: number
          exercise_id: string
          offered_at: string
          offered_workout_id: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          exercise_id: string
          offered_at?: string
          offered_workout_id?: string | null
          resolved_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          attempts?: number
          exercise_id?: string
          offered_at?: string
          offered_workout_id?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_challenges_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_challenges_offered_workout_id_fkey"
            columns: ["offered_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_path_nodes: {
        Row: {
          exercise_id: string
          path_id: string
          position: number
        }
        Insert: {
          exercise_id: string
          path_id: string
          position: number
        }
        Update: {
          exercise_id?: string
          path_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_path_nodes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_path_nodes_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "skill_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_paths: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          signature_exercise_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          signature_exercise_id: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          signature_exercise_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_paths_signature_exercise_id_fkey"
            columns: ["signature_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_unlocks: {
        Row: {
          evidence_workout_id: string | null
          exercise_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          evidence_workout_id?: string | null
          exercise_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          evidence_workout_id?: string | null
          exercise_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_unlocks_evidence_workout_id_fkey"
            columns: ["evidence_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_unlocks_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          best_len: number
          current_len: number
          current_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_len?: number
          current_len?: number
          current_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_len?: number
          current_len?: number
          current_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          awarded_at: string
          milestone_id: string
          user_id: string
          value_at: number
          xp_awarded: number
        }
        Insert: {
          awarded_at?: string
          milestone_id: string
          user_id: string
          value_at: number
          xp_awarded?: number
        }
        Update: {
          awarded_at?: string
          milestone_id?: string
          user_id?: string
          value_at?: number
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "equivalence_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          difficulty: string | null
          exercise_id: string
          reps: number | null
          rpe: number | null
          seconds: number | null
          set_no: number
          workout_id: string
        }
        Insert: {
          difficulty?: string | null
          exercise_id: string
          reps?: number | null
          rpe?: number | null
          seconds?: number | null
          set_no: number
          workout_id: string
        }
        Update: {
          difficulty?: string | null
          exercise_id?: string
          reps?: number | null
          rpe?: number | null
          seconds?: number | null
          set_no?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          date: string
          id: string
          routine_id: string | null
          status: string
          updated_at: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          routine_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          routine_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "workouts_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_ledger: {
        Row: {
          action: string
          id: string
          points: number
          ref_date: string | null
          ref_id: string | null
          ts: string
          user_id: string
          xp: number
        }
        Insert: {
          action: string
          id?: string
          points?: number
          ref_date?: string | null
          ref_id?: string | null
          ts?: string
          user_id: string
          xp?: number
        }
        Update: {
          action?: string
          id?: string
          points?: number
          ref_date?: string | null
          ref_id?: string | null
          ts?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attempt_challenge: {
        Args: { p_exercise_id: string; p_fast_track?: boolean; p_sets?: Json }
        Returns: Json
      }
      award_skill_unlock: {
        Args: {
          p_action: string
          p_exercise: string
          p_points: number
          p_today: string
          p_user: string
          p_workout: string
          p_xp: number
        }
        Returns: Json
      }
      complete_workout: {
        Args: { p_routine_id?: string; p_sets?: Json }
        Returns: Json
      }
      decline_challenge: { Args: { p_exercise_id: string }; Returns: undefined }
      evaluate_milestones: {
        Args: {
          p_before: Json
          p_mult: number
          p_today: string
          p_user: string
          p_workout: string
        }
        Returns: Json
      }
      evaluate_streak_and_award: {
        Args: {
          p_ref_id?: string
          p_today: string
          p_today_qualifies: boolean
          p_user: string
        }
        Returns: {
          milestones: number
          multiplier: number
          streak_len: number
          was_reset: boolean
        }[]
      }
      lifetime_totals: { Args: { p_user: string }; Returns: Json }
      log_meal: {
        Args: {
          p_carbs?: number
          p_fat?: number
          p_food_id?: string
          p_kcal?: number
          p_name?: string
          p_protein?: number
          p_save?: boolean
          p_serving?: string
        }
        Returns: Json
      }
      purchase_cosmetic: { Args: { p_cosmetic_id: string }; Returns: Json }
      redeem_reward: { Args: { p_reward_id: string }; Returns: Json }
      save_routine: {
        Args: {
          p_day_of_week: string[]
          p_id?: string
          p_items: Json
          p_name: string
        }
        Returns: string
      }
      spend_points: {
        Args: {
          p_action: string
          p_amount: number
          p_ref: string
          p_user: string
        }
        Returns: number
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
