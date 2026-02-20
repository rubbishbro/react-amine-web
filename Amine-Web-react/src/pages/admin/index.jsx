import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './AdminPanel.module.css';
import { useUser } from '../context/UserContext';
import { buildTagInfo } from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';
import {
    adminGetUser,
    adminSearchUsers,
    adminSetTitle,
    adminSetRole,
    adminMuteUser,
    adminUnmuteUser,
    adminBanUser,
    adminUnbanUser,
    adminDeleteUser,
} from '../../services/adminApi';

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
};

export default function AdminPanel() {
    const { user, setAdmin, logout } = useUser();
    const location = useLocation();
    const navigate = useNavigate();

    const targetFromState = location.state?.target || null;
    const target = useMemo(() => {
        if (targetFromState) return targetFromState;
        if (user) {
            return {
                id: user.id,
                name: user.profile?.name || '匿名',
                avatar: user.profile?.avatar || '',
                isAdmin: user.isAdmin === true,
            };
        }
        return null;
    }, [targetFromState, user]);

    const canManage = user?.isAdmin === true;

    if (!canManage) {
        return (
            <div className={styles.page}>
                <div className={styles.panel}>
                    <h2 className={styles.title}>管理员面板</h2>
                    <p className={styles.notice}>你没有权限访问该页面。</p>
                    <button className={styles.secondaryButton} onClick={() => navigate(-1)}>
                        返回
                    </button>
                </div>
            </div>
        );
    }

    if (!target) {
        return (
            <div className={styles.page}>
                <div className={styles.panel}>
                    <h2 className={styles.title}>管理员面板</h2>
                    <p className={styles.notice}>未找到目标用户。</p>
                    <button className={styles.secondaryButton} onClick={() => navigate(-1)}>
                        返回
                    </button>
                </div>
            </div>
        );
    }

    const targetId = target?.id || '';

    return (
        <AdminPanelContent
            key={targetId}
            target={target}
            user={user}
            targetId={targetId}
            onBack={() => navigate(-1)}
            onLogout={logout}
        />
    );
}

