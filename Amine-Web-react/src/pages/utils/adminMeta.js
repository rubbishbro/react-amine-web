/**
 * adminMeta.js
 *
 * 管理员元数据辅助模块。
 *
 * ⚠️ 迁移说明：
 *   - 所有写操作（禁言/封禁/设头衔/设权限/删除用户）已迁移至后端 API（services/adminApi.js）
 *   - 本文件仅保留 UI 辅助函数（buildTagInfo）和从后端用户对象读取状态的工具函数
 *   - localStorage 中的 aw_admin_meta_* 数据已废弃，不再写入；读取仅作向后兼容降级
 */

// ──────────────────────────────────────────────
// Tag 辅助
// ──────────────────────────────────────────────

const resolveAuthorTag = (author) => {
    if (!author) return null;
    const raw = author.tagInfo || author.tag;
    if (!raw) return null;
    if (typeof raw === 'string') {
        const label = raw.trim();
        if (!label) return null;
        return { label, variant: author.isAdmin === true ? 'admin' : 'user' };
    }
    if (typeof raw === 'object') {
        const label = (raw.label || raw.title || '').trim();
        if (!label) return null;
        return {
            label,
            variant: raw.variant || (author.isAdmin === true ? 'admin' : 'user'),
        };
    }
    return null;
};

/**
 * 根据用户对象和可选的元数据构建 tagInfo
 * author 支持前端字段（isAdmin）和后端字段（is_superuser）
 */
export const buildTagInfo = (author, meta = null) => {
    if (!author) return null;

    // 如果已有预构建的 tagInfo
    if (author.tagInfo) {
        return typeof author.tagInfo === 'object'
            ? author.tagInfo
            : { label: author.tagInfo, variant: 'user' };
    }

    // 从后端用户对象构建（使用后端字段名）
    const isAdmin = author.is_superuser === true || author.isAdmin === true;
    const title = (meta?.title || author.title || '').trim();

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

// ──────────────────────────────────────────────
// 状态读取（从后端用户对象，不再依赖 localStorage）
// ──────────────────────────────────────────────

/**
 * 检查用户是否被禁言
 * @param {string|number} _userId - 保留参数以兼容旧调用方（未使用）
 * @param {object|null} backendUser - 后端返回的用户对象
 */
export const isUserMuted = (_userId, backendUser = null) => {
    if (backendUser) return backendUser.is_muted === true;
    return false;
};

/**
 * 检查用户是否被封禁
 * @param {string|number} _userId - 保留参数以兼容旧调用方（未使用）
 * @param {object|null} backendUser - 后端返回的用户对象
 */
export const isUserBanned = (_userId, backendUser = null) => {
    if (backendUser) return backendUser.is_banned === true;
    return false;
};

/**
 * 获取用户的限制状态（禁言/封禁）
 * 需传入 backendUser 才能获得真实状态，否则返回全 false。
 * @param {string|number} _userId - 保留参数以兼容旧调用方
 * @param {object|null} backendUser - 后端返回的用户对象（可选）
 * @returns {{ isMuted: boolean, isBanned: boolean }}
 */
export const getUserRestrictions = (_userId, backendUser = null) => {
    return {
        isMuted: isUserMuted(_userId, backendUser),
        isBanned: isUserBanned(_userId, backendUser),
    };
};

/**
 * @deprecated 请改用后端 API（adminGetUser）获取真实状态
 */
export const readAdminMeta = (userId) => {
    if (!userId) return {};
    try {
        const raw = localStorage.getItem(`aw_admin_meta_${userId}`);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

