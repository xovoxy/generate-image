# Windows 编译说明

本文档说明如何在 Windows 电脑上把本项目编译成可运行的 `.exe` 程序。

## 1. 准备环境

在 Windows 上先安装：

- Node.js 20 或更新版本
- npm，安装 Node.js 时会自带
- Git，可选，用于拉取代码

建议使用 Windows 10/11 的 x64 系统。

## 2. 获取项目代码

把整个项目目录复制到 Windows，或者用 Git 拉取项目。

进入项目根目录后，确认能看到这些文件：

```text
package.json
package-lock.json
src/
electron/
index.html
```

## 3. 安装依赖

在项目根目录打开 PowerShell 或命令提示符，执行：

```bash
npm install
```

第一次安装会下载 Electron 和打包依赖，耗时会比较久。

## 4. 配置运行参数

项目运行需要 Coze 配置。可以在项目根目录创建 `.env` 文件：

```env
COZE_API_TOKEN=你的 Coze API Token
COZE_WORKFLOW_ID=你的 Workflow ID
```

可选配置：

```env
COZE_API_BASE=https://api.coze.cn
TASK_CONCURRENCY=2
COZE_WORKFLOW_TIMEOUT_MS=300000
COZE_WORKFLOW_POLL_INTERVAL_MS=3000
COZE_WORKFLOW_POLL_TIMEOUT_MS=600000
```

如果不创建 `.env`，也可以在 Windows 系统环境变量里配置 `COZE_API_TOKEN` 和 `COZE_WORKFLOW_ID`。

## 5. 本地开发运行

如果只是想先在 Windows 上运行调试：

```bash
npm run dev
```

该命令会启动 Vite 开发服务，并打开 Electron 桌面窗口。

## 6. 编译生产文件

只编译前端和 Electron 主进程，不生成 exe：

```bash
npm run build
```

成功后会生成：

```text
dist/
dist-electron/
```

## 7. 打包 Windows exe

生成 Windows 安装包和便携版：

```bash
npm run dist:win
```

构建成功后，产物在：

```text
release/
```

通常会包含：

```text
Generate Image Setup 0.1.0.exe
Generate Image 0.1.0.exe
```

其中：

- `Setup` 是安装包
- 另一个 `.exe` 是便携版，可直接运行

## 8. 快速检查打包目录

如果只想快速验证能否打出 Windows 程序目录，不生成安装包：

```bash
npm run pack:win
```

产物会在：

```text
release/win-unpacked/
```

可以进入该目录运行：

```text
Generate Image.exe
```

## 9. 常见问题

### 下载 Electron 很慢或失败

这是网络问题，`electron-builder` 需要下载 Electron 运行时。

可以重试：

```bash
npm run dist:win
```

如果一直失败，可以配置 npm 或系统代理后再执行。

### 打包后提示缺少 Coze 配置

确认已经配置：

```env
COZE_API_TOKEN
COZE_WORKFLOW_ID
```

桌面程序启动时会读取项目运行目录下的 `.env`，也会读取系统环境变量。

### 不要在 macOS 上提前打 Windows 包

后续既然要在 Windows 上编译 exe，macOS 这边只保留当前平台 Electron 即可。

在 Windows 上执行：

```bash
npm install
npm run dist:win
```

这样会自动下载 Windows 平台所需的 Electron。

