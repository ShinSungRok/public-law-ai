export class InvalidRagRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRagRequestError";
  }
}
