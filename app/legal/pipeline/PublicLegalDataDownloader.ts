import type { PublicDataSource } from "./PublicDataSource";
import type { RawLegalData } from "./RawLegalData";

export interface PublicLegalDataDownloader {
  download(source: PublicDataSource): Promise<RawLegalData[]>;
}
