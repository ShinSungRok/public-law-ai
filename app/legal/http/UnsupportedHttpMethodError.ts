export class UnsupportedHttpMethodError extends Error {
  constructor(method: string) {
    super(`Unsupported HTTP method: ${method}`);
    this.name = "UnsupportedHttpMethodError";
  }
}
