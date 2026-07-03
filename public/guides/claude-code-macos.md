# Claude Code / MacOS 向导

按照下面五个步骤完成 macOS 上的 Claude Code 客户端安装与 RelayHub 接入。完成后，你就可以让 AI 执行第一条命令。

## 步骤 01：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。先在终端检查当前版本：

```bash
node --version
```

如果输出版本大于或等于 `18.0.0`，可以直接进入下一步。否则任选一种方式安装 Node.js：

- 前往 [Node.js 官网](https://nodejs.org/) 下载 LTS 安装包。
- 或者通过 [Homebrew](https://brew.sh/) 安装：

```bash
brew install node
```

> 已经安装 Node.js 18+ 的用户可以跳过此步骤。

## 步骤 02：创建 API 密钥

从侧边栏进入 **API 密钥** 页面，点击 **创建密钥**，为密钥填写一个便于识别的名称，然后复制生成的密钥。

密钥只会完整展示一次，请立即保存到安全位置。

> 请像保管密码一样保管 API 密钥。任何拿到密钥的人都可以消耗你的额度。

## 步骤 03：安装 Claude Code 客户端

在终端运行 npm 全局安装命令：

```bash
npm install -g @anthropic-ai/claude-code
```

安装完成后，系统会把 `claude` 命令注册到 `PATH` 中。如果终端提示找不到命令，请重启终端后再试。

## 步骤 04：创建 settings.json

Claude Code 会从 `~/.claude/settings.json` 读取配置。如果 `~/.claude/` 目录还不存在，可以先运行一次 `claude` 让客户端自动创建目录，然后写入下面的配置：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "YOUR_API_KEY",
    "ANTHROPIC_BASE_URL": "https://cc.freemodel.dev",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "apiKeyHelper": "echo 'YOUR_API_KEY'"
}
```

把两处 `YOUR_API_KEY` 都替换为步骤 02 中复制的 API 密钥。

## 步骤 05：启动客户端

重启终端，让新配置生效，然后运行：

```bash
claude
```

看到欢迎信息和输入提示符后，就可以开始让 Claude Code 执行第一条命令了。

## 常见问题

### 如何更新到最新版本？

重新执行安装命令即可，npm 会覆盖当前已安装版本。

```bash
npm install -g @anthropic-ai/claude-code
```

### 如何卸载？

运行全局卸载命令：

```bash
npm uninstall -g @anthropic-ai/claude-code
```

如需同时清理本地设置，可以删除 `~/.claude/` 目录。

### 安装时遇到网络错误怎么办？

可以切换到国内镜像源后重新安装，例如：

```bash
npm install -g @anthropic-ai/claude-code --registry https://registry.npmmirror.com
```
