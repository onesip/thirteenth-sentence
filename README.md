# 第十三句

一个不要求等待其他人的匿名共创叙事游戏。

无论现场只有 1、2、3 人，每一局都会立即开始并完整结束。玩家留下的句子会成为当前故事的剧情锚点；封存后，获得许可的句子会进入旧档案库，后来者可能在新的完整游戏中重新读到、反驳或改变它。

## 当前版本

- 规则怪谈主题：《雨巷十三号住户须知》
- 1–3 人现场模式
- 两次自由写作、两次剧情决定
- 三人局的第三位玩家会留下最后批注
- DeepSeek V4 Flash：过程导演
- DeepSeek V4 Pro：隐藏真相与终局解读
- DeepSeek 上下文缓存优化：固定导演协议前置、同局故事圣经复用、动态玩家内容后置
- DeepSeek 不可用时自动使用本地叙事导演
- Supabase：云端会话、封存档案、旧碎片与限流
- Vercel：静态网页与无依赖 Serverless API
- 无前端 API Key，不暴露隐藏真相

## 本地运行

项目没有第三方运行依赖，只需要 Node.js 20+。

```bash
cp .env.example .env
npm run dev
```

打开 `http://localhost:3000`。

没有设置任何密钥时，网页仍能完整游玩；它会使用本地叙事导演，并把旧碎片保存在浏览器中。

## 环境变量

```text
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_PRO_MODEL=deepseek-v4-pro
DEEPSEEK_CACHE_DEBUG=false
SESSION_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
DAILY_AI_LIMIT=1000
```

- `DEEPSEEK_API_KEY`：开启动态叙事。
- `SESSION_SECRET`：在没有数据库或数据库短暂不可用时，加密整局私密状态。
- `SUPABASE_URL` / `SUPABASE_SECRET_KEY`：开启跨设备旧档案与封存分享。旧项目也兼容 `SUPABASE_SERVICE_ROLE_KEY`。
- 所有敏感值只放在 Vercel Environment Variables，绝不能写进 `game.js` 或提交到 GitHub。

## 验证

```bash
npm run check
npm test
```

## 主要目录

```text
api/                 Vercel 服务端函数
lib/                 DeepSeek、叙事提示词、状态加密、云端存储
supabase/schema.sql  数据库结构与 RLS
index.html            游戏入口
styles.css            沉浸式界面
 game.js              前端流程与本地降级导演
legacy-next/          较早的 Next.js 原型，仅作留档
```

## DeepSeek 缓存与费用

DeepSeek 的上下文硬盘缓存默认开启，不需要另开服务。本项目额外做了请求结构优化：

1. 所有调用都以完全一致的“导演协议”开头，跨玩家复用公共提示词。
2. 同一局的隐藏故事圣经放在阶段指令之前，后续步骤尽量命中同局缓存。
3. 玩家句子、选择和变化内容全部放在末尾，避免破坏前缀。
4. 过程调用限制为较短的 Flash JSON，只有开局和终局使用 Pro。
5. API 返回的 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` 会累计保存在私密会话状态中。

部署初期可把 `DEEPSEEK_CACHE_DEBUG=true`，然后在 Vercel Function Logs 查看命中率；稳定后建议关闭，减少日志噪音。
