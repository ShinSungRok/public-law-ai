import type { ParsedLegalData } from "./ParsedLegalData";
import type { RawLegalData } from "./RawLegalData";

export interface PublicLegalDataParser {
  parse(data: RawLegalData): Promise<ParsedLegalData[]>;
}
