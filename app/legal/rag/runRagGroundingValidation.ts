import type { AIResponseStream } from "../../ai/model/AIResponse";
import type {
  LLMCompletionRequest,
  LLMProvider,
} from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import type { LegalDocument } from "../domain";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import type { Retriever } from "../retrieval/Retriever";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import { DefaultCitationExtractor } from "./DefaultCitationExtractor";
import { RagAnswerBuilder } from "./RagAnswerBuilder";

// Same literal markers LegalPromptBuilder.ts uses to switch between a
// grounded and an ungrounded prompt — reused here (not redefined) so this
// validation breaks if that existing contract ever changes.
const GROUNDED_MARKER = "Retrieved legal context:";
const UNGROUNDED_MARKER = "No retrieved legal sources were found for this question.";

const GROUNDING_INDEX_NAME = "public-law-ai-grounding-validation";

// Question phrasing matches the FakeOpenSearchClient's plain substring
// matcher (no Korean morphological analysis, unlike the real OpenSearch
// nori analyzer) — see the "Retrieval Verification" comment below.
const QUESTION = "개인정보 정의";
const NO_MATCH_QUESTION = "우주법 판례번호";
const GROUNDED_ANSWER =
  "개인정보 보호법 제2조에 따르면 개인정보는 살아 있는 개인에 관한 정보입니다.";
const ARTICLE_BODY_SNIPPET = "살아 있는 개인에 관한 정보";

// Shaped exactly like LawGoKrStatuteDetailParser's output (Phase 24 Task 5):
// "법령명 / 조문 / 조문 제목" header, then the article body — proving this
// validation is grounded in full statute-article content, not just
// search-result metadata.
const RELEVANT_ARTICLE: LegalDocument = {
  id: "011461:2",
  documentType: "STATUTE_ARTICLE",
  title: "개인정보 보호법 제2조(정의)",
  text: [
    "법령명: 개인정보 보호법",
    "조문: 제2조",
    "조문 제목: 정의",
    "공포일자: 20200205",
    "시행일자: 20200805",
    "",
    "제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.",
    `1. "개인정보"란 ${ARTICLE_BODY_SNIPPET}로서 성명, 주민등록번호 및 영상 등을 통하여 개인을 알아볼 수 있는 정보를 말한다.`,
  ].join("\n"),
  metadata: {
    sourceSystem: "law.go.kr",
    sourceId: "011461",
    sourceUrl:
      "https://www.law.go.kr/DRF/lawService.do?target=law&type=HTML&ID=011461&JO=000200",
    retrievedAt: "2026-07-13T00:00:00Z",
  },
  sourceRef: { sourceType: "statute_article", sourceId: "011461:2" },
};

// Unrelated statute article: proves retrieval/citation do not pull in
// documents that have no lexical connection to the question.
const UNRELATED_ARTICLE: LegalDocument = {
  id: "011862:1",
  documentType: "STATUTE_ARTICLE",
  title: "도로교통법 제1조(목적)",
  text: [
    "법령명: 도로교통법",
    "조문: 제1조",
    "조문 제목: 목적",
    "",
    "제1조(목적) 이 법은 도로에서 일어나는 교통상의 모든 위험과 장해를 방지하고 제거하여 안전하고 원활한 교통을 확보함을 목적으로 한다.",
  ].join("\n"),
  metadata: {
    sourceSystem: "law.go.kr",
    sourceId: "011862",
    sourceUrl:
      "https://www.law.go.kr/DRF/lawService.do?target=law&type=HTML&ID=011862&JO=000100",
    retrievedAt: "2026-07-13T00:00:00Z",
  },
  sourceRef: { sourceType: "statute_article", sourceId: "011862:1" },
};

/**
 * Mirrors the existing ContextAwareFakeLLMProvider pattern (see
 * runRagAnswerEvaluationValidation.ts): answers with a deterministic,
 * article-referencing response when the prompt is grounded, and stays
 * silent when it is not — preserving the existing insufficient-context
 * contract. Additionally records the last request so tests can inspect the
 * exact text sent to the LLM (augmentation verification), which no existing
 * fake exposes.
 */
class RecordingLLMProvider implements LLMProvider {
  lastRequest: LLMCompletionRequest | undefined;

  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    this.lastRequest = request;
    const isGrounded = request.prompt.includes(GROUNDED_MARKER);
    return (async function* (): AIResponseStream {
      if (isGrounded) {
        yield { text: GROUNDED_ANSWER };
      }
    })();
  }
}

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

async function buildGroundingRetriever(): Promise<{
  retriever: Retriever;
  openSearchClient: FakeOpenSearchClient;
}> {
  const openSearchClient = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: GROUNDING_INDEX_NAME,
  };

  await new OpenSearchIndexManager(openSearchClient, config).ensureLegalIndex();
  await new OpenSearchLegalDocumentIndexer(openSearchClient, config).indexAll([
    RELEVANT_ARTICLE,
    UNRELATED_ARTICLE,
  ]);

  const searchEngine = new OpenSearchSearchEngine(openSearchClient, config);
  return { retriever: new SearchEngineRetriever(searchEngine), openSearchClient };
}

