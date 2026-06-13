# 人生好難：在艱難的生活中存活 21 天

一个生存模拟游戏。

## 本地运行

该项目为纯静态页面（ES Module），必须通过 HTTP 服务器启动，不支持直接双击 `index.html`。

### 方式一：Node.js（推荐）

```bash
npx serve .
```

### 方式二：Python

```bash
python3 -m http.server 8080
```

启动后浏览器打开 `http://localhost:8080` 即可游玩。

## 构建

```bash
node scripts/build-pages.mjs
```

输出到 `dist/` 目录。
