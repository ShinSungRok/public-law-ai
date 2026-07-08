import type { HttpResponse } from "./HttpResponse";
import type { RawHttpResponse } from "./RawHttpResponse";

export interface HttpResponseMapper {
  map(response: HttpResponse): RawHttpResponse;
}
