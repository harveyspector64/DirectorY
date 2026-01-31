export type ManualFields = Record<string, string>;

export interface Director {
  id: string;
  name: string;
  director_qid?: string;
  tier_ai?: string;
  tier_ai_confidence?: string;
  tier_ai_as_of?: string;
  availability_ai?: string;
  availability_ai_confidence?: string;
  availability_ai_as_of?: string;
  ai_evidence_urls?: string;
  reps_manual?: string;
  internal_notes?: string;
  exclude?: string;
  watchlist_priority?: string;
  manual_fields: ManualFields;
}
