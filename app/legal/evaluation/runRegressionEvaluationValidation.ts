import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import { KeywordSearchEngine } from "../search/KeywordSearchEngine";
import type { EvaluationCase } from "./EvaluationCase";
import { RagAnswerEvaluationRunner } from "./RagAnswerEvaluationRunner";
import type { EvaluationRunnerRegistry } from "./RegressionEvaluationRunner";
import { RegressionEvaluationRunner } from "./RegressionEvaluationRunner";
import { RetrievalEvaluationRunner } from "./RetrievalEvaluationRunner";
import { SearchEvaluationRunner } from "./SearchEvaluationRunner";

const SAMPLE_DOCUMENTS: LegalDocument[] = [
  {
    id: "doc-a",
    documentType: "STATUTE_ARTICLE",
    title: "개인정보보호법",
    text: "개인정보의 처리와 보호에 관한 사항을 정한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "doc-a",
      sourceUrl: "https://fake.local/statutes/a",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: "doc-a" },
  },
];

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

class FakeLLMProvider implements LLMProvider {
  streamCompletion(): AIResponseStream {
    return (async function* (): AIResponseStream {
      yield { text: "이 법은 개인정보를 보호합니다." };
    })();
  }
}

const RETRIEVAL_CASE: EvaluationCase = {
  id: "regression-retrieval",
  name: "regression retrieval case",
  target: "retrieval",
  query: "개인정보보호법",
  expectedDocumentIds: ["doc-a"],
};

const SEARCH_CASE: EvaluationCase = {
  id: "regression-search",
  name: "regression search case",
  target: "search",
  query: "개인정보보호법",
  expectedDocumentIds: ["doc-a"],
};

const RAG_ANSWER_CASE: EvaluationCase = {
  id: "regression-rag-answer",
  name: "regression rag-answer case",
  target: "rag-answer",
  query: "개인정보보호법",
  expectedAnswerKeywords: ["개인정보"],
  expectedCitationDocumentIds: ["doc-a"],
};

const UNSUPPORTED_TARGET_CASE: EvaluationCase = {
  id: "regression-unsupported-citation",
  name: "regression case for an unregistered citation runner",
  target: "citation",
  query: "unused",
};

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const searchEngine = new KeywordSearchEngine(retriever);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new FakeLLMProvider(),
    ragAnswerBuilder,
  );

  const runnersByTarget: EvaluationRunnerRegistry = {
    retrieval: new RetrievalEvaluationRunner(retriever),
    search: new SearchEvaluationRunner(searchEngine),
    "rag-answer": new RagAnswerEvaluationRunner(generateRagAnswerUseCase),
  };
  const regressionRunner = new RegressionEvaluationRunner(runnersByTarget);

  console.log("[evaluation] Checking regression runner dispatches a retrieval case...");
  const retrievalResult = await regressionRunner.run(RETRIEVAL_CASE);
  assertEqual(retrievalResult.target, "retrieval", "retrieval result target mismatch");
  assertTruthy(retrievalResult.passed, "retrieval case should pass");

  console.log("[evaluation] Checking regression runner dispatches a search case...");
  const searchResult = await regressionRunner.run(SEARCH_CASE);
  assertEqual(searchResult.target, "search", "search result target mismatch");
  assertTruthy(searchResult.passed, "search case should pass");

  console.log("[evaluation] Checking regression runner dispatches a rag-answer case...");
  const ragAnswerResult = await regressionRunner.run(RAG_ANSWER_CASE);
  assertEqual(ragAnswerResult.target, "rag-answer", "rag-answer result target mismatch");
  assertTruthy(ragAnswerResult.passed, "rag-answer case should pass");

  console.log(
    "[evaluation] Checking EvaluationSummary aggregates results across targets...",
  );
  const summary = await regressionRunner.runMany([
    RETRIEVAL_CASE,
    SEARCH_CASE,
    RAG_ANSWER_CASE,
  ]);
  assertEqual(summary.totalCount, 3, "summary totalCount mismatch");
  assertEqual(summary.results.length, 3, "summary results length mismatch");
  const resultTargets = summary.results.map((result) => result.target).sort();
  assertEqual(
    JSON.stringify(resultTargets),
    JSON.stringify(["rag-answer", "retrieval", "search"]),
    "summary should contain one result per target",
  );
  assertEqual(summary.passedCount, 3, "expected all three cases to pass");
  assertEqual(summary.failedCount, 0, "expected no failing cases");

  console.log(
    "[evaluation] Checking a missing runner produces a clear error...",
  );
  let rejected = false;
  try {
    await regressionRunner.run(UNSUPPORTED_TARGET_CASE);
  } catch (error) {
    rejected = true;
    assertTruthy(
      error instanceof Error && error.message.includes("citation"),
      "error message should clearly name the unsupported target",
    );
  }
  assertTruthy(
    rejected,
    "expected regression runner to reject a case with no registered runner",
  );

  console.log("Regression evaluation validation succeeded.");
}

main();
