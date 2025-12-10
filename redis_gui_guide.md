# Redis GUI 客户端 - Medis 使用指南

## 一、Medis 已成功安装

Medis（Redis GUI客户端）已通过 Homebrew 成功安装到您的 macOS 系统中：
- 安装路径：`/Applications/Medis.app`
- 版本：2.16.1（最新稳定版）

## 二、连接到 Redis 服务器

### 1. 打开 Medis 应用

从 Applications 文件夹中找到 **Medis** 并打开，或使用 Spotlight 搜索 "Medis" 快速启动。

### 2. 创建 Redis 连接

首次打开 Medis 时，您需要创建一个新的 Redis 连接：

#### 步骤 1：点击 "Create Connection"

在 Medis 主界面，点击左上角的 **+** 按钮或 "Create Connection" 按钮。

#### 步骤 2：配置连接参数

在弹出的连接配置窗口中，输入以下信息：

| 参数 | 值 | 说明 |
|------|-----|------|
| Name | Localhost | 连接名称（可自定义） |
| Host | localhost | Redis 服务器地址 |
| Port | 6379 | Redis 端口（默认） |
| Database | 0 | Redis 数据库索引（默认使用 0） |
| Password | （留空） | Redis 密码（当前未设置） |

#### 步骤 3：保存并连接

点击 **Save & Connect** 按钮，Medis 将尝试连接到您的 Redis 服务器。

## 三、使用 Medis 管理 Redis 数据

连接成功后，您将看到 Medis 的主界面，包含以下功能区域：

### 1. 导航栏（左侧）

- **连接列表**：显示所有已配置的 Redis 连接
- **数据库列表**：显示当前连接的所有数据库（默认 16 个数据库）
- **键列表**：显示当前数据库中的所有 Redis 键

### 2. 编辑区域（右侧）

- **键值编辑**：查看和编辑键值对
- **命令行工具**：执行 Redis 命令
- **统计信息**：查看 Redis 服务器状态

### 3. 常用操作

#### 查看键值对

1. 在左侧导航栏中，选择一个数据库（如 Database 0）
2. 在键列表中，点击任意键名，右侧将显示该键的值

#### 执行 Redis 命令

1. 点击顶部菜单栏的 **Command** 按钮
2. 在命令输入框中输入 Redis 命令，如：
   ```
   SET mykey "Hello World"
   GET mykey
   KEYS *
   ```
3. 按 Enter 键执行命令，结果将显示在下方

#### 管理键

- **创建键**：点击顶部菜单栏的 **+** 按钮，选择键类型（String、List、Set 等）
- **编辑键**：选择键后，在右侧编辑区域修改值
- **删除键**：选择键后，点击顶部菜单栏的 **-** 按钮

## 四、验证 Redis 连接

### 1. 检查 Redis 服务状态

在 Medis 主界面，点击顶部菜单栏的 **Status** 按钮，您将看到 Redis 服务器的详细状态信息，包括：

- 服务器版本
- 内存使用情况
- 客户端连接数
- 数据库信息
- 键统计

### 2. 测试数据读写

1. 使用 Command 工具执行以下命令：
   ```
   SET poker_test_key "德州扑克 Redis 测试"
   GET poker_test_key
   ```

2. 如果命令执行成功并返回正确结果，说明 Redis 连接和数据操作正常。

## 五、与德州扑克后端集成

您的德州扑克后端系统已经配置为使用 Redis 作为缓存和会话存储。通过 Medis，您可以：

1. **查看游戏会话数据**：监控当前活跃的游戏会话
2. **分析缓存性能**：查看 Redis 内存使用情况
3. **调试连接问题**：检查 Redis 客户端连接数
4. **管理临时数据**：查看和清理过期的缓存键

## 六、注意事项

1. **Redis 服务状态**：确保 Redis 服务正在运行（`brew services start redis`）
2. **连接参数**：如果您修改了 Redis 配置文件（`/opt/homebrew/etc/redis.conf`），请相应调整 Medis 连接参数
3. **权限问题**：确保当前用户有权限访问 Redis 服务

## 七、其他 Redis GUI 客户端（可选）

如果 Medis 不适合您的需求，您还可以安装其他 Redis GUI 客户端：

1. **RedisInsight**（官方推荐）：
   ```bash
   brew install --cask redisinsight
   ```

2. **Another Redis Desktop Manager**：
   ```bash
   brew install --cask another-redis-desktop-manager
   ```

---

现在您可以使用 Medis 轻松管理和监控 Redis 数据了！如果您在使用过程中遇到任何问题，请随时咨询。