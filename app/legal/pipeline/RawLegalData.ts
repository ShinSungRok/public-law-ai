export interface RawLegalData {
  id: string;
  sourceSystem: string;
  sourceId: string;
  rawFormat: "json" | "xml" | "text";
  content: string;
  collectedAt: string;
}
