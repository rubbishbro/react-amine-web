# Amine Web - 前端项目

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置后端 API
项目已包含开发环境配置 `.env.development`：
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

**重要**：确保后端服务已启动在 `http://127.0.0.1:8000`

### 3. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:5173

### 4. 生产构建
```bash
npm run build
npm run preview
```

## ⚙️ 环境配置

- **`.env.development`** - 开发环境（已配置，指向本地后端）
- **`.env.production`** - 生产环境（需要修改为实际域名）
- **`.env.local`** - 本地覆盖（可选，不提交）

## 🔧 常见问题

### ❌ 前端看不到帖子数据

**症状**：页面正常显示，但没有任何帖子

**原因**：
1. 后端服务未启动
2. CORS 配置错误
3. API 地址不正确

**解决方法**：
```bash
# 1. 确保后端运行
cd ../Amine-Web-fastapi
uvicorn app.main:app --reload

# 2. 检查浏览器控制台（F12）
#    - Network 标签页查看 API 请求是否成功
#    - Console 标签页查看是否有错误信息

# 3. 验证 API 地址
#    打开 .env.development 确认：
#    VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### 🌐 CORS 跨域错误

如果看到 `CORS policy` 相关错误：
1. 确保后端 `app/main.py` 中 CORS 配置包含 `http://localhost:5173`
2. 重启后端服务使配置生效

### 📄 帖子详情页加载失败

**症状**：点击帖子后显示"帖子不存在"或加载失败

**已修复**（2026-02-11）：
- `loadPostContent` 现在会从后端 API 获取帖子详情
- 添加了数据格式转换，兼容后端返回的格式
- 优先级：本地草稿 → 后端 API → 本地缓存

**验证修复**：
1. 确保前端已重启：`npm run dev`
2. 清空浏览器缓存或按 `Ctrl+Shift+R` 强制刷新
3. 点击任意帖子应该能正常打开

### 🧹 清空本地缓存

如果遇到数据显示异常，可以清空缓存：

**方法 1：使用清理工具（推荐）**

在浏览器控制台 (F12 → Console) 输入：

```javascript
// 查看本地帖子状态
inspectLocalPosts()

// 清理已发布的本地帖子（保留草稿）
cleanPublishedLocalPosts()

// 清空所有本地帖子（包括草稿）
clearAllLocalPosts()

// 清空远程缓存（下次刷新从后端重新获取）
clearRemoteCache()

// 查看帮助
storageHelp()
```

**方法 2：手动清空**

```javascript
// 在浏览器控制台运行
localStorage.clear();
location.reload();
```

或只清空特定缓存：
```javascript
localStorage.removeItem('aw_posts_cache');  // 远程帖子缓存
localStorage.removeItem('aw_local_posts');  // 本地帖子
location.reload();
```

### 📝 本地帖子管理规则

**重要**: 系统现在自动区分本地草稿和后端帖子：

- ✅ **草稿** (`is_published=false`) - 保存在本地，可以继续编辑
- ✅ **已发布** - 自动提交到后端，本地副本自动清理
- ⚠️ 如果本地有 `is_published=true` 的帖子，会被自动清理

**原理**:
- 草稿 → 本地存储 → 方便编辑
- 发布 → 提交后端 → 本地清理 → 只从后端显示
- 避免本地/远程数据混淆

## 📡 API 集成

### 数据获取流程
1. **从后端获取** - `loadAllPosts()` 自动调用后端 API
2. **本地缓存** - 数据缓存到 localStorage
3. **离线支持** - 后端不可用时使用缓存

### API 服务使用
```javascript
import PostAPI from './services/getpostfromback.js';

const api = new PostAPI();
const posts = await api.getPostsLists();  // 获取帖子列表
const post = await api.getPostById(id);   // 获取单个帖子
```

---

# 项目结构

项目架构如下

```
Amine-Web-react    #前端项目目录
│  .env.development
│  .env.production
│  .gitignore
│  eslint.config.js
│  index.html
│  package-lock.json
│  package.json
│  README.md
│  vite.config.js
│
├─node_modules
│
├─public
│      BackGround.png
│      e.jpg
│      favicon.ico
│
└─src
    │  App.css
    │  App.jsx
    │  index.css
    │  main.jsx
    │
    ├─pages
    │  ├─about
    │  │      about.css
    │  │      about.js
    │  │      about.jsx
    │  │
    │  ├─activities
    │  │      activities.css
    │  │      activities.js
    │  │      activities.jsx
    │  │
    │  ├─admin
    │  │      AdminPanel.module.css
    │  │      index.jsx
    │  │
    │  ├─amine
    │  │      amine.css
    │  │      amine.js
    │  │      amine.jsx
    │  │
    │  ├─blacklist
    │  │      Blacklist.module.css
    │  │      index.jsx
    │  │
    │  ├─community
    │  │      index.css
    │  │      index.js
    │  │      index.jsx
    │  │
    │  ├─components
    │  │  ├─CreatePostButton
    │  │  │      CreatePostButton.module.css
    │  │  │      index.jsx
    │  │  │
    │  │  ├─Post
    │  │  │      index.jsx
    │  │  │      Post.module.css
    │  │  │
    │  │  ├─PostDetail
    │  │  │      index.jsx
    │  │  │      PostDetail.module.css
    │  │  │
    │  │  ├─PostEditor
    │  │  │      index.jsx
    │  │  │      PostEditor.module.css
    │  │  │      utils.js
    │  │  │
    │  │  ├─PostList
    │  │  │      index.jsx
    │  │  │      PostList.module.css
    │  │  │
    │  │  ├─ScrollToTop
    │  │  │      index.jsx
    │  │  │      ScrollToTop.module.css
    │  │  │
    │  │  ├─SearchResults
    │  │  │      index.jsx
    │  │  │      SearchResults.module.css
    │  │  │
    │  │  └─UserPanel
    │  │          index.jsx
    │  │          UserPanel.module.css
    │  │
    │  ├─config
    │  │      api.js
    │  │      colors.js
    │  │      index.js
    │  │      markdown.css
    │  │
    │  ├─context
    │  │      UserContext.jsx
    │  │
    │  ├─derivativeworks
    │  │      derivativeworks.css
    │  │      derivativeworks.js
    │  │      derivativeworks.jsx
    │  │
    │  ├─favorites
    │  │      index.css
    │  │      index.jsx
    │  │
    │  ├─forum
    │  │      forum.css
    │  │      forum.js
    │  │      forum.jsx
    │  │
    │  ├─login
    │  │      index.jsx
    │  │      Login.module.css
    │  │
    │  ├─messages
    │  │      index.jsx
    │  │      Messages.module.css
    │  │
    │  ├─musicgames
    │  │      musicgames.css
    │  │      musicgames.js
    │  │      musicgames.jsx
    │  │
    │  ├─profile
    │  │      index.jsx
    │  │      Profile.module.css
    │  │      ProfileView.jsx
    │  │      PublicProfile.jsx
    │  │      PublicProfile.module.css
    │  │
    │  ├─resources
    │  │      resources.css
    │  │      resources.js
    │  │      resources.jsx
    │  │
    │  ├─tech
    │  │      tech.css
    │  │      tech.js
    │  │      tech.jsx
    │  │
    │  └─utils
    │          adminMeta.js
    │          blockStore.js
    │          colorUtils.js
    │          followStore.js
    │          notifications.js
    │          postLoader.js
    │          postReadTime.js
    │          postStats.js
    │          userId.js
    │
    ├─services
    │      auth.js
    │      getpostfromback.js
    │
    └─utils
            cleanStorage.js
```