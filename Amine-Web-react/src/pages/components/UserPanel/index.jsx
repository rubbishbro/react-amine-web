import React from 'react';
import styles from './UserPanel.module.css';
import { useUser } from '../../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { closeSidebar } from '../../community';
import { buildUserId, getMappedUserId } from '../../utils/userId';

export default function UserPanel() {
    const { user } = useUser();
    const navigate = useNavigate();

    const handleLoginClick = async () => {
        if (closeSidebar) {
            await closeSidebar();
        }
        navigate('/login');
    };

    const handleProfileClick = async () => {
        // 先关闭侧边栏
        if (closeSidebar) {
            await closeSidebar();
        }
        const nextUser = user || { id: 'local', profile: {} };
        const derivedId = getMappedUserId(nextUser.id || buildUserId(nextUser.profile?.name, nextUser.id || 'local'));
        // 然后导航到个人主页
        navigate(`/user/${derivedId}`, {
            state: {
                author: {
                    id: derivedId,
                    name: nextUser.profile?.name || '匿名',
                    avatar: nextUser.profile?.avatar || '',
                    cover: nextUser.profile?.cover || '',
                    school: nextUser.profile?.school || '',
                    className: nextUser.profile?.className || '',
                    email: nextUser.profile?.email || '',
                    isAdmin: nextUser.isAdmin === true,
                }
            }
        });
    };

    const name = user?.profile?.name || '未登录';
    const avatar = user?.profile?.avatar;
    const isLoggedIn = user?.loggedIn === true;

    return (
        <div className={styles.container}>
            <div className={styles.row}>
                <div
                    className={styles.avatar}
                    style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
                />
                <div className={styles.info}>
                    {isLoggedIn ? (
                        <button className={styles.nameBtn} onClick={handleProfileClick}>
                            {name || '点击设置昵称'}
                        </button>
                    ) : (
                        <button className={styles.action} onClick={handleLoginClick}>登录</button>
                    )}
                </div>
            </div>

            {null}
        </div>
    );
}