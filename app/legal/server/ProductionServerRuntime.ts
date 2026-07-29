import type { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import type { ApplicationContext } from "../composition/ApplicationContext";
import { NodeHttpFastifyLikeServer } from "../http/NodeHttpFastifyLikeServer";
import type { ServerRuntime } from "./ServerRuntime";

export class ProductionServerRuntime implements ServerRuntime {
  private context: ApplicationContext | undefined;
  private server: NodeHttpFastifyLikeServer | undefined;

  constructor(private readonly bootstrap: ApplicationBootstrap) {}

  async start(): Promise<void> {
    if (this.context) {
      return;
    }
    this.context = this.bootstrap.bootstrap();
  }

  /**
   * Binds a real, socket-listening HTTP server for the route registry
   * composed in the ApplicationContext. Separate from start() so that
   * consumers which only need the composed context (e.g. the Next.js
   * /api/ask route, which calls the RAG controller in-process) never bind
   * a competing listener on the same host/port.
   */
  async listen(overridePort?: number): Promise<number> {
    if (!this.context) {
      throw new Error("ProductionServerRuntime must be started before it can listen");
    }
    if (this.server) {
      return this.server.getPort();
    }

    const server = new NodeHttpFastifyLikeServer();
    this.context.httpAdapter.registerRoutes(server);

    const { host, port } = this.context.applicationConfiguration.server;
    await server.listen(host, overridePort ?? port);

    this.server = server;
    return server.getPort();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = undefined;
    }
  }

  getContext(): ApplicationContext {
    if (!this.context) {
      throw new Error("ProductionServerRuntime has not been started");
    }
    return this.context;
  }
}
