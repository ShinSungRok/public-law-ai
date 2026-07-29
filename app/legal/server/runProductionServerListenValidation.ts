import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import { ProductionServerRuntime } from "./ProductionServerRuntime";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(new DefaultApplicationContextFactory());
  const runtime = new ProductionServerRuntime(bootstrap);

  await runtime.start();

  console.log("[server] Binding a real socket-listening server on an ephemeral port...");
  const port = await runtime.listen(0);
  assertTruthy(port > 0, "listen() did not return a bound port");

  console.log(`[server] Sending a real HTTP request to GET http://127.0.0.1:${port}/health...`);
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assertEqual(response.status, 200, "GET /health did not return 200 over a real socket");

  const body = (await response.json()) as { status: string };
  assertEqual(body.status, "UP", "GET /health body did not report status UP");

  console.log("[server] Sending a real HTTP request to an unregistered route...");
  const notFound = await fetch(`http://127.0.0.1:${port}/does-not-exist`);
  assertEqual(notFound.status, 404, "unregistered route did not return 404");

  console.log("[server] Checking listen() is idempotent...");
  const secondPort = await runtime.listen(0);
  assertEqual(secondPort, port, "calling listen() twice should not rebind the server");

  await runtime.stop();

  console.log("[server] Confirming the socket was released after stop()...");
  let refusedAfterStop = false;
  try {
    await fetch(`http://127.0.0.1:${port}/health`);
  } catch {
    refusedAfterStop = true;
  }
  assertTruthy(refusedAfterStop, "server still accepted connections after stop()");

  console.log("Production server listen validation succeeded.");
}

main();
