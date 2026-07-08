export interface ImportHistoryEntity {
  id: string;
  source: string;
  query: string;
  importedCount: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}
