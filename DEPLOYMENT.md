# 上线步骤

代码已经按 Vercel 零依赖项目准备，不需要安装 Next.js 或其他包。

## A. GitHub

创建空仓库：

```text
onesip/thirteenth-sentence
```

不要添加 README 或模板。创建完成后，将完整项目推入仓库。

## B. Supabase

1. 新建 Supabase 项目。
2. 打开 SQL Editor。
3. 粘贴并运行 `supabase/schema.sql`。
4. 在 Project Settings → API 复制：
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

`service_role` 只能放在 Vercel 服务端环境变量，不能放到浏览器或聊天公开信息中。

## C. Vercel

1. Add New → Project。
2. 导入 `onesip/thirteenth-sentence`。
3. Framework Preset 选择 `Other`；不需要 Build Command。
4. 添加环境变量：

```text
DEEPSEEK_API_KEY=你创建的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_PRO_MODEL=deepseek-v4-pro
SESSION_SECRET=至少32位随机字符串
SUPABASE_URL=Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=Supabase service_role key
DAILY_AI_LIMIT=1000
```

5. 环境勾选 Production、Preview、Development。
6. Deploy。

上线后访问：

```text
https://你的域名/api/health
```

预期：

```json
{
  "ok": true,
  "deepseek": true,
  "cloud": true,
  "stateEncryption": true
}
```

## D. 验收

- 1 人完整玩一局；
- 3 人局确认第三位需要写最后批注；
- 查看“逐条解读”和“官方真相”；
- 复制分享链接，在无痕窗口打开；
- 从分享档案开启新分支；
- 新一局首页旧档案数量增加。
