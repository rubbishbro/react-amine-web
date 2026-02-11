# 前端头衔显示实施指南

## 问题分析

前端已有头衔显示UI，但依赖 localStorage 的 `adminMeta`。后端已扩展 User 模型包含 `title` 字段，需要前端适配。

---

## 实施方案

### 方案1：最简单 - 使用后端数据（推荐）

后端 User API 已经返回 `title` 字段，前端只需确保使用这个字段。

#### 修改 `buildTagInfo` 函数

**文件：** `src/pages/utils/adminMeta.js`

```javascript
export const buildTagInfo = (author, meta) => {
    if (!author && !meta) return null;
    
    // 优先使用 author 对象中的 tagInfo（如果已经构建好）
    const fromAuthor = resolveAuthorTag(author);
    if (fromAuthor) return fromAuthor;
    
    // 从后端数据获取
    const isAdmin = author?.is_superuser === true;
    const title = (author?.title || meta?.title || '').trim();
    
    if (title) {
        return {
            label: title,
            variant: isAdmin ? 'admin' : 'user',
        };
    }
    
    // 管理员默认显示"管理员"
    if (isAdmin) {
        return { label: '管理员', variant: 'admin' };
    }
    
    return null;
};
```

**关键改动：**
- 使用 `author?.is_superuser` 代替 `meta.role === 'admin'`
- 使用 `author?.title` 优先于 `meta?.title`
- 移除对 localStorage 的依赖

---

### 方案2：完全移除 localStorage

如果想完全移除 localStorage 逻辑：

#### 1. 简化 Post 组件

**文件：** `src/pages/components/Post/index.jsx`

**修改前（第 57-69 行）：**
```javascript
const authorInfo = typeof post.author === 'object' && post.author !== null
  ? post.author
  : { name: post.author || '匿名' };
const authorLinkId = getMappedUserId(authorInfo.id || '');
const hasAuthorLink = !!authorLinkId;
const authorMetaId = authorLinkId || authorInfo.id || '';
const [authorMeta, setAuthorMeta] = useState(() => readAdminMeta(authorMetaId));

useEffect(() => {
  setAuthorMeta(readAdminMeta(authorMetaId));
}, [authorMetaId]);

const tagInfo = useMemo(() => buildTagInfo(authorInfo, authorMeta), [authorInfo, authorMeta]);
```

**修改后：**
```javascript
const authorInfo = typeof post.author === 'object' && post.author !== null
  ? post.author
  : { name: post.author || '匿名' };
const authorLinkId = getMappedUserId(authorInfo.id || '');
const hasAuthorLink = !!authorLinkId;

// 直接从后端数据构建 tagInfo，不依赖 localStorage
const tagInfo = useMemo(() => buildTagInfo(authorInfo, null), [authorInfo]);
```

#### 2. 确保后端返回完整用户信息

在获取帖子时，确保 author 包含完整字段：

**后端 Post Schema 应该包含：**
```python
class Post(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    author: Optional[User] = None  # 关联的完整用户对象
    # ...其他字段
```

---

## 测试步骤

### 1. 修改后端测试数据

确保测试用户有头衔：

```bash
cd Amine-Web-fastapi
python -m actions.create_test_data
```

### 2. 给用户设置头衔

使用管理员 API：

```bash
# 登录管理员账号获取 token
POST /api/v1/login/access-token
{
  "username": "admin@example.com",
  "password": "admin123"
}

# 设置用户头衔
PUT /api/v1/admin/users/1/title
Authorization: Bearer {token}
{
  "title": "活跃用户"
}
```

### 3. 前端验证

刷新帖子列表，应该能看到用户名旁边显示头衔标签。

---

## 显示逻辑

**前端已有的显示代码（Post 组件 123-127 行）：**

```jsx
{isViewerLoggedIn && tagInfo && (
  <span className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}>
    {tagInfo.label}
  </span>
)}
```

**显示规则：**
1. 用户已登录 → 显示头衔
2. 有自定义头衔 → 显示自定义头衔
3. 是管理员且无自定义头衔 → 显示 "管理员"
4. 普通用户无头衔 → 不显示标签

**样式变体：**
- `variant: 'admin'` → 粉红色渐变（管理员）
- `variant: 'user'` → 浅粉色（普通用户）

---

## 需要修改的文件

### 必须修改
1. ✅ `src/pages/utils/adminMeta.js` - 修改 `buildTagInfo` 函数

### 可选修改（推荐）
2. ✅ `src/pages/components/Post/index.jsx` - 移除 localStorage 依赖
3. ✅ `src/pages/components/PostDetail/index.jsx` - 同样的修改
4. ✅ `src/pages/profile/ProfileView.jsx` - 如果显示用户信息

### 可删除（未来清理）
- `src/pages/utils/adminMeta.js` 中的 `readAdminMeta`, `writeAdminMeta` 等函数

---

## 快速实施代码

### 修改 adminMeta.js

```javascript
// 新版 buildTagInfo - 使用后端数据
export const buildTagInfo = (author, meta = null) => {
    if (!author) return null;
    
    // 检查是否已有预构建的 tagInfo
    if (author.tagInfo) {
        return typeof author.tagInfo === 'object' 
            ? author.tagInfo 
            : { label: author.tagInfo, variant: 'user' };
    }
    
    // 从用户对象构建
    const isAdmin = author.is_superuser === true;
    const title = (author.title || '').trim();
    
    if (title) {
        return {
            label: title,
            variant: isAdmin ? 'admin' : 'user',
        };
    }
    
    if (isAdmin) {
        return { label: '管理员', variant: 'admin' };
    }
    
    return null;
};
```

### 修改 Post 组件

```javascript
// 移除 localStorage 相关代码
const authorInfo = typeof post.author === 'object' && post.author !== null
  ? post.author
  : { name: post.author || '匿名' };

const tagInfo = useMemo(() => buildTagInfo(authorInfo), [authorInfo]);
```

---

## 完成后效果

- ✅ 头衔数据存储在数据库
- ✅ 管理员可以通过 API 设置头衔
- ✅ 前端自动显示后端返回的头衔
- ✅ 不再依赖浏览器 localStorage
- ✅ 多设备、多浏览器数据同步

---

**实施建议：先采用方案1（最小改动），确保功能正常后再考虑完全移除 localStorage。**
