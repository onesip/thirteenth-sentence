import * as worlds from "./worlds-v2.js";
import * as fallback from "./fallback-v2.js";
import * as prompts from "./prompts-v2.js";
import * as validate from "./validate-v2.js";

const core = Object.freeze({ ...worlds, ...fallback, ...prompts, ...validate });

export async function loadV2Core() {
  return core;
}
