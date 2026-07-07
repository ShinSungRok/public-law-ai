export const OPEN_SEARCH_LEGAL_INDEX_MAPPING = {
  mappings: {
    properties: {
      id: { type: "keyword" },
      documentType: { type: "keyword" },
      title: { type: "text" },
      text: { type: "text" },
      sourceType: { type: "keyword" },
      sourceId: { type: "keyword" },
    },
  },
} as const;
