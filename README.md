# Zzzの聚合图标站 - 极致加速+图标统计版

一个用于聚合多个 Gist 链接的图标站点，支持图标的同步更新与分享。可以输入多个 Gist 链接，生成一个聚合后的 JSON 链接，方便管理和查看图标。

## 功能

- **聚合 Gist 链接**：支持合并多个 Gist 中的图标数据，生成一个新的聚合链接。
- **定时更新**：定时从 Gist 更新图标数据，缓解Gist流控。

## 使用说明

### 部署到 Cloudflare Workers

1. 登录到 [Cloudflare Workers](https://workers.cloudflare.com/)。
2. 创建一个新的 Worker 项目。
3. 将 `worker.js` 文件内容复制到你的 Worker 脚本中。
4. 配置 Cloudflare Workers，以允许跨域请求和定时任务。
5. 部署并将 Worker 绑定到你的域名。

### 配置数据库

你可以通过 Cloudflare Workers 配置的 KV 存储来保存每个聚合的数据。此项目会在数据库中存储每个 Gist 的聚合结果，使用合成链接进行分享。

## 如何使用

1. **粘贴 Gist 链接**：进入主页，在文本框中输入多个 Gist 链接，每行一个。
2. **生成聚合链接**：点击 **生成聚合链接** 按钮，会返回一个新的链接，指向合并后的 JSON 数据。
3. **更新同步数据**：点击 **更新同步数据** 按钮，定期同步并更新聚合的图标数据。

## 项目架构

- **前端**：HTML + CSS（页面美化）
- **后端**：Cloudflare Workers + KV 存储
- **图标来源**：来自多个 Gist 链接

## 安装与运行

### 1. 克隆仓库到本地

```bash
git clone https://github.com/username/repository-name.git
cd repository-name