async function validateRetrieval(retriever: Retriever): Promise<void> {
  const retrievalResult = await retriever.retrieve(QUESTION);

  console.log(`[grounding] question: "${QUESTION}"`);
  console.log(`[grounding] retrieved document count: ${retrievalResult.documents.length}`);
  console.log(
    `[grounding] retrieved document ids: ${retrievalResult.documents.map((d) => d.document.id).join(", ")}`,
  );
  console.log(
    `[grounding] retrieved document titles: ${retrievalResult.documents.map((d) => d.document.title).join(", ")}`,
  );

  assertTruthy(
    retrievalResult.documents.length > 0,
    "expected the retriever to return at least one statute article for the grounding question",
  );
  assertTruthy(
    retrievalResult.documents.some((d) => d.document.id === RELEVANT_ARTICLE.id),
    "expected 개인정보 보호법 제2조(정의) to be retrieved for the grounding question",
  );
  assertTruthy(
    retrievalResult.documents.every((d) => d.document.id !== UNRELATED_ARTICLE.id),
    "expected the unrelated 도로교통법 article not to be retrieved for the grounding question",
  );

  const relevant = retrievalResult.documents.find((d) => d.document.id === RELEVANT_ARTICLE.id)!;
  assertTruthy(
    relevant.document.text.includes(ARTICLE_BODY_SNIPPET),
    "expected the retrieved document to carry full article body text, not just search-result metadata",
  );
}

async function validateAugmentationAndGeneration(retriever: Retriever): Promise<{
  answer: string;
  citationsSourceIds: string[];
}> {
  const recordingProvider = new RecordingLLMProvider();
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(retriever, recordingProvider, ragAnswerBuilder);

  const ragAnswer = await useCase.execute(QUESTION);

  console.log("[grounding] context creation: prompt built and sent to LLM provider");
  console.log(`[grounding] LLM execution: grounded=${recordingProvider.lastRequest?.prompt.includes(GROUNDED_MARKER)}`);
  console.log(`[grounding] citation count: ${ragAnswer.citations.length}`);

  assertTruthy(recordingProvider.lastRequest, "expected the LLM provider to receive a request");
  const prompt = recordingProvider.lastRequest!.prompt;

  assertTruthy(prompt.includes(GROUNDED_MARKER), "expected a grounded prompt to be used");
  assertTruthy(prompt.includes(QUESTION), "expected the prompt to include the original user question");
  assertTruthy(
    prompt.includes(RELEVANT_ARTICLE.title),
    "expected the prompt to include the retrieved statute/article title",
  );
  assertTruthy(
    prompt.includes(ARTICLE_BODY_SNIPPET),
    "expected the prompt to include the actual retrieved article body text, not just metadata",
  );
  assertTruthy(
    !prompt.includes(UNRELATED_ARTICLE.title),
    "expected the prompt not to include unrelated retrieved content",
  );

  assertEqual(
    ragAnswer.answer,
    GROUNDED_ANSWER,
    "expected the RAG answer to be produced via the LLM execution path using the deterministic grounded fake response",
  );

  return {
    answer: ragAnswer.answer,
    citationsSourceIds: ragAnswer.citations.map((citation) => citation.sourceId),
  };
}

async function validateCitations(retriever: Retriever): Promise<void> {
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(
    retriever,
    new RecordingLLMProvider(),
    ragAnswerBuilder,
  );

  const ragAnswer = await useCase.execute(QUESTION);

  assertTruthy(ragAnswer.citations.length > 0, "expected citation count to be non-zero");
  assertTruthy(
    ragAnswer.citations.some((citation) => citation.sourceId === RELEVANT_ARTICLE.sourceRef.sourceId),
    "expected a citation referencing the retrieved article's source id",
  );
  assertTruthy(
    ragAnswer.citations.every(
      (citation) => citation.sourceId !== UNRELATED_ARTICLE.sourceRef.sourceId,
    ),
    "expected no citation to reference the unrelated document",
  );

  const relevantCitation = ragAnswer.citations.find(
    (citation) => citation.sourceId === RELEVANT_ARTICLE.sourceRef.sourceId,
  )!;
  assertEqual(
    relevantCitation.displayText,
    RELEVANT_ARTICLE.title,
    "expected citation displayText (statute + article title) to match the retrieved document",
  );
  assertEqual(
    relevantCitation.sourceType,
    RELEVANT_ARTICLE.sourceRef.sourceType,
    "expected citation sourceType to match the retrieved document",
  );

  // Known gap (not fixed here — would require an OpenSearch mapping change,
  // out of scope for this verification-only task): OpenSearchLegalDocument
  // only stores id/documentType/title/text/sourceType/sourceId, so
  // OpenSearchSearchResponseMapper.toLegalDocument() always rebuilds
  // metadata with empty strings. Citation.sourceUrl is therefore always ""
  // for citations sourced through OpenSearch retrieval, even though the
  // indexed LegalDocument.metadata.sourceUrl was populated at indexing time.
  assertEqual(
    relevantCitation.sourceUrl,
    "",
    "documented gap: OpenSearch-retrieved citations currently always have an empty sourceUrl " +
      "because OpenSearchLegalDocument/OpenSearchSearchResponseMapper do not round-trip metadata.sourceUrl",
  );
}

