# 初见雷达 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User authorized design, implementation and both deployments in this chat.

**Goal:** 交付可登录、真实分析照片并导出报告的初见雷达网站。

**Architecture:** 原生ES模块前端和Cloudflare Worker同源部署。D1存账号、会话、报告和原子配额；Workers AI处理图像；GitHub Pages为无登录的公开示例。

**Tech Stack:** JavaScript、CSS、Cloudflare Workers/D1/Workers AI、Wrangler、Node test runner、Playwright。

**Spec:** docs/测评结果方案.md

## Global Constraints

- 所有浏览器操作隐藏运行；不打开可见浏览器。
- 不推断人格/心理/能力，不伪造陌生人反应或精确排名。
- 不保存原照片；AI失败明确报错；示例有标识。
- GitHub Pages不处理登录或真实照片；Cloudflare托管完整应用。
- 不传递或打印秘密值。使用已有GitHub登录与Wrangler授权。

## Review Focus

- 非图像伪装MIME、超长内容与不可辨识照片：拒绝或请求重传。
- 其他账号的记录与已注销会话：服务端拒绝访问。
- 模型输出缺字段、虚构人格或非法刻度：不展示伪报告。
- 并发请求和模型失败：不突破配额，失败释放占用。
- 移动端上传、加载失败、下载图像：始终可返回重试。

### Task 1: 测评与安全核心

**Files:** server/analysis.js、server/security.js、tests/core.test.js、migrations/0001_init.sql

**Interfaces:** validateInput(body)验证数据；validateReport(report)验证模型输出；hashPassword/verifyPassword处理密码。

- [ ] 先写输入、报告、密码的行为测试，运行`npm test`确认失败。
- [ ] 实现核心模块与数据表，运行`npm test`通过。
- [ ] 提交核心变更。

### Task 2: 账号和真实分析API

**Files:** server/index.js、tests/api.test.js、wrangler.jsonc

**Interfaces:** Worker.fetch(request,env)提供/api/health、auth、reports、analyze；消费Task 1校验和D1结构。

- [ ] 以真实本地D1执行账号、权限、配额与异常路径集成测试，先观察失败。
- [ ] 实现HttpOnly会话、原子配额、Workers AI调用及报告持久化。
- [ ] 测试账号隔离、删除、改密、AI错误与配额失败后释放。
- [ ] 提交API。

### Task 3: 网站与分享

**Files:** public/index.html、public/style.css、public/app.js、public/report.js、public/demo.js、scripts/build-pages.mjs、tests/browser.spec.js

**Interfaces:** 前端消费Task 2的同源API；report.js绘图与本地PNG导出；Pages构建剥离账号和真实分析。

- [ ] 写浏览器关键用户流程测试，确认未实现时失败。
- [ ] 实现首页、上传、登录、报告、历史、账号和本地分享卡。
- [ ] 运行桌面/移动端、输入失败与导出验证。
- [ ] 提交网站。

### Task 4: 部署与验证

**Files:** .github/workflows/pages.yml、README.md、docs/部署记录.md

- [ ] 创建独立GitHub仓库并推送；启用Pages且核对网址。
- [ ] 核对Cloudflare认证；创建独立D1、迁移、部署Worker与资源。
- [ ] 验证在线登录、真实AI和报告，不对演示模式冒充完成。
- [ ] 完整运行测试，独立代码审查并修复重要问题。
- [ ] 写部署记录，交付网址和确切限制。
