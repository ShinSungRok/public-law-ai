import type { HttpClient } from "./HttpClient";

export class FetchHttpClient implements HttpClient {
  async get(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request to ${url} failed with status ${response.status}`);
    }
    return response.text();
  }
}
