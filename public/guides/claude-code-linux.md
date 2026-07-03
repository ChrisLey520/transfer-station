# Claude Code / Linux 向导

按照下面五个步骤完成 Linux 上的 Claude Code 客户端安装与 RelayHub 接入。不同发行版的 Node.js 安装命令略有差异，请按你的系统选择对应方式。

## 步骤 01：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。先检查当前版本：

```bash
node --version
```

如果输出版本大于或等于 `18.0.0`，可以直接进入下一步。否则按发行版选择安装方式。

### Ubuntu / Debian

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### CentOS / RHEL / Fedora

```bash
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
```

### Arch Linux

```bash
sudo pacman -S nodejs npm
```

### openSUSE

```bash
sudo zypper install nodejs npm
```

如果你的发行版不在上面，也可以前往 [Node.js 官网](https://nodejs.org/) 下载 LTS 二进制包。

## 步骤 02：创建 API 密钥

从侧边栏进入 **API 密钥** 页面，点击 **创建密钥**，为密钥填写一个便于识别的名称，然后复制生成的密钥。

密钥只会完整展示一次，请立即保存到安全位置。

> 请像保管密码一样保管 API 密钥。

## 步骤 03：安装 Claude Code 客户端

运行 npm 全局安装命令：

```bash
npm install -g @anthropic-ai/claude-code
```

如果遇到 `EACCES` 权限错误，可以临时使用 `sudo`，也可以参考 [npm 官方说明](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)，把 npm 全局前缀配置到你拥有权限的目录。

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

打开一个新的 Shell，让配置生效，然后运行：

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
