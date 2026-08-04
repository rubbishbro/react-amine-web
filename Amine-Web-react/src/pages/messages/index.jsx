import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './Messages.module.css';
import { useUser } from '../context/userContext.js';
import { buildUserId, getMappedUserId } from '../utils/userId';
import { isBlocked, toggleBlock, syncBlockedFromBackend } from '../utils/blockStore';
import {
    getUserNotifications,
    markNotificationRead,
    onNotificationsUpdated,
    clearReadNotifications,
    markAllNotificationsRead,
    syncNotificationsFromBackend,
} from '../utils/notifications';
import { getDmThreads, getDmThread, sendDm, recallDm, deleteDm } from '../../services/dmApi';
import { DmWsClient } from '../../services/dmWsClient';

export default function Messages() {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { user, authToken } = useUser();

    const viewerId = user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : '';
    const targetId = id || '';
    const mappedTargetId = getMappedUserId(targetId) || targetId;
    const target = state?.author || { id: targetId, name: '对方', avatar: '' };
    const mappedTarget = target ? { ...target, id: getMappedUserId(target.id || targetId) || target.id } : target;
    const viewerName = user?.profile?.name || '我';
    const viewerAvatar = user?.profile?.avatar || '';

    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([]);
    const [threads, setThreads] = useState([]);
    const isListView = !targetId;
    const [blocked, setBlocked] = useState(false);
    const [blockedByTarget, setBlockedByTarget] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const wsClientRef = useRef(null);

    // 从 user 对象读取封禁/禁言状态（修复旧代码中 restrictions 未定义的 bug）
    const restrictions = {
        isBanned: user?.isBanned === true,
        isMuted: user?.isMuted === true,
    };

    // 加载当前会话的私信（后端优先）
    useEffect(() => {
        if (!targetId || !authToken) return;
        const numericOtherId = Number(getMappedUserId(targetId) || targetId);
        if (!numericOtherId || Number.isNaN(numericOtherId)) {
            return;
        }
        getDmThread(authToken, numericOtherId)
            .then((msgs) => {
                // 将后端格式映射为前端内部格式
                setMessages(msgs.map((m) => ({
                    id: String(m.id),
                    backendId: m.id,
                    from: String(m.sender_id),
                    to: String(m.receiver_id),
                    fromName: m.sender_id === Number(user?.id) ? viewerName : (target?.name || '对方'),
                    fromAvatar: m.sender_id === Number(user?.id) ? viewerAvatar : (target?.avatar || ''),
                    toName: m.receiver_id === Number(user?.id) ? viewerName : (target?.name || '对方'),
                    toAvatar: m.receiver_id === Number(user?.id) ? viewerAvatar : (target?.avatar || ''),
                    content: m.content,
                    recalled: m.recalled,
                    createdAt: m.created_at,
                })));
            })
            .catch(() => { /* fallback to empty */ });
    }, [targetId, authToken, target?.avatar, target?.name, user?.id, viewerAvatar, viewerName]);

    // 加载会话列表（后端优先）
    useEffect(() => {
        if (!isListView || !authToken) return;
        getDmThreads(authToken)
            .then((data) => {
                setThreads(data.map((t) => ({
                    key: `backend_${t.other_id}`,
                    otherId: String(t.other_id),
                    otherName: t.other_name || String(t.other_id),
                    otherAvatar: t.other_avatar || '',
                    lastContent: t.last_message?.content || '',
                    lastAt: t.last_message?.created_at || '',
                    unreadCount: t.unread_count,
                })));
            })
            .catch(() => { /* fallback */ });
    }, [isListView, authToken]);

    // 同步通知（登录后拉取后端，否则读本地缓存）
    useEffect(() => {
        if (!viewerId) return;
        let cancelled = false;
        const update = () => {
            const list = getUserNotifications(viewerId);
            list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            if (!cancelled) setNotifications(list);
        };
        update();
        if (authToken) {
            syncNotificationsFromBackend(authToken).then(() => { if (!cancelled) update(); });
        }
        const unsubscribe = onNotificationsUpdated(update);
        return () => { cancelled = true; unsubscribe(); };
    }, [viewerId, authToken]);

    useEffect(() => {
        if (!viewerId || !targetId) return;
        // 先从缓存读
        setBlocked(isBlocked(viewerId, targetId));
        setBlockedByTarget(isBlocked(targetId, viewerId));
        // 再从后端同步
        if (authToken) {
            syncBlockedFromBackend(authToken, viewerId).then((ids) => {
                setBlocked(ids.includes(String(targetId)));
            }).catch(() => {});
        }
    }, [viewerId, targetId, authToken]);

    // WebSocket 连接（登录且有 targetId 时建立连接）
    useEffect(() => {
        if (!authToken || !user?.id || !targetId) return;
        const numericUserId = Number(user.id);
        if (!numericUserId || Number.isNaN(numericUserId)) return;

        const client = new DmWsClient(numericUserId, authToken, {
            onMessage: (msg) => {
                // 对方发来的新消息
                setMessages((prev) => [
                    ...prev,
                    {
                        id: String(msg.id),
                        backendId: msg.id,
                        from: String(msg.sender_id),
                        to: String(msg.receiver_id),
                        fromName: target?.name || '对方',
                        fromAvatar: target?.avatar || '',
                        toName: viewerName,
                        toAvatar: viewerAvatar,
                        content: msg.content,
                        recalled: false,
                        createdAt: msg.created_at,
                    },
                ]);
            },
            onSent: (msg) => {
                // 发送成功确认：将临时 ID 替换为后端返回的真实 ID
                setMessages((prev) =>
                    prev.map((m) =>
                        m._pending && m.content === msg.content && m.from === String(numericUserId)
                            ? { ...m, id: String(msg.id), backendId: msg.id, _pending: false }
                            : m
                    )
                );
            },
            onRecalled: (msg) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.backendId === msg.id ? { ...m, content: '该消息已撤回', recalled: true } : m
                    )
                );
            },
            onError: (detail) => {
                console.warn('[DM WS Error]', detail);
            },
        });
        client.connect();
        wsClientRef.current = client;
        return () => { client.disconnect(); wsClientRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authToken, user?.id, targetId]);

    // 直接读后端同步的 user 对象，不查 localStorage
    const dmDisabled = !viewerId || user?.isBanned === true || user?.isMuted === true || blocked || blockedByTarget;

    const combinedItems = useMemo(() => {
        if (!isListView) return [];
        const noticeItems = notifications.map((item) => ({
            type: 'notification',
            id: item.id,
            createdAt: item.createdAt,
            read: item.read === true,
            payload: item,
        }));
        const threadItems = threads.map((item) => ({
            type: 'thread',
            id: item.key,
            createdAt: item.lastAt,
            read: item.unreadCount === 0,
            payload: item,
        }));
        return [...noticeItems, ...threadItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [notifications, threads, isListView]);

    const handleSend = async () => {
        if (!draft.trim()) return;
        if (!viewerId) {
            window.alert('请先登录');
            navigate('/login');
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

        const numericReceiverId = Number(getMappedUserId(targetId) || targetId);
        const contentText = draft.trim();
        setDraft('');

        // 乐观消息预先显示
        const tempId = `pending-${Date.now()}`;
        const optimistic = {
            id: tempId,
            backendId: null,
            from: String(user?.id),
            to: String(numericReceiverId),
            fromName: viewerName,
            fromAvatar: viewerAvatar,
            toName: target?.name || '对方',
            toAvatar: target?.avatar || '',
            content: contentText,
            recalled: false,
            createdAt: new Date().toISOString(),
            _pending: true,
        };
        setMessages((prev) => [...prev, optimistic]);

        // 优先 WebSocket，fallback REST
        if (wsClientRef.current?.isConnected) {
            wsClientRef.current.send(numericReceiverId, contentText);
        } else {
            try {
                const msg = await sendDm(authToken, { receiver_id: numericReceiverId, content: contentText });
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempId
                            ? { ...m, id: String(msg.id), backendId: msg.id, _pending: false }
                            : m
                    )
                );
            } catch (err) {
                window.alert(err.message || '发送失败，请重试');
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
            }
        }
    };

    const handleToggleBlock = async () => {
        if (!viewerId) {
            window.alert('请先登录');
            navigate('/login');
            return;
        }
        if (!targetId) return;
        const token = authToken || '';
        try {
            const result = await toggleBlock(token, viewerId, targetId);
            setBlocked(result.blocked);
        } catch (err) {
            window.alert(err.message || '操作失败，请重试');
        }
    };;

    const handleRecall = async (messageId) => {
        const msg = messages.find((m) => m.id === messageId);
        if (!msg) return;
        // 乐观更新
        setMessages((prev) =>
            prev.map((m) => m.id === messageId ? { ...m, content: '该消息已撤回', recalled: true } : m)
        );
        // WebSocket 或 REST
        if (msg.backendId) {
            if (wsClientRef.current?.isConnected) {
                wsClientRef.current.recall(msg.backendId);
            } else {
                try {
                    await recallDm(authToken, msg.backendId);
                } catch (err) {
                    console.warn('撤回失败:', err);
                    // 回滚
                    setMessages((prev) =>
                        prev.map((m) => m.id === messageId ? { ...m, content: msg.content, recalled: false } : m)
                    );
                }
            }
        }
    };

    const handleDelete = async (messageId) => {
        const msg = messages.find((m) => m.id === messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (msg?.backendId && authToken) {
            try {
                await deleteDm(authToken, msg.backendId);
            } catch { /* ignore */ }
        }
    };

    const markAllThreadsRead = async () => {
        if (!viewerId || !authToken) return;
        // 后端全部已读（通过重新读取 threads 实现：只要把 unread_count 全郠置 0 即可）
        setThreads((prev) => prev.map((t) => ({ ...t, unreadCount: 0 })));
        // TODO: backend 提供 mark-all-read 接口时调用
    };

    if (!targetId) {
        if (!viewerId) {
            return (
                <div className={styles.page}>
                    <div className={styles.card}>
                        <div className={styles.title}>私信</div>
                        <div className={styles.notice}>请先登录后查看私信。</div>
                        <button className={styles.backButton} onClick={() => navigate('/login')}>去登录</button>
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
                    <div className={styles.listHeader}>
                        <div className={styles.listTitle}>消息列表</div>
                        <div className={styles.listActions}>
                            <button
                                className={styles.clearButton}
                                type="button"
                                onClick={() => {
                                    markAllNotificationsRead(viewerId, authToken);
                                    markAllThreadsRead();
                                }}
                            >
                                清除未读
                            </button>
                            <button
                                className={styles.clearButton}
                                type="button"
                                onClick={() => clearReadNotifications(viewerId, authToken)}
                            >
                                清空已读通知
                            </button>
                        </div>
                    </div>
                    {combinedItems.length === 0 ? (
                        <div className={styles.notice}>暂无消息记录。</div>
                    ) : (
                        <div className={styles.threadList}>
                            {combinedItems.map((item) => {
                                if (item.type === 'notification') {
                                    const payload = item.payload;
                                    const targetLabel = payload.targetType === 'reply' ? '回复' : '帖子';
                                    const actionLabel = payload.action === 'like' ? '点赞' : '回复';
                                    const preview = payload.preview ? `“${payload.preview}”` : '';
                                    const message = `您发布的${targetLabel}${preview}收到了新${actionLabel}，点击查看`;
                                    return (
                                        <button
                                            key={item.id}
                                            className={styles.threadItem}
                                            onClick={() => {
                                                markNotificationRead(payload.id, authToken);
                                                if (payload.postId) {
                                                    const hash = payload.replyId ? `#reply-${payload.replyId}` : '';
                                                    navigate(`/post/${payload.postId}${hash}`);
                                                    return;
                                                }
                                                navigate('/');
                                            }}
                                        >
                                            <div className={`${styles.threadAvatar} ${styles.noticeAvatar}`}>🔔</div>
                                            <div className={styles.threadMeta}>
                                                <div className={styles.threadTop}>
                                                    <span className={styles.threadName}>通知</span>
                                                    <div className={styles.threadMetaRight}>
                                                        {!payload.read && (
                                                            <span className={styles.unreadBadge} aria-label="未读通知">1</span>
                                                        )}
                                                        <span className={styles.threadTime}>{new Date(payload.createdAt).toLocaleString('zh-CN')}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.threadPreview}>{message}</div>
                                            </div>
                                        </button>
                                    );
                                }
                                const payload = item.payload;
                                return (
                                    <button
                                        key={payload.key}
                                        className={styles.threadItem}
                                        onClick={() => navigate(`/messages/${payload.otherId}`, {
                                            state: { author: { id: payload.otherId, name: payload.otherName, avatar: payload.otherAvatar } }
                                        })}
                                    >
                                        <div
                                            className={styles.threadAvatar}
                                            style={payload.otherAvatar ? { backgroundImage: `url(${payload.otherAvatar})` } : undefined}
                                        />
                                        <div className={styles.threadMeta}>
                                            <div className={styles.threadTop}>
                                                <span className={styles.threadName}>{payload.otherName}</span>
                                                <div className={styles.threadMetaRight}>
                                                    {payload.unreadCount > 0 && (
                                                        <span className={styles.unreadBadge} aria-label={`未读 ${payload.unreadCount} 条`}>
                                                            {payload.unreadCount > 99 ? '99+' : payload.unreadCount}
                                                        </span>
                                                    )}
                                                    <span className={styles.threadTime}>{new Date(payload.lastAt).toLocaleString('zh-CN')}</span>
                                                </div>
                                            </div>
                                            <div className={styles.threadPreview}>{payload.lastContent}</div>
                                        </div>
                                    </button>
                                );
                            })}
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
                                onClick={() => navigate(`/user/${mappedTargetId}`, { state: { author: mappedTarget } })}
                                aria-label="查看对方主页"
                            >
                                <div
                                    className={styles.avatar}
                                    style={target?.avatar ? { backgroundImage: `url(${target.avatar})` } : undefined}
                                />
                            </button>
                        </div>
                        <div className={styles.names}>
                            <div className={styles.nameLine}>{target?.name || '对方'}</div>
                            <div className={styles.subLine}>私信对话</div>
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
                        const avatar = isSelf ? user?.profile?.avatar : target?.avatar;
                        return (
                            <div key={msg.id} className={`${styles.messageItem} ${isSelf ? styles.self : styles.other}`}>
                                <button
                                    type="button"
                                    className={styles.avatarButton}
                                    onClick={() => {
                                        if (!isSelf) {
                                            navigate(`/user/${mappedTargetId}`, { state: { author: mappedTarget } });
                                        } else {
                                            navigate('/login');
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
                                        {!isSelf && (
                                            <span className={styles.messageName}>{target?.name || '对方'}</span>
                                        )}
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
