export interface AIResponseChunk {
  text: string;
}

export type AIResponseStream = AsyncIterable<AIResponseChunk>;
