import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './PublicProfile.module.css';
import { useUser } from '../context/UserContext';
import Post from '../components/Post';
import { loadAllPosts } from '../utils/postLoader';
import { getPostStats } from '../utils/postStats';
import { buildTagInfo, readAdminMeta } from '../utils/adminMeta';
import { getFollowerCount, isFollowingUser, toggleFollowUser } from '../utils/followStore';

const normalizeText = (value) => (value ?? '').toString().trim();
const decodeSafe = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};
const buildCandidates = (value) => {
    const raw = normalizeText(value);
    if (!raw) return [];
    const decoded = decodeSafe(raw);
    const encoded = encodeURIComponent(decoded);
    return Array.from(new Set([raw, decoded, encoded].map((item) => item.toLowerCase())));
};

const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN');
};

const MOCK_BASE_TIME = Date.parse('2026-02-06T00:00:00Z');

const fallbackStats = {
    posts: 12,
    views: 4200,
    likes: 980,
    favorites: 210,
    replies: 85,
};

const fallbackActivities = [
    { id: 'mock-activity-1', badge: '发布', text: '发布了《欢迎来到动漫社》', date: '2026-02-02' },
    { id: 'mock-activity-2', badge: '更新', text: '更新了个人简介', date: '2026-01-29' },
    { id: 'mock-activity-3', badge: '收藏', text: '收藏了《二创灵感合集》', date: '2026-01-24' },
    { id: 'mock-activity-4', badge: '回复', text: '回复了《音游区推荐》', date: '2026-01-18' },
    { id: 'mock-activity-5', badge: '发布', text: '发布了《社团活动回顾》', date: '2026-01-12' },
];

const isSamePerson = (left, right) => {
    if (!left || !right) return false;
    const leftCandidates = [
        ...buildCandidates(left.id),
        ...buildCandidates(left.name),
    ];
    const rightCandidates = [
        ...buildCandidates(right.id),
        ...buildCandidates(right.name),
    ];
    return leftCandidates.some((value) => rightCandidates.includes(value));
};

