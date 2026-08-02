import { rolesForParty } from "./play-core.js";

function hasText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}

function validOptions(options) {
  return Array.isArray(options)
    && options.length >= 3
    && options.every((option) => hasText(option?.label) && hasText(option?.action));
}

function validScene(scene) {
  return scene
    && typeof scene === "object"
    && hasText(scene.title)
    && Array.isArray(scene.narration)
    && scene.narration.filter(hasText).length >= 2
    && validOptions(scene.options);
}

export function assertBlueprintQuality(data) {
  const first = data?.publicOpening?.firstScene;
  const plan = data?.scenePlan;
  const valid = hasText(data?.privateBible?.actualIdentity)
    && hasText(data?.publicOpening?.publicIdentity)
    && validScene(first)
    && Array.isArray(plan)
    && plan.length === 4
    && plan.every(validScene);
  if (!valid) {
    const error = new Error("BLUEPRINT_INCOMPLETE");
    error.retryable = false;
    throw error;
  }
  return data;
}

export function adaptBlueprintParty(blueprint, partySize) {
  const roles = rolesForParty(partySize);
  const clone = JSON.parse(JSON.stringify(blueprint));
  if (clone?.publicOpening?.firstScene) clone.publicOpening.firstScene.turnRole = roles[0];
  if (Array.isArray(clone?.scenePlan)) {
    clone.scenePlan.forEach((scene, index) => {
      scene.turnRole = roles[(index + 1) % roles.length];
    });
  }
  return clone;
}
