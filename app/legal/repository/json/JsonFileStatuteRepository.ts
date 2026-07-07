import path from "node:path";

import type { StatuteArticle } from "../../domain/StatuteArticle";
import type { StatuteDocument } from "../../domain/StatuteDocument";
import type { StatuteRepository } from "../StatuteRepository";
import { readJsonFile } from "./readJsonFile";

const STATUTES_DIR = path.join(
  process.cwd(),
  "data",
  "sample",
  "legal",
  "statutes",
);
const STATUTE_FILE = path.join(STATUTES_DIR, "statute.sample.json");
const STATUTE_ARTICLE_FILE = path.join(
  STATUTES_DIR,
  "statute-article.sample.json",
);

export class JsonFileStatuteRepository implements StatuteRepository {
  async getStatuteById(id: string): Promise<StatuteDocument | null> {
    const statute = await readJsonFile<StatuteDocument>(STATUTE_FILE);
    return statute.id === id ? statute : null;
  }

  async getArticleById(id: string): Promise<StatuteArticle | null> {
    const article = await readJsonFile<StatuteArticle>(STATUTE_ARTICLE_FILE);
    return article.id === id ? article : null;
  }

  async listArticles(): Promise<StatuteArticle[]> {
    const article = await readJsonFile<StatuteArticle>(STATUTE_ARTICLE_FILE);
    return [article];
  }
}
