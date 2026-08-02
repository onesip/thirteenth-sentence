import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sessionHandler from "../api/session.js";
import directorHandler from "../api/director.js";
import archivesHandler from "../api/archives.js";
import healthHandler from "../api/health.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const apiRoutes = {
  "/api/session": sessionHandler,
  "/api/director": directorHandler,
  "/api/archives": archivesHandler,
  "/api/health": healthHandler
};
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gz": "application/gzip"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (apiRoutes[url.pathname]) return apiRoutes[url.pathname](req, res);

    let requested = url.pathname;
    if (requested === "/" || requested.startsWith("/archive/")) requested = "/index.html";
    const target = path.resolve(root, `.${requested}`);
    if (!target.startsWith(root)) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    const data = await fs.readFile(target);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[path.extname(target)] || "application/octet-stream");
    res.end(data);
  } catch (error) {
    if (error?.code === "ENOENT") {
      res.statusCode = 404;
      return res.end("Not found");
    }
    console.error(error);
    res.statusCode = 500;
    res.end("Internal error");
  }
});

server.listen(port, () => {
  console.log(`第十三句本地服务：http://localhost:${port}`);
  if (!process.env.DEEPSEEK_API_KEY) console.log("未配置 DEEPSEEK_API_KEY：将使用本地叙事导演。");
  if (!process.env.SUPABASE_URL) console.log("未配置 Supabase：旧档案只保存在浏览器本地。");
});
