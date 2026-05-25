import { createServer } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

async function main() {
  const server = await createServer({
    plugins: [tanstackStart({ server: { entry: "./src/server.ts" } })],
    server: { middlewareMode: false },
  });

  // Test the fetch handler directly
  const { default: serverEntry } = await server.environments.ssr.runner.import(
    "virtual:tanstack-start-server-entry",
  );
  console.log("Server entry fetch:", typeof serverEntry.fetch);

  // Test a request
  const req = new Request("http://localhost:5173/");
  try {
    const response = await serverEntry.fetch(req);
    const text = await response.text();
    console.log("Response status:", response.status);
    console.log("Response text length:", text.length);
    console.log("First 200 chars:", text.slice(0, 200));
  } catch (e) {
    console.log("Error:", e.message);
  }

  await server.close();
}
main().catch((e) => console.error("Error:", e));
