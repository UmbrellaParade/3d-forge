import { defineConfig } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900
  },
  plugins: [saveConfigPlugin()]
});

function saveConfigPlugin() {
  return {
    name: "3d-forge-save-config",
    configureServer(server) {
      server.middlewares.use("/api/save-config", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1_000_000) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: "Config is too large." }));
            req.destroy();
          }
        });

        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const content = `${JSON.stringify(payload, null, 2)}\n`;
            const configPath = join(rootDir, "configs", "fix_requests.json");
            const runtimePath = join(rootDir, "public", "runtime", "fix_requests.json");

            await mkdir(dirname(configPath), { recursive: true });
            await mkdir(dirname(runtimePath), { recursive: true });
            await writeFile(configPath, content, "utf8");
            await writeFile(runtimePath, content, "utf8");

            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                saved_at: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
                files: ["configs/fix_requests.json", "public/runtime/fix_requests.json"]
              })
            );
          } catch (error) {
            server.config.logger.error(error);
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "Could not save config." }));
          }
        });
      });
    }
  };
}
