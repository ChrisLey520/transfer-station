# Codex - MacOS/Linux

按照下面六个步骤完成 MacOS 或 Linux 上的 Codex CLI 安装与 RelayHub 接入。完成后，你可以在任意项目目录中启动 Codex，也可以继续配合 VSCode 官方插件使用。

## 步骤 01：安装 Codex CLI

任选一种方式全局安装官方 Codex CLI。

```bash
npm install -g @openai/codex
```

或者，如果你的环境已经安装 Homebrew，也可以使用：

```bash
brew install codex
```

两种方式安装的是同一个 Codex CLI 包，选择更适合你当前环境的方式即可。

## 步骤 02：创建 .codex 目录

在终端中重新创建 Codex 配置目录。

```bash
rm -rf ~/.codex
mkdir ~/.codex
```

## 步骤 03：获取密钥

前往仪表板的 [**密钥**](/keys) 页面，创建一个新密钥并复制。

> 密钥只会完整展示一次，请立即保存到安全位置。

## 步骤 04：创建配置文件

### 方案一（推荐）：使用 CC-Switch

[CC-Switch](https://ccswitch.io/zh/) 是开源的 AI 编程 CLI 统一管理工具，可集中管理 Codex、Claude Code 等客户端的供应商配置，并支持一键导入和切换，适合不想手动编辑配置文件的用户。

前往 [CC-Switch 官方下载页](https://ccswitch.io/zh/) 下载并安装适合当前系统的版本。

安装好 CC-Switch 后，回到 RelayHub 的 [**密钥**](/keys) 页面，在密钥右侧点击 **使用**，根据需要选择 **Codex** 或 **Claude Code**，再点击 **导入到 CC-Switch**。导入完成后，在 CC-Switch 中启用该配置即可使用。

### 方案二：手动创建 auth.json 和 config.toml

在 `~/.codex` 路径下删除已有的 `auth.json`，然后新建同名文件并写入：

```json
{
  "OPENAI_API_KEY": "YOUR_API_KEY"
}
```

将 `YOUR_API_KEY` 替换为步骤 03 中复制的密钥。

在 `~/.codex` 路径下删除已有的 `config.toml`，然后新建同名文件并写入：

```toml
model_provider = "freemodel"
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
disable_response_storage = true
preferred_auth_method = "apikey"

[model_providers.freemodel]
name = "freemodel"
base_url = "https://relayhub.chrisley.site/codex/v1"
wire_api = "responses"
```

以上配置已使用 RelayHub 的正式访问地址，其余配置保持不变。

## 步骤 05：重启终端并验证安装

重启终端后运行下面的命令，确认 Codex CLI 已正确安装。

```bash
codex -V
```

如果终端输出版本号，就说明安装成功。

## 步骤 06：开始使用 Codex

进入任意项目目录，然后启动 Codex。

```bash
# Navigate to project
cd your-project-folder

# Launch Codex
codex
```

注意：大模型由 Agent 决定。也就是说，你在 Claude Code / Codex 中选择的是什么模型，实际请求就会使用对应模型。

Codex 完全支持 VSCode 官方插件，你可以根据自己的工作流选择终端或编辑器内使用。
