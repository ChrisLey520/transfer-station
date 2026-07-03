# Codex / Windows 向导

按照下面七个步骤完成 Windows 上的 Codex CLI 安装与 RelayHub 接入。完成后，你可以在任意项目目录中启动 Codex，也可以继续配合 VSCode 官方插件使用。

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

如果 `.codex` 目录已经存在，请先删除后重新创建。可以在文件资源管理器中操作，也可以在 PowerShell 中执行：

```powershell
Remove-Item -Recurse -Force ~\.codex -ErrorAction SilentlyContinue
New-Item -ItemType Directory ~\.codex
```

后续路径中的 `<your-username>` 请替换为你的实际 Windows 用户名。

## 步骤 03：获取 API 密钥

前往仪表板的 **API 密钥** 页面，创建一个新密钥并复制。

> 密钥只会完整展示一次，请立即保存到安全位置。

## 步骤 04：创建 auth.json

在下面路径中删除已有的 `auth.json`，然后新建同名文件：

```text
C:\Users\<your-username>\.codex\auth.json
```

文件内容如下：

```json
{
  "OPENAI_API_KEY": "YOUR_API_KEY"
}
```

将 `YOUR_API_KEY` 替换为步骤 03 中复制的密钥。

## 步骤 05：创建 config.toml

在下面路径中删除已有的 `config.toml`，然后新建同名文件：

```text
C:\Users\<your-username>\.codex\config.toml
```

文件内容如下：

```toml
model_provider = "freemodel"
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
disable_response_storage = true
preferred_auth_method = "apikey"

[model_providers.freemodel]
name = "freemodel"
base_url = "https://api.freemodel.dev"
wire_api = "responses"
```

以上配置请原样粘贴，不要修改任何值。

## 步骤 06：重启终端并验证安装

重启终端后运行下面的命令，确认 Codex CLI 已正确安装。

```bash
codex -V
```

如果终端输出版本号，就说明安装成功。

## 步骤 07：开始使用 Codex

进入任意项目目录，然后启动 Codex。

```bash
# Navigate to project
cd your-project-folder

# Launch Codex
codex
```

Codex 完全支持 VSCode 官方插件，你可以根据自己的工作流选择终端或编辑器内使用。
