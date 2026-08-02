import { loadV2Core } from "../lib/v2-core-loader.js";
import { json, methodNotAllowed } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const core = await loadV2Core();
    const worlds = Array.isArray(core.WORLD_PROFILES) ? core.WORLD_PROFILES : [];
    return json(res, 200, {
      ok: worlds.length >= 6,
      version: "archive-multiverse-v2",
      worldCount: worlds.length,
      worlds: worlds.map((world) => ({ key: world.key, name: world.name })),
      soloToFourPlayers: true,
      storyFirstArchives: true
    });
  } catch (error) {
    return json(res, 500, { ok: false, version: "archive-multiverse-v2", error: String(error?.message || error).slice(0, 300) });
  }
}
