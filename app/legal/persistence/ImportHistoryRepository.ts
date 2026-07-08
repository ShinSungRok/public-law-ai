import type { ImportHistoryEntity } from "./ImportHistoryEntity";

export interface ImportHistoryRepository {
  save(entity: ImportHistoryEntity): Promise<void>;
  findAll(): Promise<ImportHistoryEntity[]>;
}
