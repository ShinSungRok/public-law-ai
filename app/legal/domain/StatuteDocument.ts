import type { LegalSourceMetadata } from "./LegalSourceMetadata";

export type StatuteStatus = "in_force" | "amended" | "repealed";

export interface StatuteDocument {
  id: string;
  lawId: string;
  lawMasterNo: string;
  titleKo: string;
  titleEn?: string;
  ministry: string;
  promulgationDate: string;
  enforcementDate: string;
  lawType: string;
  status: StatuteStatus;
  metadata: LegalSourceMetadata;
  articleIds: string[];
}
