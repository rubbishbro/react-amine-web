import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './AdminPanel.module.css';
import { useUser } from '../context/UserContext';
import {
    buildTagInfo,
    deleteAdminMeta,
    readAdminMeta,
    writeAdminMeta,
    verifyAdminKey,
} from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';

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
            onSetAdmin={setAdmin}
            onLogout={logout}
        />
    );
}

function AdminPanelContent({ target, user, targetId, onBack, onSetAdmin, onLogout }) {
    const navigate = useNavigate();
    const [meta, setMeta] = useState(() => readAdminMeta(targetId));
    const [title, setTitle] = useState(meta.title || '');
    const [role, setRole] = useState(meta.role || (target?.isAdmin ? 'admin' : 'user'));
    const [message, setMessage] = useState('');

    const tagInfo = useMemo(() => {
        if (!target) return null;
        return buildTagInfo({ ...target, isAdmin: role === 'admin' }, { title, role });
    }, [target, title, role]);

    const isTargetAdmin = role === 'admin';
    const isSelf = targetId === user?.id;
    const originalRole = meta.role || (target?.isAdmin ? 'admin' : 'user');
    const originalTitle = meta.title || '';
    const isRoleChanged = role !== originalRole;
    const isTitleChanged = title.trim() !== originalTitle;

    const handleSave = () => {
        if (!targetId) return;

        // 如果修改了他人的权限或头衔，需要验证管理员密钥
        if (!isSelf && (isRoleChanged || isTitleChanged)) {
            const inputKey = window.prompt('修改他人信息需要验证管理员密钥，请输入：');
            if (!inputKey) {
                setMessage('操作已取消');
                return;
            }
            if (!verifyAdminKey(inputKey)) {
                window.alert('管理员密钥错误，操作被拒绝。');
                setMessage('密钥验证失败');
                return;
            }
        }

        const nextMeta = {
            ...meta,
            title: title.trim(),
            role,
            lastActiveAt: new Date().toISOString(),
        };
        writeAdminMeta(targetId, nextMeta);
        setMeta(nextMeta);
        if (targetId === user?.id) {
            onSetAdmin(role === 'admin');
        }
        updateAuthorInCaches({
            id: targetId,
            name: target?.name || '匿名',
            avatar: target?.avatar || '',
            cover: target?.cover || '',
            school: target?.school || '',
            className: target?.className || '',
            email: target?.email || '',
            isAdmin: role === 'admin',
        });
        setMessage('已保存');
    };

    const isMuted = meta.isMuted === true;
    const isBanned = meta.isBanned === true;

    const handleMute = () => {
        if (!targetId) return;
        if (isTargetAdmin) return;
        const nextMuted = !isMuted;
        const confirmMsg = nextMuted ? '确定要禁言该用户吗？' : '确定要取消禁言吗？';
        if (!window.confirm(confirmMsg)) return;
        const nextMeta = {
            ...meta,
            isMuted: nextMuted,
            muteCount: nextMuted ? (meta.muteCount || 0) + 1 : meta.muteCount,
            lastActiveAt: new Date().toISOString(),
        };
        writeAdminMeta(targetId, nextMeta);
        setMeta(nextMeta);
        setMessage(nextMuted ? '已禁言' : '已取消禁言');
    };

    const handleBan = () => {
        if (!targetId) return;
        if (isTargetAdmin) return;
        const nextBanned = !isBanned;
        const confirmMsg = nextBanned ? '确定要封禁该用户吗？' : '确定要取消封禁吗？';
        if (!window.confirm(confirmMsg)) return;
        const nextMeta = {
            ...meta,
            isBanned: nextBanned,
            banCount: nextBanned ? (meta.banCount || 0) + 1 : meta.banCount,
            lastActiveAt: new Date().toISOString(),
        };
        writeAdminMeta(targetId, nextMeta);
        setMeta(nextMeta);
        setMessage(nextBanned ? '已封禁' : '已取消封禁');
    };

    const handleDelete = () => {
        if (!targetId) return;
        if (isTargetAdmin) return;
        if (!window.confirm('确定要删除该用户吗？该操作不可撤销。')) return;
        deleteAdminMeta(targetId);
        if (targetId === user?.id) {
            onLogout();
        }
        setMessage('用户已删除');
        navigate('/');
    };

    return (
        <div className={styles.page}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>管理员面板</h2>
                        <p className={styles.subtitle}>管理用户信息与权限</p>
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
                            />
                        </label>
                        <label className={styles.field}>
                            编辑权限
                            <select
                                className={styles.input}
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="admin">管理员</option>
                                <option value="user">用户</option>
                            </select>
                        </label>
                    </div>
                    <div className={styles.actions}>
                        <button className={styles.primaryButton} onClick={handleSave}>保存</button>
                        {message && <span className={styles.message}>{message}</span>}
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>账户信息</div>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>账户创建时间</div>
                            <div className={styles.infoValue}>{formatDateTime(meta.createdAt)}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>最后活动时间</div>
                            <div className={styles.infoValue}>{formatDateTime(meta.lastActiveAt)}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>收到的举报</div>
                            <div className={styles.infoValue}>{meta.reportsReceived}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>提交的举报</div>
                            <div className={styles.infoValue}>{meta.reportsSubmitted}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>被禁言次数</div>
                            <div className={styles.infoValue}>{meta.muteCount}</div>
                        </div>
                        <div className={styles.infoCard}>
                            <div className={styles.infoLabel}>被封禁次数</div>
                            <div className={styles.infoValue}>{meta.banCount}</div>
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
