import { json, methodNotAllowed } from "../lib/http.js";
import { cloudConfigured, listPlayableArchives } from "../lib/storage.js";

function summarize(row) {
  const archive = row.final_archive || {};
  const rules = Array.isArray(archive.rules) ? archive.rules : [];
  return {
    id: row.id,
    slug: row.share_slug,
    code: row.archive_code,
    title: archive.title || row.title,
    preface: archive.preface || archive.oneLineTruth || "一份尚未被真正走过的封存档案。",
    ruleCount: rules.length,
    worldChange: archive.worldState?.change || archive.worldChange || archive.worldConsequence || "进入者的选择会继续改变它。",
    createdAt: row.created_at
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!cloudConfigured()) return json(res, 200, { ok: true, archives: [], cloud: false });
  try {
    const rows = await listPlayableArchives(18);
    return json(res, 200, {
      ok: true,
      cloud: true,
      archives: rows.map(summarize),
      note: rows.length ? null : "还没有完成封存的共创档案。先完成一局共创，就会在这里出现。"
    });
  } catch (error) {
    console.error("play catalog error", error);
    return json(res, 500, { ok: false, error: "暂时无法读取可进入的档案。" });
  }
}
