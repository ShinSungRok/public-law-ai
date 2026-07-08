import { DefaultHttpRequestMapper } from "./DefaultHttpRequestMapper";
import type { RawHttpRequest } from "./RawHttpRequest";
import { UnsupportedHttpMethodError } from "./UnsupportedHttpMethodError";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const mapper = new DefaultHttpRequestMapper();

  const getRaw: RawHttpRequest = {
    method: "GET",
    path: "/health",
    headers: { "x-request-id": "abc-123" },
    query: { verbose: "true" },
    body: null,
  };
  const getMapped = mapper.map(getRaw);
  assertEqual(getMapped.method, "GET", "GET method mapping mismatch");

  const postRaw: RawHttpRequest = {
    method: "POST",
    path: "/rag/answer",
    headers: { "content-type": "application/json" },
    query: {},
    body: { query: "개인정보 보호" },
  };
  const postMapped = mapper.map(postRaw);
  assertEqual(postMapped.method, "POST", "POST method mapping mismatch");

  const patchRaw: RawHttpRequest = {
    method: "PATCH",
    path: "/documents/1",
    headers: {},
    query: {},
    body: { title: "updated" },
  };
  const patchMapped = mapper.map(patchRaw);
  assertEqual(patchMapped.method, "PATCH", "PATCH method mapping mismatch");

  let unsupportedMethodRejected = false;
  try {
    mapper.map({
      method: "TRACE",
      path: "/unsupported",
      headers: {},
      query: {},
      body: null,
    });
  } catch (error) {
    if (error instanceof UnsupportedHttpMethodError) {
      unsupportedMethodRejected = true;
    } else {
      throw error;
    }
  }
  if (!unsupportedMethodRejected) {
    throw new Error("Unsupported HTTP method was not rejected");
  }

  assertEqual(
    getMapped.headers["x-request-id"],
    "abc-123",
    "headers not preserved",
  );
  assertEqual(getMapped.query.verbose, "true", "query not preserved");
  assertEqual(
    JSON.stringify(postMapped.body),
    JSON.stringify(postRaw.body),
    "body not preserved",
  );
  assertEqual(getMapped.path, getRaw.path, "path not preserved");

  console.log("HTTP request mapper validation succeeded.");
}

main();
