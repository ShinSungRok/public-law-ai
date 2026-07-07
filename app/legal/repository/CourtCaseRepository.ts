import type { CourtCaseDocument } from "../domain/CourtCaseDocument";

export interface CourtCaseRepository {
  getCaseById(id: string): Promise<CourtCaseDocument | null>;
  listCases(): Promise<CourtCaseDocument[]>;
}
