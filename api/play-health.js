import { json, methodNotAllowed } from "../lib/http.js";
import { rolesForParty } from "../lib/play-core.js";
import { cloudConfigured, listPlayableArchives } from "../lib/storage.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const archives = cloudConfigured() ? await listPlayableArchives(5) : [];
    return json(res, 200, {
      ok: true,
      version: "enter-archive-survival-v1",
      twoModes: true,
      sceneCount: 5,
      partySizes: [1, 2, 3, 4],
      rolesForFour: rolesForParty(4),
      cloud: cloudConfigured(),
      playableArchiveCountSample: archives.length,
      hasPlayableArchives: archives.length > 0
    });
  } catch (error) {
    console.error("play health error", error);
    return json(res, 500, {
      ok: false,
      version: "enter-archive-survival-v1",
      error: String(error?.message || error)
    });
  }
}
