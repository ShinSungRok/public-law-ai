import type { StatuteArticle } from "../domain/StatuteArticle";
import type { StatuteDocument } from "../domain/StatuteDocument";

export interface StatuteRepository {
  getStatuteById(id: string): Promise<StatuteDocument | null>;
  getArticleById(id: string): Promise<StatuteArticle | null>;
  listArticles(): Promise<StatuteArticle[]>;
}
