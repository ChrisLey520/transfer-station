# Claude Code - Windows

按照下面六个步骤完成 Windows 上的 Claude Code 客户端安装与 RelayHub 接入。我们推荐使用 Git Bash 运行客户端，它对路径、引号和类 Unix 命令的兼容性通常更稳定。

## 步骤 01：安装 Git Bash

建议先安装 Git for Windows，并在 Git Bash 中运行 Claude Code。

- 前往 [Git for Windows 官网](https://git-scm.com/download/win) 下载安装包。
- 使用默认选项完成安装。
- 安装完成后，从开始菜单打开 **Git Bash**。

> 已经安装 Git Bash 的用户可以跳过此步骤。

## 步骤 02：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。打开 PowerShell 或 Git Bash，先检查当前版本：

```bash
node --version
```

如果输出版本大于或等于 `18.0.0`，可以继续下一步。否则请安装 Node.js：

- 前往 [Node.js 官网](https://nodejs.org/) 下载 Windows LTS `.msi` 安装包。
- 使用默认选项完成安装。
- 安装后关闭并重新打开终端，让新的 `node` 和 `npm` 命令生效。

## 步骤 03：创建密钥

从侧边栏进入 [**密钥**](/keys) 页面，点击 **创建密钥**，为密钥填写一个便于识别的名称，然后复制生成的密钥。

密钥只会完整展示一次，请立即保存到安全位置。

> 请像保管密码一样保管密钥。任何拿到密钥的人都可以消耗你的额度。

## 步骤 04：安装 Claude Code 客户端

在 PowerShell、命令提示符或 Git Bash 中运行：

```bash
npm install -g @anthropic-ai/claude-code
```

安装完成后，系统会把 `claude` 命令注册到 `PATH` 中。建议关闭并重新打开终端后再继续。

## 步骤 05：创建配置文件

### 方案一（推荐）：使用 CC-Switch

[CC-Switch](https://ccswitch.io/zh/) 是开源的 AI 编程 CLI 统一管理工具，可集中管理 Claude Code、Codex 等客户端的供应商配置，并支持一键导入和切换，适合不想手动编辑配置文件的用户。

前往 [CC-Switch 官方下载页](https://ccswitch.io/zh/) 下载并安装适合当前系统的版本。

安装好 CC-Switch 后，回到 RelayHub 的 [**密钥**](/keys) 页面，在密钥右侧点击 **使用**，根据需要选择 **Claude Code** 或 **Codex**，再点击 **导入到 CC-Switch**。导入完成后，在 CC-Switch 中启用该配置即可使用。

### 方案二：手动创建 settings.json

Windows 上的配置文件路径为：

```text
C:\Users\<你的用户名>\.claude\settings.json
```

如果 `.claude` 文件夹还不存在，可以先运行一次 `claude`，让客户端自动创建目录，然后用下面内容创建 `settings.json`：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "YOUR_API_KEY",
    "ANTHROPIC_BASE_URL": "https://relayhub.chrisley.site/claude-code",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "apiKeyHelper": "echo 'YOUR_API_KEY'"
}
```

把两处 `YOUR_API_KEY` 都替换为步骤 03 中复制的密钥，其余配置保持不变。

> 如果文件资源管理器隐藏了以点开头的目录，可以直接在地址栏输入路径打开 `.claude` 文件夹。

## 步骤 06：启动客户端

重启终端，然后运行：

```bash
claude
```

注意：大模型由 Agent 决定。也就是说，你在 Claude Code / Codex 中选择的是什么模型，实际请求就会使用对应模型。

看到欢迎信息和输入提示符后，就可以开始让 Claude Code 执行第一条命令了。

## 常见问题

### 如何更新到最新版本？

#### 方案一（推荐）：使用 claude update 命令

在终端运行：

```bash
claude update
```

Claude Code 会自动检查并更新到最新版本。

此方案能最早更新到最新版本，但是受网络等因素的影响，更新可能会失败。此时可以多重试几次，如果依然失败，就尝试方案二。

#### 方案二：重新执行 npm 安装命令

重新执行安装命令，npm 会覆盖当前已安装版本。

```bash
npm install -g @anthropic-ai/claude-code
```

### 如何卸载？

运行全局卸载命令：

```bash
npm uninstall -g @anthropic-ai/claude-code
```

如需同时清理本地设置，可以删除 `%USERPROFILE%\.claude\` 目录。

### 安装时遇到网络错误怎么办？

可以切换到国内镜像源后重新安装，例如：

```bash
npm install -g @anthropic-ai/claude-code --registry https://registry.npmmirror.com
```
