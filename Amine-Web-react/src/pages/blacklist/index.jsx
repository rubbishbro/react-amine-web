import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Blacklist.module.css';
import { useUser } from '../context/UserContext';
import { buildUserId } from '../utils/userId';
import { readBlockedList, toggleBlock } from '../utils/blockStore';

export default function Blacklist() {
    const { user } = useUser();
    const navigate = useNavigate();
    const viewerId = useMemo(
        () => (user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : ''),
        [user]
    );
    const [list, setList] = useState([]);

    useEffect(() => {
        if (!viewerId) return;
        setList(readBlockedList(viewerId));
    }, [viewerId]);

    const handleUnblock = (targetId) => {
        toggleBlock(viewerId, targetId);
        setList(readBlockedList(viewerId));
    };

    if (!viewerId) {
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <div className={styles.title}>黑名单管理</div>
                    <div className={styles.notice}>请先登录后查看黑名单。</div>
                    <button className={styles.backButton} onClick={() => navigate('/profile')}>去登录</button>
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
                {list.length === 0 ? (
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
