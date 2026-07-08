import { ApiErrorMapper } from "../api/ApiErrorMapper";
import { InvalidRagRequestError } from "../api/InvalidRagRequestError";

async function main(): Promise<void> {
  const errorMapper = new ApiErrorMapper();

  const invalidRagRequestResponse = errorMapper.map(
    new InvalidRagRequestError("query must not be empty"),
  );
  console.log(
    `Invalid rag request error: ${JSON.stringify(invalidRagRequestResponse)}`,
  );

  const unknownErrorResponse = errorMapper.map(new Error("unexpected failure"));
  console.log(`Unknown error: ${JSON.stringify(unknownErrorResponse)}`);
}

main();
