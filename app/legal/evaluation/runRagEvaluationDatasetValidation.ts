import type { EvaluationCase } from "./EvaluationCase";
import {
  RAG_EVALUATION_CATEGORIES,
  RAG_EVALUATION_DATASET,
  type RagEvaluationCaseMetadata,
  type RagEvaluationCategory,
} from "./RagEvaluationDataset";

const MIN_CASE_COUNT = 20;
const MAX_CASE_COUNT = 30;
const MIN_VARIATION_GROUP_SIZE = 2;

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

function metadataOf(evaluationCase: EvaluationCase): RagEvaluationCaseMetadata {
  const metadata = evaluationCase.metadata as RagEvaluationCaseMetadata | undefined;
  assertTruthy(metadata, `case ${evaluationCase.id} is missing metadata`);
  assertTruthy(
    RAG_EVALUATION_CATEGORIES.includes(metadata!.category),
    `case ${evaluationCase.id} has an unknown category: ${metadata?.category}`,
  );
  return metadata!;
}

function assertDatasetSize(): void {
  assertTruthy(
    RAG_EVALUATION_DATASET.length >= MIN_CASE_COUNT &&
      RAG_EVALUATION_DATASET.length <= MAX_CASE_COUNT,
    `expected roughly ${MIN_CASE_COUNT}-${MAX_CASE_COUNT} evaluation cases, got ${RAG_EVALUATION_DATASET.length}`,
  );
}

function assertUniqueIds(): void {
  const ids = RAG_EVALUATION_DATASET.map((evaluationCase) => evaluationCase.id);
  const uniqueIds = new Set(ids);
  assertEqual(uniqueIds.size, ids.length, "expected every evaluation case id to be unique");
}

function assertNoDuplicateQuestions(): void {
  const queries = RAG_EVALUATION_DATASET.map((evaluationCase) =>
    evaluationCase.query.trim().toLowerCase(),
  );
  const uniqueQueries = new Set(queries);
  assertEqual(
    uniqueQueries.size,
    queries.length,
    "expected no two evaluation cases to ask the exact same question",
  );
}

function assertNoEmptyFields(): void {
  for (const evaluationCase of RAG_EVALUATION_DATASET) {
    assertTruthy(evaluationCase.id.trim().length > 0, `case has an empty id: ${JSON.stringify(evaluationCase)}`);
    assertTruthy(evaluationCase.name.trim().length > 0, `case ${evaluationCase.id} has an empty name`);
    assertTruthy(evaluationCase.query.trim().length > 0, `case ${evaluationCase.id} has an empty query`);
    assertTruthy(evaluationCase.target, `case ${evaluationCase.id} is missing a target`);

    const metadata = metadataOf(evaluationCase);
    assertTruthy(
      metadata.category.trim().length > 0,
      `case ${evaluationCase.id} has an empty category`,
    );

    assertTruthy(
      evaluationCase.expectedDocumentIds !== undefined,
      `case ${evaluationCase.id} is missing expectedDocumentIds (use [] for negative cases)`,
    );
    for (const documentId of evaluationCase.expectedDocumentIds ?? []) {
      assertTruthy(
        documentId.trim().length > 0,
        `case ${evaluationCase.id} has an empty expectedDocumentIds entry`,
      );
    }
  }
}

function assertCategoryCoverage(): Map<RagEvaluationCategory, number> {
  const countsByCategory = new Map<RagEvaluationCategory, number>();
  for (const category of RAG_EVALUATION_CATEGORIES) {
    countsByCategory.set(category, 0);
  }

  for (const evaluationCase of RAG_EVALUATION_DATASET) {
    const { category } = metadataOf(evaluationCase);
    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
  }

  for (const category of RAG_EVALUATION_CATEGORIES) {
    assertTruthy(
      (countsByCategory.get(category) ?? 0) > 0,
      `expected at least one evaluation case for required category: ${category}`,
    );
  }

  return countsByCategory;
}