async function validateInsufficientContext(retriever: Retriever): Promise<void> {
  const noMatchResult = await retriever.retrieve(NO_MATCH_QUESTION);
  assertEqual(
    noMatchResult.documents.length,
    0,
    "expected no documents to be retrieved for an unrelated question",
  );

  const recordingProvider = new RecordingLLMProvider();
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(retriever, recordingProvider, ragAnswerBuilder);

  const ragAnswer = await useCase.execute(NO_MATCH_QUESTION);

  assertTruthy(recordingProvider.lastRequest, "expected the LLM provider to still receive a request");
  assertTruthy(
    recordingProvider.lastRequest!.prompt.includes(UNGROUNDED_MARKER),
    "expected the existing ungrounded-prompt contract (buildUngroundedUserPrompt) to be used when nothing is retrieved",
  );
  assertTruthy(
    !recordingProvider.lastRequest!.prompt.includes(GROUNDED_MARKER),
    "expected an insufficient-context prompt not to claim grounding",
  );
  assertEqual(ragAnswer.answer, "", "expected an empty answer when nothing relevant was retrieved");
  assertEqual(ragAnswer.citations.length, 0, "expected an empty citation list when nothing relevant was retrieved");
}

/**
 * Same scenario as above, but wired through the real composition root
 * (DefaultApplicationContextFactory + ApplicationContext), matching the
 * pattern already used by runApplicationContextSearchWiringValidation.ts.
 * FakeAiProvider (selected automatically when LLM_PROVIDER is unset/"fake")
 * echoes the full prompt back in its response, so asserting the echoed
 * answer contains the question and the article body proves the *actual*
 * production wiring — not just a hand-assembled use case — is grounded.
 */
async function validateFullProductionWiringIsGrounded(): Promise<void> {
  process.env.SEARCH_ENGINE = "opensearch";
  process.env.OPENSEARCH_NODE = "http://fake-opensearch:9200";
  process.env.OPENSEARCH_INDEX_NAME = GROUNDING_INDEX_NAME;

  try {
    const openSearchClient = new FakeOpenSearchClient();
    const config: OpenSearchConfig = {
      node: process.env.OPENSEARCH_NODE,
      indexName: GROUNDING_INDEX_NAME,
    };
    await new OpenSearchIndexManager(openSearchClient, config).ensureLegalIndex();
    await new OpenSearchLegalDocumentIndexer(openSearchClient, config).indexAll([
      RELEVANT_ARTICLE,
      UNRELATED_ARTICLE,
    ]);

    const context = new DefaultApplicationContextFactory(openSearchClient).create();
    const ragAnswer = await context.ragController.answer({ query: QUESTION });

    assertTruthy(
      ragAnswer.answer.includes(QUESTION),
      "expected the production-wired FakeAiProvider echo to include the question, proving the real composition-root path received it",
    );
    assertTruthy(
      ragAnswer.answer.includes(ARTICLE_BODY_SNIPPET),
      "expected the production-wired answer to be grounded in the actual retrieved article body text",
    );
    assertTruthy(
      ragAnswer.citations.some(
        (citation) => citation.sourceId === RELEVANT_ARTICLE.sourceRef.sourceId,
      ),
      "expected production-wired citations to reference the retrieved article",
    );
  } finally {
    delete process.env.SEARCH_ENGINE;
    delete process.env.OPENSEARCH_NODE;
    delete process.env.OPENSEARCH_INDEX_NAME;
  }
}

async function main(): Promise<void> {
  console.log(
    "[grounding] No external services required: OpenSearch is replaced with FakeOpenSearchClient and the LLM with a deterministic fake provider.",
  );

  const { retriever } = await buildGroundingRetriever();

  console.log("[grounding] 1. Retrieval verification...");
  await validateRetrieval(retriever);

  console.log("[grounding] 2/3. Augmentation + generation verification...");
  await validateAugmentationAndGeneration(retriever);

  console.log("[grounding] 4. Citation verification...");
  await validateCitations(retriever);

  console.log("[grounding] 5. Insufficient-context verification...");
  await validateInsufficientContext(retriever);

  console.log(
    "[grounding] Checking the real composition root (DefaultApplicationContextFactory) is grounded end-to-end...",
  );
  await validateFullProductionWiringIsGrounded();

  console.log("RAG grounding validation succeeded.");
}

main();
