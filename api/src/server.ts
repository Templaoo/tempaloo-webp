import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: "0.0.0.0" });