function assertPositiveNegativeCoverage(): { positiveCount: number; negativeCount: number } {
  const negativeCases = RAG_EVALUATION_DATASET.filter(
    (evaluationCase) => metadataOf(evaluationCase).category === "negative",
  );
  const positiveCases = RAG_EVALUATION_DATASET.filter(
    (evaluationCase) => metadataOf(evaluationCase).category !== "negative",
  );

  assertTruthy(negativeCases.length > 0, "expected at least one negative case");
  assertTruthy(positiveCases.length > 0, "expected at least one positive case");

  for (const evaluationCase of negativeCases) {
    assertEqual(
      (evaluationCase.expectedDocumentIds ?? []).length,
      0,
      `expected negative case ${evaluationCase.id} to have no expected documents`,
    );
  }
  for (const evaluationCase of positiveCases) {
    assertTruthy(
      (evaluationCase.expectedDocumentIds ?? []).length > 0,
      `expected non-negative case ${evaluationCase.id} to have at least one expected document`,
    );
  }

  return { positiveCount: positiveCases.length, negativeCount: negativeCases.length };
}

function sameDocumentIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

function assertQueryVariationConsistency(): Map<string, number> {
  const groups = new Map<string, EvaluationCase[]>();
  for (const evaluationCase of RAG_EVALUATION_DATASET) {
    const { variationGroup } = metadataOf(evaluationCase);
    if (!variationGroup) {
      continue;
    }
    const group = groups.get(variationGroup) ?? [];
    group.push(evaluationCase);
    groups.set(variationGroup, group);
  }

  assertTruthy(groups.size > 0, "expected at least one query-variation group");

  const groupSizes = new Map<string, number>();
  for (const [variationGroup, cases] of groups) {
    groupSizes.set(variationGroup, cases.length);

    assertTruthy(
      cases.length >= MIN_VARIATION_GROUP_SIZE,
      `expected query-variation group "${variationGroup}" to contain at least ${MIN_VARIATION_GROUP_SIZE} differently-worded cases`,
    );
    for (const evaluationCase of cases) {
      assertEqual(
        metadataOf(evaluationCase).category,
        "query-variation",
        `expected every case in variation group "${variationGroup}" to be categorized as query-variation`,
      );
    }

    const [first, ...rest] = cases;
    for (const evaluationCase of rest) {
      assertTruthy(
        sameDocumentIds(
          first.expectedDocumentIds ?? [],
          evaluationCase.expectedDocumentIds ?? [],
        ),
        `expected all cases in variation group "${variationGroup}" to expect the same document(s): ` +
          `${first.id}=${JSON.stringify(first.expectedDocumentIds)} vs ${evaluationCase.id}=${JSON.stringify(evaluationCase.expectedDocumentIds)}`,
      );
    }

    // Differently-worded questions must actually be worded differently.
    const queries = new Set(cases.map((c) => c.query.trim().toLowerCase()));
    assertEqual(
      queries.size,
      cases.length,
      `expected every case in variation group "${variationGroup}" to use distinct wording`,
    );
  }

  return groupSizes;
}

function printSummary(
  countsByCategory: Map<RagEvaluationCategory, number>,
  coverage: { positiveCount: number; negativeCount: number },
  variationGroupSizes: Map<string, number>,
): void {
  console.log("[evaluation] RAG evaluation dataset summary:");
  console.log(`  Total cases: ${RAG_EVALUATION_DATASET.length}`);
  for (const category of RAG_EVALUATION_CATEGORIES) {
    console.log(`  ${category}: ${countsByCategory.get(category) ?? 0}`);
  }
  console.log(`  Positive cases: ${coverage.positiveCount}`);
  console.log(`  Negative cases: ${coverage.negativeCount}`);
  console.log(`  Query-variation groups: ${variationGroupSizes.size}`);
  for (const [group, size] of variationGroupSizes) {
    console.log(`    ${group}: ${size} variation(s)`);
  }
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: this validation only inspects the in-memory dataset.",
  );

  console.log("[evaluation] Checking dataset size is roughly 20-30 cases...");
  assertDatasetSize();

  console.log("[evaluation] Checking every case id is unique...");
  assertUniqueIds();

  console.log("[evaluation] Checking no two cases ask the exact same question...");
  assertNoDuplicateQuestions();

  console.log("[evaluation] Checking no case has empty required fields...");
  assertNoEmptyFields();

  console.log("[evaluation] Checking every required category is covered...");
  const countsByCategory = assertCategoryCoverage();

  console.log("[evaluation] Checking positive/negative case coverage...");
  const coverage = assertPositiveNegativeCoverage();

  console.log("[evaluation] Checking query-variation groups are internally consistent...");
  const variationGroupSizes = assertQueryVariationConsistency();

  printSummary(countsByCategory, coverage, variationGroupSizes);

  console.log("RAG evaluation dataset validation succeeded.");
}

main();
