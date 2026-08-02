import { json, methodNotAllowed } from "../lib/http.js";
import { cloudConfigured } from "../lib/storage.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  return json(res, 200, {
    ok: true,
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    cloud: cloudConfigured(),
    stateEncryption: Boolean(process.env.SESSION_SECRET || process.env.DEEPSEEK_API_KEY),
    fastModel: process.env.DEEPSEEK_FAST_MODEL || "deepseek-v4-flash",
    proModel: process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro",
    experienceVersion: "create-enter-immersive-v3",
    visualSystem: "archive-noir-v2",
    twoModes: true,
    enterArchive: {
      enabled: true,
      scenes: 5,
      partySizes: [1, 2, 3, 4],
      butterflyChoices: true,
      identityReveal: true,
      ruleByRuleEnding: true,
      aiStrategy: "quality-blueprint-local-final",
      plannedAiCallsPerFreshGame: 2,
      plannedAiCallsWithCachedBlueprint: 1,
      intermediateScenes: "local-causal-engine",
      thinkingMode: false,
      blueprintQualityGate: true,
      compactRecovery: true,
      reusableAiBlueprintCache: true,
      genericSilentFallback: false
    }
  });
}
