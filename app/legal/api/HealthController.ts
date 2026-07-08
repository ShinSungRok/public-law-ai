import type { ApiConfiguration } from "../server/ApiConfiguration";
import type { HealthStatusDto } from "./HealthStatusDto";

export class HealthController {
  constructor(private readonly configuration: ApiConfiguration) {}

  async check(): Promise<HealthStatusDto> {
    return {
      status: "UP",
      service: this.configuration.serviceName,
    };
  }
}