function AdminPanelContent({ target, user, targetId, onBack, onLogout }) {
    const navigate = useNavigate();
    const { authToken, refreshUser } = useUser();

    // 从后端加载目标用户的真实状态
    const [backendUser, setBackendUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    const [title, setTitle] = useState('');
    const [role, setRole] = useState('user');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        adminGetUser(authToken, targetId)
            .then((data) => {
                if (cancelled) return;
                setBackendUser(data);
                setTitle(data.title || '');
                setRole(data.is_superuser ? 'admin' : 'user');
            })
            .catch((err) => {
                if (cancelled) return;
                setTitle('');
                setRole(target?.isAdmin ? 'admin' : 'user');
                console.warn('无法获取后端用户信息，使用本地数据:', err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [targetId, authToken, target]);

    const showMsg = (text, type = 'success') => {
        setMessage(text);
        setMessageType(type);
    };

    const isMuted = backendUser?.is_muted === true;
    const isBanned = backendUser?.is_banned === true;
    const isTargetAdmin = role === 'admin';
    const isSelf = String(targetId) === String(user?.id);

    const tagInfo = useMemo(() => {
        if (!target) return null;
        return buildTagInfo(
            { ...target, is_superuser: role === 'admin' },
            { title, role }
        );
    }, [target, title, role]);

    const syncCaches = (updatedUser) => {
        const nextTagInfo = buildTagInfo(
            { ...target, is_superuser: updatedUser.is_superuser },
            { title: updatedUser.title || '', role: updatedUser.is_superuser ? 'admin' : 'user' }
        );
        updateAuthorInCaches({
            id: String(updatedUser.id),
            name: updatedUser.username || target?.name || '匿名',
            avatar: target?.avatar || '',
            cover: target?.cover || '',
            school: updatedUser.userSchool || target?.school || '',
            className: updatedUser.userClass || target?.className || '',
            email: updatedUser.email || target?.email || '',
            isAdmin: updatedUser.is_superuser === true,
            tagInfo: nextTagInfo,
        });
    };

    const handleSearch = async (event) => {
        event.preventDefault();
        const keyword = searchKeyword.trim();
        if (!keyword) {
            setSearchResults([]);
            setSearchError('请输入昵称或邮箱');
            return;
        }
        setSearchLoading(true);
        setSearchError('');
        try {
            const users = await adminSearchUsers(authToken, keyword, { limit: 20 });
            const nextResults = Array.isArray(users) ? users : [];
            setSearchResults(nextResults);
            if (nextResults.length === 0) {
                setSearchError('未找到匹配用户');
            }
        } catch (err) {
            setSearchResults([]);
            setSearchError(err.message || '搜索失败');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSelectSearchUser = (selectedUser) => {
        navigate('/admin', {
            state: {
                target: {
                    id: selectedUser.id,
                    name: selectedUser.username || '匿名',
                    avatar: selectedUser.avatar_url || '',
                    isAdmin: selectedUser.is_superuser === true,
                    email: selectedUser.email || '',
                },
            },
        });
    };

    const handleSave = async () => {
        if (!targetId) return;
        try {
            let updated = backendUser;
            const titleChanged = title.trim() !== (backendUser?.title || '');
            const roleChanged = (role === 'admin') !== (backendUser?.is_superuser === true);

            // 只有自己或操作普通用户时才能改头衔；不能修改其他管理员的头衔
            const canChangeTitle = isSelf || !isTargetAdmin;
            if (titleChanged && !canChangeTitle) {
                showMsg('不能修改其他管理员的头衔，只能修改自己的头衔', 'error');
                return;
            }

            if (titleChanged && canChangeTitle) {
                updated = await adminSetTitle(authToken, targetId, title.trim());
                setBackendUser(updated);
            }
            if (roleChanged && !isSelf) {
                updated = await adminSetRole(authToken, targetId, role === 'admin');
                setBackendUser(updated);
                setRole(updated.is_superuser ? 'admin' : 'user');
            }
            syncCaches(updated);
            if (isSelf) await refreshUser();
            showMsg('已保存', 'success');
        } catch (err) {
            showMsg(err.message || '保存失败', 'error');
        }
    };

    const handleMute = async () => {
        if (!targetId || isTargetAdmin) return;
        const nextMuted = !isMuted;
        if (!window.confirm(nextMuted ? '确定要禁言该用户吗？' : '确定要取消禁言吗？')) return;
        try {
            const updated = nextMuted
                ? await adminMuteUser(authToken, targetId)
                : await adminUnmuteUser(authToken, targetId);
            setBackendUser(updated);
            showMsg(nextMuted ? '已禁言' : '已取消禁言', 'success');
        } catch (err) {
            showMsg(err.message || '操作失败', 'error');
        }
    };

    const handleBan = async () => {
        if (!targetId || isTargetAdmin) return;
        const nextBanned = !isBanned;
        if (!window.confirm(nextBanned ? '确定要封禁该用户吗？' : '确定要取消封禁吗？')) return;
        try {
            const updated = nextBanned
                ? await adminBanUser(authToken, targetId, '管理员操作')
                : await adminUnbanUser(authToken, targetId);
            setBackendUser(updated);
            showMsg(nextBanned ? '已封禁' : '已取消封禁', 'success');
        } catch (err) {
            showMsg(err.message || '操作失败', 'error');
        }
    };

    const handleDelete = async () => {
        if (!targetId || isTargetAdmin) return;
        if (!window.confirm('确定要删除该用户吗？该操作不可撤销。')) return;
        try {
            await adminDeleteUser(authToken, targetId);
            if (isSelf) onLogout();
            showMsg('用户已删除', 'success');
            navigate('/');
        } catch (err) {
            showMsg(err.message || '删除失败', 'error');
        }
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.panel}>
                    <p className={styles.notice}>正在加载用户信息…</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <div className={styles.headerMain}>
                        <h2 className={styles.title}>管理员面板</h2>
                        <p className={styles.subtitle}>管理用户信息与权限</p>

                        <form className={styles.searchForm} onSubmit={handleSearch}>
                            <div className={styles.searchInputWrap}>
                                <span className={styles.searchIcon} aria-hidden="true">🔍</span>
                                <input
                                    className={styles.searchInput}
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="搜索用户昵称/邮箱"
                                />
                            </div>
                            <button className={styles.primaryButton} type="submit" disabled={searchLoading}>
                                {searchLoading ? '搜索中…' : '搜索'}
                            </button>
                        </form>

                        {searchError && <div className={styles.searchError}>{searchError}</div>}

                        {searchResults.length > 0 && (
                            <div className={styles.searchResults}>
                                {searchResults.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={styles.searchResultItem}
                                        onClick={() => handleSelectSearchUser(item)}
                                    >
                                        <div className={styles.searchResultName}>{item.username || '匿名'}</div>
                                        <div className={styles.searchResultEmail}>{item.email || '-'}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className={styles.secondaryButton} onClick={onBack}>
                        返回
                    </button>
                </div>

                <div className={styles.userCard}>
                    <div
                        className={styles.avatar}
                        style={target.avatar ? { backgroundImage: `url(${target.avatar})` } : undefined}
                    />
                    <div className={styles.userMeta}>
                        <div className={styles.userNameRow}>
                            <span className={styles.userName}>{target.name || '匿名'}</span>
                            {tagInfo && (
                                <span
                                    className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}
                                >
                                    {tagInfo.label}
                                </span>
                            )}
                        </div>
                        <div className={styles.userId}>ID：{targetId}</div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>头衔与权限</div>
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            头衔（Tag）
                            <input
                                className={styles.input}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="留空则管理员显示默认标签，普通用户隐藏"
                                disabled={isTargetAdmin && !isSelf}
                            />
                        </label>
                        <label className={styles.field}>
                            编辑权限
                            <select
                                className={styles.input}
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={isSelf}
                            >
                                <option value="admin">管理员</option>
                                <option value="user">用户</option>
                            </select>
                        </label>
                    </div>
                    {isSelf && (
                        <p className={styles.restrictNote}>无法修改自己的管理员等级，但可以修改自己的头衔</p>
                    )}
                    {isTargetAdmin && !isSelf && (
                        <p className={styles.restrictNote}>不能修改其他管理员的头衔或权限</p>
                    )}
                    <div className={styles.actions}>
                        <button className={styles.primaryButton} onClick={handleSave}>保存</button>
                        {message && (
                            <span className={messageType === 'error' ? styles.errorMessage : styles.message}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>账户信息</div>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>账户创建时间</div>
                            <div className={styles.infoValue}>{formatDateTime(backendUser?.created_at)}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>最后更新时间</div>
                            <div className={styles.infoValue}>{formatDateTime(backendUser?.updated_at)}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>被禁言次数</div>
                            <div className={styles.infoValue}>{backendUser?.mute_count ?? 0}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>被封禁次数</div>
                            <div className={styles.infoValue}>{backendUser?.ban_count ?? 0}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>当前状态</div>
                            <div className={styles.infoValue}>
                                {isBanned ? '🚫 已封禁' : isMuted ? '🔇 已禁言' : '✅ 正常'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>管理操作</div>
                    {isTargetAdmin && (
                        <div className={styles.restrictNote}>你无法对管理员进行操作</div>
                    )}
                    <div className={styles.actions}>
                        <button className={isMuted ? styles.successButton : styles.warningButton} onClick={handleMute} disabled={isTargetAdmin}>
                            {isMuted ? '取消禁言' : '禁言用户'}
                        </button>
                        <button className={isBanned ? styles.successButton : styles.warningButton} onClick={handleBan} disabled={isTargetAdmin}>
                            {isBanned ? '取消封禁' : '封禁用户'}
                        </button>
                        <button className={styles.dangerButton} onClick={handleDelete} disabled={isTargetAdmin}>删除用户</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
