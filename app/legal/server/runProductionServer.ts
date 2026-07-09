import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(new DefaultApplicationContextFactory());
  const context = bootstrap.bootstrap();

  const { host, port } = context.applicationConfiguration.server;

  console.log(`public-law-ai server started on ${host}:${port}`);
}

main();
