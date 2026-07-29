import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import { ProductionServerRuntime } from "./ProductionServerRuntime";

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

function registerShutdownHandlers(runtime: ProductionServerRuntime): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, async () => {
      await runtime.stop();
      console.log(`public-law-ai server stopped after receiving ${signal}`);
      process.exit(0);
    });
  }
}

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(new DefaultApplicationContextFactory());
  const runtime = new ProductionServerRuntime(bootstrap);

  await runtime.start();
  await runtime.listen();

  const { host, port } = runtime.getContext().applicationConfiguration.server;

  console.log(`public-law-ai server listening on http://${host}:${port}`);

  registerShutdownHandlers(runtime);
}

main();
