import { defineConfig } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900
  },
  plugins: [configApiPlugin()]
});

function configApiPlugin() {
  return {
    name: "3d-forge-config-api",
    configureServer(server) {
      addConfigRoute(server, "/api/save-config", async (payload) => {
        const files = ["configs/fix_requests.json", "public/runtime/fix_requests.json"];
        await writeJsonFiles(files, payload);
        return files;
      });

      addConfigRoute(server, "/api/export-config", async (payload) => {
        const files = ["output/fix_requests.json"];
        await writeJsonFiles(files, payload);
        return files;
      });
    }
  };
}

function addConfigRoute(server, route, handler) {
  server.middlewares.use(route, (req, res, next) => {
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
        sendJson(res, { error: "Config is too large." });
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const files = await handler(payload);
        sendJson(res, {
          ok: true,
          saved_at: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
          files
        });
      } catch (error) {
        server.config.logger.error(error);
        res.statusCode = 400;
        sendJson(res, { error: "Could not write config JSON." });
      }
    });
  });
}

async function writeJsonFiles(files, payload) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  for (const file of files) {
    const target = join(rootDir, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

function sendJson(res, payload) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}
