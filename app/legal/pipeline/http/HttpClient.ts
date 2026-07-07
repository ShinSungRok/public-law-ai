export interface HttpClient {
  get(url: string): Promise<string>;
}
