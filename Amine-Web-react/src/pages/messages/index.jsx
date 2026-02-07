import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './Messages.module.css';
import { useUser } from '../context/UserContext';
import { buildUserId } from '../utils/userId';
import { getUserRestrictions } from '../utils/adminMeta';
import { isBlocked, toggleBlock, readBlockedList } from '../utils/blockStore';

const readThread = (key) => {
    if (!key) return [];
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeThread = (key, messages) => {
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
        console.error('Failed to save DM messages:', error);
    }
};

export default function Messages() {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { user } = useUser();

    const viewerId = user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : '';
    const targetId = id || '';
    const target = state?.author || { id: targetId, name: '对方', avatar: '' };
    const viewerName = user?.profile?.name || '我';
    const viewerAvatar = user?.profile?.avatar || '';

    const threadKey = useMemo(() => {
        if (!viewerId || !targetId) return '';
        return `aw_dm_${[viewerId, targetId].sort().join('_')}`;
    }, [viewerId, targetId]);

    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([]);
    const [threads, setThreads] = useState([]);
    const isListView = !targetId;
    const [blocked, setBlocked] = useState(false);
    const [blockedByTarget, setBlockedByTarget] = useState(false);

    useEffect(() => {
        setMessages(readThread(threadKey));
    }, [threadKey]);

    useEffect(() => {
        if (!isListView || !viewerId) return;
        const blockedList = readBlockedList(viewerId);
        const all = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('aw_dm_')) continue;
            if (!key.includes(viewerId)) continue;
            const list = readThread(key);
            if (!list.length) continue;
            const last = list[list.length - 1];
            const otherId = last.from === viewerId ? last.to : last.from;
            if (blockedList.includes(otherId)) continue;
            const otherName = last.from === viewerId ? (last.toName || otherId) : (last.fromName || otherId);
            const otherAvatar = last.from === viewerId ? (last.toAvatar || '') : (last.fromAvatar || '');
            all.push({
                key,
                otherId,
                otherName,
                otherAvatar,
                lastContent: last.content,
                lastAt: last.createdAt,
            });
        }
        all.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
        setThreads(all);
    }, [isListView, viewerId]);

    useEffect(() => {
        if (!viewerId || !targetId) return;
        setBlocked(isBlocked(viewerId, targetId));
        setBlockedByTarget(isBlocked(targetId, viewerId));
    }, [viewerId, targetId]);

    const restrictions = useMemo(() => getUserRestrictions(viewerId), [viewerId]);
    const dmDisabled = !viewerId || restrictions.isBanned || restrictions.isMuted || blocked || blockedByTarget;

    const handleSend = () => {
        if (!draft.trim()) return;
        if (!viewerId) {
            window.alert('请先登录');
            navigate('/profile');
            return;
        }
        if (blockedByTarget) {
            window.alert('对方已拉黑你，无法发送私信。');
            return;
        }
        if (blocked) {
            window.alert('你已拉黑对方，无法发送私信。');
            return;
        }
        if (restrictions.isBanned) {
            window.alert('你的账号已被封禁，无法发送私信。');
            return;
        }
        if (restrictions.isMuted) {
            window.alert('你已被禁言，暂时无法发送私信。');
            return;
        }
        const next = [
            ...messages,
            {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                from: viewerId,
                to: targetId,
                fromName: viewerName,
                fromAvatar: viewerAvatar,
                toName: target?.name || '对方',
                toAvatar: target?.avatar || '',
                content: draft.trim(),
                createdAt: new Date().toISOString(),
            },
        ];
        setMessages(next);
        writeThread(threadKey, next);
        setDraft('');
    };

    const handleToggleBlock = () => {
        if (!viewerId) {
            window.alert('请先登录');
            navigate('/profile');
            return;
        }
        if (!targetId) return;
        const result = toggleBlock(viewerId, targetId);
        setBlocked(result.blocked);
    };

    const handleRecall = (messageId) => {
        const next = messages.map((msg) => {
            if (msg.id !== messageId) return msg;
            if (msg.from !== viewerId) return msg;
            return {
                ...msg,
                content: '该消息已撤回',
                recalled: true,
            };
        });
        setMessages(next);
        writeThread(threadKey, next);
    };

    const handleDelete = (messageId) => {
        const next = messages.filter((msg) => msg.id !== messageId);
        setMessages(next);
        writeThread(threadKey, next);
    };

    if (!targetId) {
        if (!viewerId) {
            return (
                <div className={styles.page}>
                    <div className={styles.card}>
                        <div className={styles.title}>私信</div>
                        <div className={styles.notice}>请先登录后查看私信。</div>
                        <button className={styles.backButton} onClick={() => navigate('/profile')}>去登录</button>
                    </div>
                </div>
            );
        }
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <div className={styles.title}>私信</div>
                    {(restrictions.isBanned || restrictions.isMuted) && (
                        <div className={styles.notice}>你的账号当前无法使用私信功能。</div>
                    )}
                    {threads.length === 0 ? (
                        <div className={styles.notice}>暂无私信记录。</div>
                    ) : (
                        <div className={styles.threadList}>
                            {threads.map((item) => (
                                <button
                                    key={item.key}
                                    className={styles.threadItem}
                                    onClick={() => navigate(`/messages/${item.otherId}`, {
                                        state: { author: { id: item.otherId, name: item.otherName, avatar: item.otherAvatar } }
                                    })}
                                >
                                    <div
                                        className={styles.threadAvatar}
                                        style={item.otherAvatar ? { backgroundImage: `url(${item.otherAvatar})` } : undefined}
                                    />
                                    <div className={styles.threadMeta}>
                                        <div className={styles.threadTop}>
                                            <span className={styles.threadName}>{item.otherName}</span>
                                            <span className={styles.threadTime}>{new Date(item.lastAt).toLocaleString('zh-CN')}</span>
                                        </div>
                                        <div className={styles.threadPreview}>{item.lastContent}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <button className={styles.backButton} onClick={() => navigate(-1)}>← 返回</button>
                    <div className={styles.headerInfo}>
                        <div className={styles.avatarGroup}>
                            <div
                                className={styles.avatar}
                                style={user?.profile?.avatar ? { backgroundImage: `url(${user.profile.avatar})` } : undefined}
                            />
                            <div className={styles.avatarDivider} />
                            <button
                                type="button"
                                className={styles.avatarButton}
                                onClick={() => navigate(`/user/${targetId}`, { state: { author: target } })}
                                aria-label="查看对方主页"
                            >
                                <div
                                    className={styles.avatar}
                                    style={target?.avatar ? { backgroundImage: `url(${target.avatar})` } : undefined}
                                />
                            </button>
                        </div>
                        <div className={styles.names}>
                            <div className={styles.nameLine}>{user?.profile?.name || '我'} ⇄ {target?.name || '对方'}</div>
                            <div className={styles.subLine}>双方私信记录</div>
                        </div>
                    </div>
                    <button
                        className={`${styles.blockButton} ${blocked ? styles.blocked : ''}`}
                        onClick={handleToggleBlock}
                        type="button"
                    >
                        {blocked ? '取消拉黑' : '拉黑'}
                    </button>
                </div>

                <div className={styles.body}>
                    {blockedByTarget && (
                        <div className={styles.notice}>你已被对方拉黑，无法继续私信。</div>
                    )}
                    {blocked && (
                        <div className={styles.notice}>你已拉黑对方，解除后可继续私信。</div>
                    )}
                    {(restrictions.isBanned || restrictions.isMuted) && (
                        <div className={styles.notice}>你的账号当前无法使用私信功能。</div>
                    )}
                    {messages.length === 0 && (
                        <div className={styles.empty}>还没有消息，发送第一条吧～</div>
                    )}
                    {messages.map((msg) => {
                        const isSelf = msg.from === viewerId;
                        const name = isSelf ? (user?.profile?.name || '我') : (target?.name || '对方');
                        const avatar = isSelf ? user?.profile?.avatar : target?.avatar;
                        return (
                            <div key={msg.id} className={`${styles.messageItem} ${isSelf ? styles.self : styles.other}`}>
                                <button
                                    type="button"
                                    className={styles.avatarButton}
                                    onClick={() => {
                                        if (!isSelf) {
                                            navigate(`/user/${targetId}`, { state: { author: target } });
                                        } else {
                                            navigate('/profile');
                                        }
                                    }}
                                    aria-label={isSelf ? '查看我的主页' : '查看对方主页'}
                                >
                                    <div
                                        className={styles.messageAvatar}
                                        style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
                                    />
                                </button>
                                <div className={styles.messageContent}>
                                    <div className={styles.messageHeader}>
                                        <span className={styles.messageName}>{name}</span>
                                        <span className={styles.messageTime}>{new Date(msg.createdAt).toLocaleString('zh-CN')}</span>
                                        <div className={styles.messageActions}>
                                            {isSelf && !msg.recalled && (
                                                <button
                                                    type="button"
                                                    className={styles.actionButton}
                                                    onClick={() => handleRecall(msg.id)}
                                                >
                                                    撤回
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className={styles.actionButton}
                                                onClick={() => handleDelete(msg.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.messageBubble}>{msg.content}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={styles.footer}>
                    <textarea
                        className={styles.input}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="输入私信内容..."
                        rows={3}
                        disabled={dmDisabled}
                    />
                    <button className={styles.sendButton} onClick={handleSend} disabled={dmDisabled}>发送</button>
                </div>
            </div>
        </div>
    );
}
