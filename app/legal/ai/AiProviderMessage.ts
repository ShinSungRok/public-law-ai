import type { AiProviderRole } from "./AiProviderRole";

export interface AiProviderMessage {
  role: AiProviderRole;
  content: string;
}
