import { DefaultHttpResponseMapper } from "./DefaultHttpResponseMapper";
import type { HttpResponse } from "./HttpResponse";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const mapper = new DefaultHttpResponseMapper();

  const response: HttpResponse = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { answer: "이 법은 개인정보 보호를 목적으로 한다." },
  };

  const rawResponse = mapper.map(response);

  assertEqual(
    rawResponse.statusCode,
    response.statusCode,
    "statusCode not preserved",
  );
  assertEqual(
    rawResponse.headers["content-type"],
    response.headers["content-type"],
    "headers not preserved",
  );
  assertEqual(
    JSON.stringify(rawResponse.body),
    JSON.stringify(response.body),
    "body not preserved",
  );

  console.log("HTTP response mapper validation succeeded.");
}

main();
