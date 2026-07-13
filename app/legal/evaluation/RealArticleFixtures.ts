import type { LegalDocument } from "../domain";

export function toFixtureDocument(id: string, title: string, text: string): LegalDocument {
  return {
    id,
    documentType: "STATUTE_ARTICLE",
    title,
    text,
    metadata: {
      sourceSystem: "fake-source",
      sourceId: id,
      sourceUrl: `https://fake.local/statutes/${id}`,
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: id },
  };
}

// Ids/titles/text below are verbatim excerpts fetched live from the
// production OpenSearch index (public-law-ai-local) for exactly the ids
// RAG_EVALUATION_DATASET's positive cases reference — not fabricated. This
// keeps evaluation validations deterministic/offline while still measuring
// against genuine statute content. Shared by runRetrievalMetricsValidation.ts
// and runRetrievalFailureAnalysisValidation.ts so the corpus isn't duplicated.
export const REAL_ARTICLE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument(
    "011357:2",
    "개인정보 보호법 제2조(정의)",
    "제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다. 1. \"개인정보\"란 살아 있는 개인에 관한 정보로서 다음 각 목의 어느 하나에 해당하는 정보를 말한다. 1의2. \"가명처리\"란 개인정보의 일부를 삭제하거나 일부 또는 전부를 대체하는 등의 방법으로 추가 정보가 없이는 특정 개인을 알아볼 수 없도록 처리하는 것을 말한다. 3. \"정보주체\"란 처리되는 정보에 의하여 알아볼 수 있는 사람으로서 그 정보의 주체가 되는 사람을 말한다.",
  ),
  toFixtureDocument(
    "011357:3",
    "개인정보 보호법 제3조(개인정보 보호 원칙)",
    "제3조(개인정보 보호 원칙) ① 개인정보처리자는 개인정보의 처리 목적을 명확하게 하여야 하고 그 목적에 필요한 범위에서 최소한의 개인정보만을 적법하고 정당하게 수집하여야 한다.",
  ),
  toFixtureDocument(
    "011357:4",
    "개인정보 보호법 제4조(정보주체의 권리)",
    "제4조(정보주체의 권리) 정보주체는 자신의 개인정보 처리와 관련하여 다음 각 호의 권리를 가진다. 3. 개인정보의 처리 여부를 확인하고 개인정보에 대한 열람 및 전송을 요구할 권리",
  ),
  toFixtureDocument(
    "011357:16",
    "개인정보 보호법 제16조(개인정보의 수집 제한)",
    "제16조(개인정보의 수집 제한) ① 개인정보처리자는 제15조제1항 각 호의 어느 하나에 해당하여 개인정보를 수집하는 경우에는 그 목적에 필요한 최소한의 개인정보를 수집하여야 한다.",
  ),
  toFixtureDocument(
    "011357:17",
    "개인정보 보호법 제17조(개인정보의 제공)",
    "제17조(개인정보의 제공) ① 개인정보처리자는 다음 각 호의 어느 하나에 해당되는 경우에는 정보주체의 개인정보를 제3자에게 제공할 수 있다.",
  ),
  toFixtureDocument(
    "011357:18",
    "개인정보 보호법 제18조(개인정보의 목적 외 이용ㆍ제공 제한)",
    "제18조(개인정보의 목적 외 이용ㆍ제공 제한) ① 개인정보처리자는 개인정보를 제15조제1항에 따른 범위를 초과하여 이용하거나 제3자에게 제공하여서는 아니 된다.",
  ),
  toFixtureDocument(
    "011357:21",
    "개인정보 보호법 제21조(개인정보의 파기)",
    "제21조(개인정보의 파기) ① 개인정보처리자는 보유기간의 경과, 개인정보의 처리 목적 달성 등 그 개인정보가 불필요하게 되었을 때에는 지체 없이 그 개인정보를 파기하여야 한다.",
  ),
  toFixtureDocument(
    "011357:22",
    "개인정보 보호법 제22조(동의를 받는 방법)",
    "제22조(동의를 받는 방법) ① 개인정보처리자는 이 법에 따른 개인정보의 처리에 대하여 정보주체의 동의를 받을 때에는 각각의 동의 사항을 구분하여 알리고 동의를 받아야 한다.",
  ),
  toFixtureDocument(
    "011357:27",
    "개인정보 보호법 제27조(영업양도 등에 따른 개인정보의 이전 제한)",
    "제27조(영업양도 등에 따른 개인정보의 이전 제한) ① 개인정보처리자는 영업의 전부 또는 일부의 양도ㆍ합병 등으로 개인정보를 다른 사람에게 이전하는 경우에는 미리 해당 정보주체에게 알려야 한다.",
  ),
  toFixtureDocument(
    "011357:28-4",
    "개인정보 보호법 제28-4조(가명정보에 대한 안전조치의무 등)",
    "제28조의4(가명정보에 대한 안전조치의무 등) ① 개인정보처리자는 가명정보를 처리하는 경우에는 해당 정보가 분실ㆍ도난ㆍ유출ㆍ위조ㆍ변조 또는 훼손되지 않도록 안전성 확보에 필요한 조치를 하여야 한다.",
  ),
  toFixtureDocument(
    "011357:28-9",
    "개인정보 보호법 제28-9조(개인정보의 국외 이전 중지 명령)",
    "제28조의9(개인정보의 국외 이전 중지 명령) ① 보호위원회는 개인정보의 국외 이전이 계속되고 있거나 추가적인 국외 이전이 예상되는 경우 개인정보처리자에게 개인정보의 국외 이전을 중지할 것을 명할 수 있다.",
  ),
  toFixtureDocument(
    "011357:34",
    "개인정보 보호법 제34조(개인정보 유출 등의 통지ㆍ신고)",
    "제34조(개인정보 유출 등의 통지ㆍ신고) ① 개인정보처리자는 개인정보가 분실ㆍ도난ㆍ유출되었음을 알게 되었을 때에는 지체 없이 해당 정보주체에게 통지하여야 한다.",
  ),
  toFixtureDocument(
    "011357:36",
    "개인정보 보호법 제36조(개인정보의 정정ㆍ삭제)",
    "제36조(개인정보의 정정ㆍ삭제) ① 자신의 개인정보를 열람한 정보주체는 개인정보처리자에게 그 개인정보의 정정 또는 삭제를 요구할 수 있다.",
  ),
  toFixtureDocument(
    "011357:37",
    "개인정보 보호법 제37조(개인정보의 처리정지 등)",
    "제37조(개인정보의 처리정지 등) ① 정보주체는 개인정보처리자에 대하여 자신의 개인정보 처리의 정지를 요구하거나 개인정보 처리에 대한 동의를 철회할 수 있다.",
  ),
  toFixtureDocument(
    "011357:39",
    "개인정보 보호법 제39조(손해배상책임)",
    "제39조(손해배상책임) ① 정보주체는 개인정보처리자가 이 법을 위반한 행위로 손해를 입으면 개인정보처리자에게 손해배상을 청구할 수 있다.",
  ),
  toFixtureDocument(
    "011468:21",
    "개인정보 보호법 시행령 제21조(고유식별정보의 안전성 확보 조치)",
    "제21조(고유식별정보의 안전성 확보 조치) ① 법 제24조제3항에 따른 고유식별정보의 안전성 확보 조치에 관하여는 제30조를 준용한다.",
  ),
];
