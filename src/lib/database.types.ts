export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chine_snapshots: {
        Row: {
          created_at: string
          data: Json
          hash: string
          id: string
          source: string
          taken_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          hash: string
          id?: string
          source?: string
          taken_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          hash?: string
          id?: string
          source?: string
          taken_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chine_source: {
        Row: {
          created_at: string
          derniere_source: string | null
          drive_item_id: string | null
          id: string
          last_error: string | null
          last_hash: string | null
          last_sync_at: string | null
          ligne_unique: boolean
          mapping: Json
          share_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          derniere_source?: string | null
          drive_item_id?: string | null
          id?: string
          last_error?: string | null
          last_hash?: string | null
          last_sync_at?: string | null
          ligne_unique?: boolean
          mapping?: Json
          share_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          derniere_source?: string | null
          drive_item_id?: string | null
          id?: string
          last_error?: string | null
          last_hash?: string | null
          last_sync_at?: string | null
          ligne_unique?: boolean
          mapping?: Json
          share_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ajoute_par: string | null
          analyse_message: string | null
          analyse_statut: string
          categorie: string | null
          created_at: string
          deleted_at: string | null
          domaine_id: string | null
          epingle: boolean
          id: string
          infos_cles: Json
          mime: string | null
          nom: string
          projet_id: string | null
          resume: string | null
          storage_path: string
          taches_suggerees: Json
          taille: number | null
          updated_at: string
        }
        Insert: {
          ajoute_par?: string | null
          analyse_message?: string | null
          analyse_statut?: string
          categorie?: string | null
          created_at?: string
          deleted_at?: string | null
          domaine_id?: string | null
          epingle?: boolean
          id?: string
          infos_cles?: Json
          mime?: string | null
          nom: string
          projet_id?: string | null
          resume?: string | null
          storage_path: string
          taches_suggerees?: Json
          taille?: number | null
          updated_at?: string
        }
        Update: {
          ajoute_par?: string | null
          analyse_message?: string | null
          analyse_statut?: string
          categorie?: string | null
          created_at?: string
          deleted_at?: string | null
          domaine_id?: string | null
          epingle?: boolean
          id?: string
          infos_cles?: Json
          mime?: string | null
          nom?: string
          projet_id?: string | null
          resume?: string | null
          storage_path?: string
          taches_suggerees?: Json
          taille?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
      domaines: {
        Row: {
          couleur: string
          created_at: string
          id: string
          nom: string
          ordre: number
          updated_at: string
        }
        Insert: {
          couleur?: string
          created_at?: string
          id?: string
          nom: string
          ordre?: number
          updated_at?: string
        }
        Update: {
          couleur?: string
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
          updated_at?: string
        }
        Relationships: []
      }
      journal_activite: {
        Row: {
          action: string
          apres: Json | null
          at: string
          avant: Json | null
          created_at: string
          entite: string
          entite_id: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          apres?: Json | null
          at?: string
          avant?: Json | null
          created_at?: string
          entite: string
          entite_id: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          apres?: Json | null
          at?: string
          avant?: Json | null
          created_at?: string
          entite?: string
          entite_id?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      membres: {
        Row: {
          created_at: string
          derniere_ouverture_at: string | null
          email: string | null
          id: string
          nom: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          derniere_ouverture_at?: string | null
          email?: string | null
          id?: string
          nom: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          derniere_ouverture_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parametres: {
        Row: {
          created_at: string
          id: string
          ligne_unique: boolean
          modele_ia: string
          rapports_auto: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ligne_unique?: boolean
          modele_ia?: string
          rapports_auto?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ligne_unique?: boolean
          modele_ia?: string
          rapports_auto?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      postits: {
        Row: {
          archived_at: string | null
          contenu: string
          couleur: string
          created_at: string
          epingle: boolean
          id: string
          partage: boolean
          proprietaire: string
          rappel_at: string | null
          rappel_envoye: boolean
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          contenu: string
          couleur?: string
          created_at?: string
          epingle?: boolean
          id?: string
          partage?: boolean
          proprietaire?: string
          rappel_at?: string | null
          rappel_envoye?: boolean
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          contenu?: string
          couleur?: string
          created_at?: string
          epingle?: boolean
          id?: string
          partage?: boolean
          proprietaire?: string
          rappel_at?: string | null
          rappel_envoye?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      process: {
        Row: {
          contenu: Json
          contenu_texte: string
          created_at: string
          cree_par: string | null
          deleted_at: string | null
          domaine_id: string | null
          id: string
          modifie_par: string | null
          recherche: unknown
          responsable: string | null
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          contenu?: Json
          contenu_texte?: string
          created_at?: string
          cree_par?: string | null
          deleted_at?: string | null
          domaine_id?: string | null
          id?: string
          modifie_par?: string | null
          recherche?: unknown
          responsable?: string | null
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          contenu?: Json
          contenu_texte?: string
          created_at?: string
          cree_par?: string | null
          deleted_at?: string | null
          domaine_id?: string | null
          id?: string
          modifie_par?: string | null
          recherche?: unknown
          responsable?: string | null
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
        ]
      }
      process_versions: {
        Row: {
          auteur: string | null
          contenu: Json
          created_at: string
          id: string
          process_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          auteur?: string | null
          contenu: Json
          created_at?: string
          id?: string
          process_id: string
          titre: string
          updated_at?: string
        }
        Update: {
          auteur?: string | null
          contenu?: Json
          created_at?: string
          id?: string
          process_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_versions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "process"
            referencedColumns: ["id"]
          },
        ]
      }
      projets: {
        Row: {
          created_at: string
          id: string
          nom: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      rapports: {
        Row: {
          contenu_md: string | null
          created_at: string
          donnees: Json
          erreur: string | null
          filtres: Json
          genere_par: string | null
          id: string
          periode_debut: string
          periode_fin: string
          statut: string
          synthese: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contenu_md?: string | null
          created_at?: string
          donnees?: Json
          erreur?: string | null
          filtres?: Json
          genere_par?: string | null
          id?: string
          periode_debut: string
          periode_fin: string
          statut?: string
          synthese?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          contenu_md?: string | null
          created_at?: string
          donnees?: Json
          erreur?: string | null
          filtres?: Json
          genere_par?: string | null
          id?: string
          periode_debut?: string
          periode_fin?: string
          statut?: string
          synthese?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      taches: {
        Row: {
          assigne_a: string | null
          created_at: string
          cree_par: string | null
          deleted_at: string | null
          domaine_id: string | null
          done_at: string | null
          echeance: string | null
          en_attente_de: string | null
          id: string
          notes: string
          priorite: string
          projet_id: string | null
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          assigne_a?: string | null
          created_at?: string
          cree_par?: string | null
          deleted_at?: string | null
          domaine_id?: string | null
          done_at?: string | null
          echeance?: string | null
          en_attente_de?: string | null
          id?: string
          notes?: string
          priorite?: string
          projet_id?: string | null
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          assigne_a?: string | null
          created_at?: string
          cree_par?: string | null
          deleted_at?: string | null
          domaine_id?: string | null
          done_at?: string | null
          echeance?: string | null
          en_attente_de?: string | null
          id?: string
          notes?: string
          priorite?: string
          projet_id?: string | null
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taches_domaine_id_fkey"
            columns: ["domaine_id"]
            isOneToOne: false
            referencedRelation: "domaines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taches_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      devenir_premier_admin: { Args: { p_nom: string }; Returns: undefined }
      est_admin: { Args: never; Returns: boolean }
      est_membre: { Args: never; Returns: boolean }
      marquer_ouverture: { Args: never; Returns: string }
      premier_admin_possible: { Args: never; Returns: boolean }
      renommer_moi: { Args: { p_nom: string }; Returns: undefined }
      resume_entite: { Args: { p_row: Json; p_table: string }; Returns: Json }
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
    Enums: {},
  },
} as const

