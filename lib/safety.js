const URL_RE = /https?:\/\/|www\./i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const HIGH_RISK_PATTERNS = [/未成年.{0,12}(性|裸|色情)/i, /(杀死|伤害|袭击).{0,12}(真实|现实|本人|老板|同事|老师|邻居)/i, /(身份证|护照号|银行卡号|家庭住址|住址是)/i];
export function validateContribution(value, { min = 6, max = 120 } = {}) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < min) throw new Error(`这条记录至少需要${min}个字。`);
  if (text.length > max) throw new Error(`这条记录最多保留${max}个字。`);
  if (URL_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text)) throw new Error("请不要在档案中填写链接、邮箱、电话或其他可识别信息。");
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(text))) throw new Error("这句话包含档案馆无法公开保存的内容，请换一种虚构写法。");
  if (/^(.)\1{8,}$/.test(text)) throw new Error("这条记录看起来像重复字符，请重新写一句。");
  return text;
}
export function sanitizeShortText(value, max = 90) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
