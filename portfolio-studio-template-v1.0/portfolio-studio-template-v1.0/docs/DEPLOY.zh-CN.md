# 部署与 GitHub 共享

## 发布源码模板

1. 在 GitHub 建一个新的空仓库，不继承个人网站的旧历史。
2. 上传本模板文件夹内的内容，或在本文件夹初始化 Git：`git init`、`git add .`、`git commit -m "Initial template"`，按 GitHub 新仓库页面给出的命令添加 remote 并推送。
3. 确认首页展示的是通用示例、没有环境变量文件及访客数据，再设为 public。
4. 在仓库 Settings → General 开启 Template repository，别人即可 Use this template。

MIT 许可证已包含。后续自行添加的素材需单独检查可再分发权。

## 只部署静态作品集

```sh
npm ci
npm run build
```

把 `dist/` 部署到支持目录索引的静态托管服务，或在托管服务连接仓库，设置构建命令 `npm run build`、输出目录 `dist`。默认从域名根路径 `/` 提供网站。项目名子目录部署（例如 GitHub Pages 的 `/repo/`）还需要统一处理 base、绝对资源路径和 URL 作用域，不能直接套用。

线上默认关闭心情入口，因为纯静态服务器没有 `/api/moods`。本地开发仍可测试全部贴纸功能。源文件不上传到 `dist`；编辑后要重新构建和发布。

## 可选：启用在线共享贴纸

现成业务逻辑是 `server/moods/api.js`，数据库结构在 `server/moods/schema.sql`，Worker 入口在 `server/moods/worker.js`。这部分需要在你自己的 Cloudflare 账户配置，模板没有资源 ID 或登录凭据。

1. 使用 Cloudflare 当前的 cf CLI 创建或配置 Workers 项目，参考 [项目配置](https://developers.cloudflare.com/cf/projects/cloudflare-config/) 与 [构建部署](https://developers.cloudflare.com/cf/projects/)。不要在个人账户已有项目里直接运行初始化命令。
2. 使用 Worker 入口，把静态 `dist/` 作为 `ASSETS`，将 D1 数据库绑定为 `MOODS`。让 `/api/*` 请求先经过 Worker，其他请求交给静态资产。
3. 在你的数据库执行 `schema.sql` 建表。只绑定名称和 ID，不把数据库内容、API token 或 OAuth 缓存提交到仓库。
4. 配置示例见 `deploy/cloudflare.config.example.ts`。它只描述运行时绑定，静态资产目录必须通过所选构建工具配置。cf CLI 为 beta，模板不会假装这个示例就是已经配好的跨平台一键部署器。
5. 把 `src/data/site.js` 的 `sharedMoods` 设为 `true`，重新构建。在线上实测提交、刷新后读取、本人缩放保存、其他访客不可修改、撤回和频率限制。

本模板对静态构建与本地贴纸做了验证；没有替你创建或测试任何远端数据库。纯静态分享不要求购买 Cloudflare 服务。

GitHub 官方说明：[Creating a template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)。
