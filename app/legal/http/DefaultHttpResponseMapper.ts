import type { HttpResponse } from "./HttpResponse";
import type { HttpResponseMapper } from "./HttpResponseMapper";
import type { RawHttpResponse } from "./RawHttpResponse";

export class DefaultHttpResponseMapper implements HttpResponseMapper {
  map(response: HttpResponse): RawHttpResponse {
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  }
}
