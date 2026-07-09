import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import { ProductionServerRuntime } from "./ProductionServerRuntime";

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(new DefaultApplicationContextFactory());
  const runtime = new ProductionServerRuntime(bootstrap);

  await runtime.start();

  const { host, port } = runtime.getContext().applicationConfiguration.server;

  console.log(`public-law-ai server started on ${host}:${port}`);
}

main();
