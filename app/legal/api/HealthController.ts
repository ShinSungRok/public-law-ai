import type { HealthStatusDto } from "./HealthStatusDto";

const SERVICE_NAME = "public-law-ai";

export class HealthController {
  async check(): Promise<HealthStatusDto> {
    return {
      status: "UP",
      service: SERVICE_NAME,
    };
  }
}
