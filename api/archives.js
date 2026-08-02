import { json, methodNotAllowed } from "../lib/http.js";
import { archiveStats, cloudConfigured, getArchiveBySlug } from "../lib/storage.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!cloudConfigured()) {
    return json(res, 200, { cloudMode: "not-configured", legacyCount: 0 });
  }
  try {
    const url = new URL(req.url, "http://localhost");
    const slug = url.searchParams.get("slug");
    if (slug) {
      const archive = await getArchiveBySlug(slug);
      if (!archive) return json(res, 404, { error: "没有找到这份封存档案。" });
      return json(res, 200, {
        cloudMode: "supabase",
        archive: archive.final_archive,
        slug: archive.share_slug,
        createdAt: archive.created_at
      });
    }
    const stats = await archiveStats();
    return json(res, 200, { cloudMode: "supabase", ...stats });
  } catch (error) {
    console.error("archives error", error);
    return json(res, 500, { error: "旧档案暂时无法读取。" });
  }
}
