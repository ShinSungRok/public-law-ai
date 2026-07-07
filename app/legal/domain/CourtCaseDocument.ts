import type { LegalSourceMetadata } from "./LegalSourceMetadata";

export interface CourtCaseDocument {
  id: string;
  caseSerialNo: string;
  caseNumber: string;
  court: string;
  decisionDate: string;
  caseName: string;
  holdingGist: string;
  judgmentSummary: string;
  fullText?: string;
  referencedStatuteIds: string[];
  referencedCaseIds: string[];
  metadata: LegalSourceMetadata;
}