export default function ProfileView() {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useUser();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        posts: 0,
        views: 0,
        likes: 0,
        favorites: 0,
        replies: 0,
    });
    const [setFollowVersion] = useState(0);

    const authorFromState = state?.author;
    const authorFromUser = user?.id === id ? {
        id: user.id,
        name: user.profile?.name || '匿名',
        avatar: user.profile?.avatar || '',
        cover: user.profile?.cover || '',
        school: user.profile?.school || '',
        className: user.profile?.className || '',
        email: user.profile?.email || '',
        isAdmin: user.isAdmin === true,
    } : null;

    const author = authorFromUser || authorFromState;
    const authorId = author?.id;
    const authorName = author?.name;

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            const allPosts = await loadAllPosts();
            const filtered = allPosts.filter((post) => {
                const info = typeof post.author === 'object' && post.author ? post.author : { name: post.author };
                const authorCandidates = [
                    ...buildCandidates(info?.id),
                    ...buildCandidates(info?.name),
                ];
                const targetCandidates = [
                    ...buildCandidates(id),
                    ...buildCandidates(authorId),
                    ...buildCandidates(authorName),
                ];
                return authorCandidates.some((value) => targetCandidates.includes(value));
            });
            const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            if (!active) return;
            setPosts(sorted);

            const totals = sorted.reduce((acc, post) => {
                const base = {
                    views: post?.views ?? 0,
                    likes: post?.likes ?? 0,
                    favorites: post?.favorites ?? 0,
                    replies: post?.replies ?? 0,
                };
                const postStats = getPostStats(post.id, base);
                return {
                    posts: acc.posts + 1,
                    views: acc.views + postStats.views,
                    likes: acc.likes + postStats.likes,
                    favorites: acc.favorites + postStats.favorites,
                    replies: acc.replies + postStats.replies,
                };
            }, { posts: 0, views: 0, likes: 0, favorites: 0, replies: 0 });

            setStats(totals);
            setLoading(false);
        };

        load();
        return () => {
            active = false;
        };
    }, [authorId, authorName, id]);

    const displayAuthor = useMemo(() => {
        let resolved = author || null;
        if (!resolved) {
            const first = posts[0]?.author;
            if (first && typeof first === 'object') {
                resolved = first;
            } else if (typeof first === 'string' && first.trim()) {
                resolved = { id: encodeURIComponent(first.trim()), name: first.trim() };
            }
        }

        if (resolved && user && isSamePerson(resolved, {
            id: user.id,
            name: user.profile?.name || '匿名'
        })) {
            resolved = {
                ...resolved,
                id: resolved.id || user.id,
                name: resolved.name || user.profile?.name || '匿名',
                avatar: resolved.avatar || user.profile?.avatar || '',
                cover: resolved.cover || user.profile?.cover || '',
                school: resolved.school || user.profile?.school || '',
                className: resolved.className || user.profile?.className || '',
                email: resolved.email || user.profile?.email || '',
                isAdmin: resolved.isAdmin ?? user.isAdmin === true,
            };
        }

        return resolved;
    }, [author, posts, user]);

    const recentActivities = useMemo(() => posts.slice(0, 5), [posts]);

    const hasRealPosts = posts.length > 0;
    const showMock = !loading && !hasRealPosts;
    const fallbackAuthor = useMemo(() => ({
        id: displayAuthor?.id || id || 'local',
        name: displayAuthor?.name || '匿名',
        avatar: displayAuthor?.avatar || '',
        cover: displayAuthor?.cover || '',
        school: displayAuthor?.school || '',
        className: displayAuthor?.className || '',
        email: displayAuthor?.email || '',
        isAdmin: displayAuthor?.isAdmin === true,
    }), [displayAuthor, id]);

    const mockPosts = useMemo(() => {
        const base = {
            author: fallbackAuthor,
            category: '论坛闲聊',
            summary: '这是一个用于展示个人主页布局的示例帖子内容。',
            tags: ['社团', '记录'],
        };
        const makeDate = (daysAgo) => {
            const safeDays = Number.isFinite(daysAgo) ? daysAgo : 0;
            return new Date(MOCK_BASE_TIME - safeDays * 24 * 60 * 60 * 1000).toISOString();
        };
        return [
            {
                ...base,
                id: `${fallbackAuthor.id}-mock-1`,
                title: '欢迎来到动漫社的新成员介绍',
                date: makeDate(2),
                views: 320,
                likes: 56,
                favorites: 18,
                replies: 9,
            },
            {
                ...base,
                id: `${fallbackAuthor.id}-mock-2`,
                title: '社团活动回顾与下次预告',
                date: makeDate(8),
                views: 480,
                likes: 72,
                favorites: 25,
                replies: 14,
            },
            {
                ...base,
                id: `${fallbackAuthor.id}-mock-3`,
                title: '二创灵感分享：角色设定小技巧',
                date: makeDate(15),
                views: 260,
                likes: 41,
                favorites: 12,
                replies: 6,
            },
        ];
    }, [fallbackAuthor]);

    const displayPosts = showMock ? mockPosts : posts;
    const displayStats = showMock ? fallbackStats : stats;
    const activityItems = useMemo(() => {
        if (showMock) {
            return fallbackActivities.map((item) => ({
                ...item,
                date: formatDate(item.date),
            }));
        }
        return recentActivities.map((post) => ({
            id: post.id,
            badge: '发布',
            text: `发布了《${post.title}》`,
            date: formatDate(post.date),
        }));
    }, [showMock, recentActivities]);

    const handleReadMore = (postId) => {
        navigate(`/post/${postId}`, { state: { from: `/user/${id}` } });
    };

    const isSelf = useMemo(() => {
        if (!displayAuthor || !user) return false;
        return isSamePerson(displayAuthor, {
            id: user.id,
            name: user.profile?.name || '匿名'
        });
    }, [displayAuthor, user]);

    const adminMeta = useMemo(() => readAdminMeta(displayAuthor?.id), [displayAuthor?.id]);
    const tagInfo = useMemo(() => buildTagInfo(displayAuthor, adminMeta), [displayAuthor, adminMeta]);
    const adminTarget = useMemo(() => (
        displayAuthor || {
            id: id || 'local',
            name: authorName || '匿名',
        }
    ), [displayAuthor, id, authorName]);

    const profileId = displayAuthor?.id || id || '';
    const viewerId = user?.id || '';
    const isFollowing = useMemo(
        () => isFollowingUser(viewerId, profileId),
        [viewerId, profileId]
    );
    const followerCount = useMemo(
        () => getFollowerCount(profileId),
        [profileId]
    );

    const handleToggleFollow = () => {
        if (!viewerId) {
            window.alert('请先登录');
            return;
        }
        if (!profileId) return;
        if (viewerId === profileId) {
            window.alert('不能对自己执行操作');
            return;
        }
        toggleFollowUser(viewerId, profileId);
        setFollowVersion((prev) => prev + 1);
    };

    const canUseAdminTools = user?.isAdmin === true;

    const coverImage = displayAuthor?.cover || displayAuthor?.avatar;
    const coverStyle = coverImage
        ? { backgroundImage: `linear-gradient(120deg, rgba(20, 20, 40, 0.4), rgba(30, 30, 60, 0.7)), url(${coverImage})` }
        : undefined;

    if (!author && !displayAuthor) {
        return (
            <div className={styles.page}>
                <p>无法加载用户资料（id: {id}）</p>
                <button onClick={() => navigate(-1)}>返回</button>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.cover} style={coverStyle}>
                    <div className={styles.coverMask} />
                </div>
                <div className={styles.heroContent}>
                    <div className={styles.avatarWrap}>
                        <div
                            className={styles.avatar}
                            style={displayAuthor?.avatar ? { backgroundImage: `url(${displayAuthor.avatar})` } : undefined}
                        />
                    </div>
                    <div className={styles.identity}>
                        <div className={styles.nameRow}>
                            <h2 className={styles.name}>{displayAuthor?.name || '匿名'}</h2>
                            {tagInfo && (
                                <span
                                    className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}
                                >
                                    {tagInfo.label}
                                </span>
                            )}
                        </div>
                        <div className={styles.userId}>ID：{displayAuthor?.id || id}</div>
                        <div className={styles.meta}>{displayAuthor?.school} · {displayAuthor?.className}</div>
                        <div className={styles.meta}>{displayAuthor?.email}</div>
                    </div>
                    <div className={styles.heroActions}>
                        <div className={styles.actionStack}>
                            {isSelf && (
                                <button
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => navigate('/profile')}
                                >
                                    编辑资料
                                </button>
                            )}
                            {profileId && viewerId && (
                                <button
                                    type="button"
                                    className={`${styles.actionButton} ${styles.actionButtonFollow}`}
                                    onClick={handleToggleFollow}
                                    disabled={isSelf}
                                >
                                    {isFollowing ? '已关注' : '关注'}
                                </button>
                            )}
                            <button type="button" className={`${styles.actionButton} ${styles.actionButtonPrimary}`}>
                                私信
                            </button>
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.actionButtonAdmin}`}
                                disabled={!canUseAdminTools}
                                onClick={() => {
                                    if (canUseAdminTools) {
                                        navigate('/admin', { state: { target: adminTarget } });
                                    }
                                }}
                            >
                                管理员
                            </button>
                        </div>
                    </div>
                </div>
                <div className={styles.statsBar}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{displayStats.posts}</span>
                        <span className={styles.statLabel}>帖子</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{displayStats.views}</span>
                        <span className={styles.statLabel}>浏览</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{displayStats.likes}</span>
                        <span className={styles.statLabel}>获赞</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{displayStats.favorites}</span>
                        <span className={styles.statLabel}>收藏</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{followerCount}</span>
                        <span className={styles.statLabel}>粉丝</span>
                    </div>
                </div>
            </section>

            <section className={styles.body}>
                <div className={styles.leftColumn}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>个人简介</div>
                        <div className={styles.sectionBody}>
                            {displayAuthor?.school || displayAuthor?.className || displayAuthor?.email
                                ? '认真创作、热爱分享，一起交流动漫与创作灵感！'
                                : '这个人很神秘，还没有填写资料。'}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>最新动态</div>
                        <ul className={styles.activityList}>
                            {loading && (
                                <li className={styles.activityItem}>正在加载动态...</li>
                            )}
                            {!loading && activityItems.length === 0 && (
                                <li className={styles.activityItem}>暂无动态</li>
                            )}
                            {!loading && activityItems.map((item) => (
                                <li key={item.id} className={styles.activityItem}>
                                    <span className={styles.activityBadge}>{item.badge}</span>
                                    <span className={styles.activityText}>{item.text}</span>
                                    <span className={styles.activityDate}>{item.date}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className={styles.rightColumn}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>TA 的帖子</div>
                        <div className={styles.postsWrap}>
                            {loading && (
                                <div className={styles.loading}>正在加载帖子...</div>
                            )}
                            {!loading && displayPosts.length === 0 && (
                                <div className={styles.empty}>暂无发布内容</div>
                            )}
                            {!loading && displayPosts.map((post) => (
                                <Post
                                    key={post.id}
                                    post={post}
                                    preview
                                    onReadMore={showMock ? undefined : handleReadMore}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
