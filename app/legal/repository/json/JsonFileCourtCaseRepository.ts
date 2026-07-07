import path from "node:path";

import type { CourtCaseDocument } from "../../domain/CourtCaseDocument";
import type { CourtCaseRepository } from "../CourtCaseRepository";
import { readJsonFile } from "./readJsonFile";

const CASES_DIR = path.join(process.cwd(), "data", "sample", "legal", "cases");
const COURT_CASE_FILE = path.join(CASES_DIR, "court-case.sample.json");

export class JsonFileCourtCaseRepository implements CourtCaseRepository {
  async getCaseById(id: string): Promise<CourtCaseDocument | null> {
    const courtCase = await readJsonFile<CourtCaseDocument>(COURT_CASE_FILE);
    return courtCase.id === id ? courtCase : null;
  }

  async listCases(): Promise<CourtCaseDocument[]> {
    const courtCase = await readJsonFile<CourtCaseDocument>(COURT_CASE_FILE);
    return [courtCase];
  }
}
