# 管理员 API 文档

## 概述

管理员 API 提供了完整的用户管理功能，包括权限设置、禁言、封禁等操作。

**基础路径：** `/api/v1/admin`

**权限要求：** 所有管理员 API 都需要管理员权限（`is_superuser: true`）

---

## API 端点

### 1. 设置用户头衔

```http
PUT /admin/users/{user_id}/title
```

**请求体：**
```json
{
  "title": "社区元老"
}
```

**响应：** 返回更新后的用户信息

---

### 2. 设置用户权限

```http
PUT /admin/users/{user_id}/role
```

**请求体：**
```json
{
  "is_superuser": true
}
```

**限制：** 
- 不能修改自己的权限
- 只有管理员可以调用

---

### 3. 禁言用户

```http
POST /admin/users/{user_id}/mute
```

**请求体：**
```json
{
  "reason": "发布违规内容"
}
```

**效果：**
- 用户无法创建帖子和评论
- `mute_count` 计数器 +1
- 不能禁言管理员
- 不能禁言自己

---

### 4. 取消禁言

```http
DELETE /admin/users/{user_id}/mute
```

**效果：** 恢复用户发布权限

---

### 5. 封禁用户

```http
POST /admin/users/{user_id}/ban
```

**请求体：**
```json
{
  "reason": "严重违规"
}
```

**效果：**
- 用户账户停用（`is_active: false`）
- 用户无法登录
- `ban_count` 计数器 +1
- 不能封禁管理员
- 不能封禁自己

---

### 6. 取消封禁

```http
DELETE /admin/users/{user_id}/ban
```

**效果：** 
- 恢复账户激活状态
- 用户可以重新登录

---

### 7. 删除用户

```http
DELETE /admin/users/{user_id}
```

**限制：**
- 不能删除管理员
- 不能删除自己
- 操作不可撤销

**响应：**
```json
{
  "message": "用户已删除"
}
```

---

### 8. 获取用户完整信息

```http
GET /admin/users/{user_id}
```

**响应：** 返回用户的完整信息，包括管理字段

```json
{
  "id": 1,
  "username": "张三",
  "email": "zhangsan@example.com",
  "is_active": true,
  "is_superuser": false,
  "title": "活跃用户",
  "is_muted": false,
  "is_banned": false,
  "mute_count": 0,
  "ban_count": 0,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

---

## 用户模型字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 用户ID |
| `username` | str | 用户名 |
| `email` | str | 邮箱 |
| `is_active` | bool | 账户是否激活 |
| `is_superuser` | bool | 是否为管理员 |
| `title` | str? | 用户头衔（自定义） |
| `is_muted` | bool | 是否被禁言 |
| `is_banned` | bool | 是否被封禁 |
| `mute_count` | int | 被禁言次数 |
| `ban_count` | int | 被封禁次数 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

---

## 权限验证

### 依赖函数

#### `get_current_superuser`
验证当前用户是否为管理员

#### `check_not_banned`  
验证用户是否被封禁

#### `check_not_muted`
验证用户是否被禁言（用于创建帖子、评论）

---

## 测试用例

### 1. 管理员登录
```bash
POST /api/v1/login/access-token
{
  "username": "admin@example.com",
  "password": "admin123"
}
```

### 2. 禁言普通用户
```bash
POST /api/v1/admin/users/1/mute
Authorization: Bearer {admin_token}
{
  "reason": "测试禁言"
}
```

### 3. 用户尝试发帖（应失败）
```bash
POST /api/v1/posts/
Authorization: Bearer {muted_user_token}
{
  "title": "测试帖子",
  "content": "内容"
}

# 响应: 403 账号已被禁言
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 403 | 权限不足 |
| 404 | 用户不存在 |

---

## 前端集成建议

1. **删除 localStorage 逻辑** - 移除 `adminMeta.js` 的本地存储
2. **创建 API 调用层** - 封装所有管理员 API
3. **更新 AdminPanel 组件** - 使用后端 API 替代本地数据
4. **处理禁言状态** - 在帖子列表过滤被封禁用户的内容

---

## 数据库迁移

运行以下命令重置数据库：

```bash
cd Amine-Web-fastapi
python actions/reset_db.py
python -m actions.create_test_data
```

---

**文档版本：** 1.0  
**更新时间：** 2026-02-11
