# Zzzの聚合图标站 -

![图片1](QQ20260104-134922.png)


一个用于聚合多个 Gist 链接的图标站点，支持图标的同步更新与分享。可以输入多个 Gist 链接，生成一个聚合后的 JSON 链接，方便管理和查看图标。

## 功能

- **聚合 Gist 链接**：支持合并多个 Gist 中的图标数据，生成一个新的聚合链接。
- **定时更新**：定时从 Gist 更新图标数据，缓解流控。

## 使用说明

### 部署到 Cloudflare Workers

1. 登录到 [Cloudflare Workers](https://workers.cloudflare.com/)。
2. 创建一个新的 Worker 项目。
3. 将 [worker.js](https://github.com/Zzzwannasleep/EmbyIconAggregationStation/raw/refs/heads/main/worker.js) 文件内容复制到你的 Worker 脚本中。
4. 部署并将 Worker 绑定到你的域名。

### 创建和绑定 KV 存储

在 Cloudflare Workers 中，使用 **KV 存储** 来保存每个 Gist 的聚合结果和配置数据。这里是如何创建和绑定 KV 存储的步骤：

#### 1. 创建 KV 存储

1. 在 Cloudflare Workers 仪表盘中，点击你的 Worker 项目。
2. 在 Worker 项目页面，点击左侧的 **"KV"** 选项。
3. 点击 **"Create a KV Namespace"**，为你的 KV 存储创建一个新的命名空间，命名为 `DB` 或任何你喜欢的名字。
4. 点击 **"Save"** 保存命名空间。

#### 2. 绑定 KV 存储到 Worker

1. 在 Cloudflare Workers 项目的页面，点击左侧的 **"Settings"**。
2. 在 **"KV Namespace Bindings"** 部分，点击 **"Add Binding"**。
3. 将 **Namespace** 设置为你刚才创建的 KV 存储命名空间，并将 **Binding Name** 设置为 `DB`。
4. 保存设置。

这样就完成了 KV 存储的创建和绑定。

### 配置数据库

你可以通过 Cloudflare Workers 配置的 KV 存储来保存每个聚合的数据。此项目会在数据库中存储每个 Gist 的聚合结果，使用合成链接进行分享。

## 如何使用

1. **粘贴 Gist 链接**：进入主页，在文本框中输入多个 Gist 链接，每行一个。
2. **生成聚合链接**：点击 **生成聚合链接** 按钮，会返回一个新的链接，指向合并后的 JSON 数据。
3. **更新同步数据**：点击 **更新同步数据** 按钮，定期同步并更新聚合的图标数据。

## 项目架构

- **前端**：HTML + CSS（页面美化）
- **后端**：Cloudflare Workers + KV 存储
- **图标来源**：来自多Gist 链接
