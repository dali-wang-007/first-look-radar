# 初见雷达——你给陌生人的第一印象

对照片可见的表情呈现、造型、姿态、构图与光线进行趣味视觉解读。没有综合颜值分、群体排名或真实人格推断。

| 入口 | 用途 |
|---|---|
| https://first-look-radar.dali-wang-007.workers.dev | 完整网站：账号、上传、真实AI、历史报告、PNG导出 |
| https://dali-wang-007.github.io/first-look-radar/ | GitHub Pages公开示例，无照片上传和账号处理 |

## 本地开发

需要Node 22+和已授权的Cloudflare账号。

```sh
npm ci
npx wrangler d1 migrations apply first-look-radar-db --local
npm run dev
```

本地AI绑定也调用远端Cloudflare Workers AI，可能产生推理用量。测试默认不调用模型。

```sh
npm test
npm run test:browser
npm run build:pages
```

## 部署

GitHub Pages从`gh-pages`分支发布，使用现有GitHub授权即可，无需额外工作流授权。更新公开示例：

```sh
node scripts/deploy-pages.mjs
```

Cloudflare完整应用发布：

```sh
npx wrangler whoami
npx wrangler d1 migrations apply first-look-radar-db --remote
npm run deploy
```

`wrangler.jsonc`含非秘密的账号/数据库标识和额度配置，不含模型密钥。使用Cloudflare原生AI绑定，无需浏览器侧API密钥。更换账号部署时，需要创建自己的D1数据库并更新绑定。

## 产品与数据

详见[测评结果方案](docs/测评结果方案.md)。原图不写入应用数据库、对象存储或应用日志。Cloudflare承担基础设施和模型处理，适用其数据处理条款。云端保存账号及文字报告；支持报告删除、密码更新、账号删除。分享图本地生成，默认不含照片。

首版免费：每账号每天3次成功测评，全站每天最多30次进入模型（失败也计入全站用量，失败释放个人额度）。每天按UTC日期重置。登录采用用户名和密码，不验证邮箱，暂不支持邮箱找回。生产模型对图片质量和描述的判断仍可能有偏差。

## 技术

原生HTML/CSS/ES模块、Cloudflare Workers静态资源、D1、Workers AI Llama 4 Scout。会话使用HttpOnly/Secure/SameSite cookie、令牌哈希、7天有效期；密码使用随机盐与PBKDF2-SHA256、100000轮。测试包括真实SQLite行为测试和后台Playwright浏览器测试。
