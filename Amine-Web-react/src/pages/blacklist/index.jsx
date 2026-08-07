import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Blacklist.module.css';
import { useUser } from '../context/userContext.js';
import { buildUserId } from '../utils/userId';
import { syncBlockedFromBackend, toggleBlock } from '../utils/blockStore';

export default function Blacklist() {
    const { user } = useUser();
    const authToken = user?.loggedIn ? 'cookie-session' : '';
    const navigate = useNavigate();
    const viewerId = useMemo(
        () => (user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : ''),
        [user]
    );
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!viewerId || !authToken) return;
        syncBlockedFromBackend(authToken, viewerId)
            .then((ids) => setList(ids))
            .catch(() => setList([]))
            .finally(() => setLoading(false));
    }, [viewerId, authToken]);

    const handleUnblock = async (targetId) => {
        try {
            await toggleBlock(authToken, viewerId, targetId);
            setList((prev) => prev.filter((id) => id !== targetId));
        } catch (err) {
            window.alert(err.message || '操作失败，请重试');
        }
    };

    if (!viewerId) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <div className={styles.title}>黑名单管理</div>
                    <div className={styles.notice}>请先登录后查看黑名单。</div>
                    <button className={styles.backButton} onClick={() => navigate('/login')}>去登录</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <button className={styles.backButton} onClick={() => navigate(-1)}>← 返回</button>
                    <div className={styles.title}>黑名单管理</div>
                </div>
                {loading ? (
                    <div className={styles.notice}>正在加载…</div>
                ) : list.length === 0 ? (
                    <div className={styles.notice}>暂无被拉黑的用户。</div>
                ) : (
                    <div className={styles.list}>
                        {list.map((targetId) => (
                            <div key={targetId} className={styles.item}>
                                <div className={styles.userId}>ID：{targetId}</div>
                                <button className={styles.unblock} onClick={() => handleUnblock(targetId)}>移出黑名单</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
