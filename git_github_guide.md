# 将代码推送到 GitHub 指南

## 一、已完成的本地Git配置

✅ 已初始化Git仓库：`git init`
✅ 已配置.gitignore文件（排除node_modules、dist、.env等）
✅ 已提交代码到本地仓库：`git commit -m "Initial commit: 德州扑克后端项目"`

## 二、在GitHub上创建新仓库

1. 打开GitHub官网：https://github.com
2. 登录您的GitHub账号
3. 点击右上角的 **+** 按钮，选择 **New repository**

4. 填写仓库信息：
   - **Repository name**: 建议使用 `poker-backend` 或其他有意义的名称
   - **Description**: 德州扑克后端项目（可选）
   - **Visibility**: 根据需要选择 **Public** 或 **Private**
   - **Initialize this repository with**: 不要勾选任何选项（我们已经有本地代码）

5. 点击 **Create repository**

## 三、关联本地仓库与GitHub远程仓库

创建仓库后，复制页面上显示的Git URL（HTTPS或SSH格式）。

### 1. 添加远程仓库

在终端中执行以下命令（将URL替换为您的GitHub仓库URL）：

```bash
# HTTPS格式（推荐，无需额外配置）
git remote add origin https://github.com/your_username/poker-backend.git

# 或SSH格式（需要配置SSH密钥）
git remote add origin git@github.com:your_username/poker-backend.git
```

### 2. 推送代码到GitHub

执行以下命令将本地代码推送到GitHub的master分支：

```bash
git push -u origin master
```

- `-u` 参数：将origin设为默认远程仓库，master设为默认分支
- 首次推送需要输入GitHub账号密码（HTTPS方式）或确认SSH密钥（SSH方式）

## 四、验证推送结果

在GitHub仓库页面刷新，您应该能看到：
- 所有源代码文件（除了.gitignore中排除的文件）
- 提交记录显示 "Initial commit: 德州扑克后端项目"
- 项目结构与本地一致

## 五、后续开发工作流

1. **修改代码后提交**：
   ```bash
   git add .
   git commit -m "描述您的修改内容"
   ```

2. **推送更新**：
   ```bash
   git push
   ```

3. **拉取最新代码**（如果有多人协作）：
   ```bash
   git pull
   ```

## 六、常见问题解决

### 1. 推送时出现403错误

这通常是权限问题，请确保：
- 使用正确的GitHub账号密码
- 如果是私有仓库，您有该仓库的推送权限

### 2. SSH连接问题

如果使用SSH方式，请确保已配置SSH密钥：
```bash
# 检查是否有SSH密钥
ls -la ~/.ssh

# 如果没有，生成新密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 将公钥添加到GitHub
cat ~/.ssh/id_ed25519.pub
```
然后将输出的公钥添加到GitHub的SSH设置中。

### 3. 分支名称问题

如果GitHub默认分支是main而不是master：
```bash
# 本地重命名分支
git branch -m main

# 推送并设置上游
git push -u origin main
```

## 七、项目当前状态

您的德州扑克后端项目包含：
- Express.js + TypeScript 后端框架
- PostgreSQL 数据库配置与初始化
- Redis 缓存服务
- WebSocket 实时通信
- AI 手牌分析功能
- 完整的游戏逻辑

现在所有代码已经准备好推送到GitHub，开始您的协作开发之旅吧！