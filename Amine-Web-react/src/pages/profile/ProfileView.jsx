import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './PublicProfile.module.css';
import { useUser } from '../context/UserContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Post from '../components/Post';
import { loadAllPosts } from '../utils/postLoader';
import { getPostStats } from '../utils/postStats';
import { buildTagInfo, readAdminMeta, getUserRestrictions } from '../utils/adminMeta';
import { buildUserId, getMappedUserId, isSupportedUserId } from '../utils/userId';
import { getFollowerCount, isFollowingUser, toggleFollowUser } from '../utils/followStore';
import { isBlocked } from '../utils/blockStore';

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
    const mappedRouteId = id ? getMappedUserId(id) : '';
    const routeId = mappedRouteId || id || '';

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

    const authorFromState = state?.author
        ? { ...state.author, id: getMappedUserId(state.author.id || '') }
        : null;
    const authorFromUser = user?.id === routeId ? {
        id: buildUserId(user?.profile?.name, user?.id || 'local'),
        name: user.profile?.name || '匿名',
        avatar: user.profile?.avatar || '',
        cover: user.profile?.cover || '',
        school: user.profile?.school || '',
        className: user.profile?.className || '',
        email: user.profile?.email || '',
        bio: user.profile?.bio || '',
        isAdmin: user.isAdmin === true,
        tagInfo: user?.tagInfo || null,
    } : null;

    const author = authorFromUser || authorFromState;
    const authorId = author?.id;
    const authorName = author?.name;

    useEffect(() => {
        if (!id || !mappedRouteId || mappedRouteId === id) return;
        navigate(`/user/${mappedRouteId}`, { replace: true, state });
    }, [id, mappedRouteId, navigate, state]);

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
                    ...buildCandidates(routeId),
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
    }, [authorId, authorName, routeId]);

    const displayAuthor = useMemo(() => {
        let resolved = author || null;
        if (!resolved) {
            const first = posts[0]?.author;
            if (first && typeof first === 'object') {
                resolved = first;
            } else if (typeof first === 'string' && first.trim()) {
                resolved = { id: buildUserId(first.trim(), 'local'), name: first.trim() };
            }
        }

        if (resolved && user && isSamePerson(resolved, {
            id: buildUserId(user?.profile?.name, user?.id || 'local'),
            name: user.profile?.name || '匿名'
        })) {
            resolved = {
                ...resolved,
                id: resolved.id || buildUserId(user?.profile?.name, user?.id || 'local'),
                name: resolved.name || user.profile?.name || '匿名',
                avatar: resolved.avatar || user.profile?.avatar || '',
                cover: resolved.cover || user.profile?.cover || '',
                school: resolved.school || user.profile?.school || '',
                className: resolved.className || user.profile?.className || '',
                email: resolved.email || user.profile?.email || '',
                bio: resolved.bio || user.profile?.bio || '',
                isAdmin: resolved.isAdmin ?? user.isAdmin === true,
                tagInfo: resolved.tagInfo || user.tagInfo || null,
            };
        }

        return resolved;
    }, [author, posts, user]);

    const recentActivities = useMemo(() => posts.slice(0, 5), [posts]);
    const isViewerLoggedIn = user?.loggedIn === true;
    const displayValue = (value) => {
        if (!isViewerLoggedIn) return '-';
        const normalized = (value ?? '').toString().trim();
        return normalized ? normalized : '-';
    };

    const displayPosts = isViewerLoggedIn ? posts : [];
    const displayStats = isViewerLoggedIn
        ? stats
        : { posts: '-', views: '-', likes: '-', favorites: '-', replies: '-' };
    const isSelf = useMemo(() => {
        if (!displayAuthor || !user) return false;
        return isSamePerson(displayAuthor, {
            id: buildUserId(user?.profile?.name, user?.id || 'local'),
            name: user.profile?.name || '匿名'
        });
    }, [displayAuthor, user]);
    const displayName = isViewerLoggedIn ? (displayAuthor?.name || '匿名') : '未登录';
    const mappedDisplayId = getMappedUserId(displayAuthor?.id || '');
    const resolvedId = isSupportedUserId(mappedDisplayId)
        ? mappedDisplayId
        : (isSelf && isSupportedUserId(user?.id) ? user.id : 'Unknown');
    const displayId = isViewerLoggedIn ? resolvedId : 'Unknown';
    const activityItems = useMemo(() => {
        if (!isViewerLoggedIn) return [];
        return recentActivities.map((post) => ({
            id: post.id,
            badge: '发布',
            text: `发布了《${post.title}》`,
            date: formatDate(post.date),
        }));
    }, [isViewerLoggedIn, recentActivities]);

    const handleReadMore = (postId) => {
        navigate(`/post/${postId}`, { state: { from: `/user/${routeId}` } });
    };

    const profileId = getMappedUserId(displayAuthor?.id || routeId || '');
    const adminMeta = useMemo(() => readAdminMeta(profileId), [profileId]);
    const tagInfo = useMemo(() => buildTagInfo(displayAuthor, adminMeta), [displayAuthor, adminMeta]);
    const userRestrictions = useMemo(() => getUserRestrictions(profileId), [profileId]);
    const adminTarget = useMemo(() => (
        displayAuthor || {
            id: profileId || 'local',
            name: authorName || '匿名',
        }
    ), [displayAuthor, profileId, authorName]);
    const viewerId = user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : '';
    const blockedByAuthor = useMemo(() => isBlocked(profileId, viewerId), [profileId, viewerId]);
    const blockedByViewer = useMemo(() => isBlocked(viewerId, profileId), [profileId, viewerId]);
    const isFollowing = useMemo(
        () => isFollowingUser(viewerId, profileId),
        [viewerId, profileId]
    );
    const followerCount = useMemo(
        () => getFollowerCount(profileId),
        [profileId]
    );
    const displayFollowerCount = isViewerLoggedIn ? followerCount : '-';


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

    const handleOpenDm = () => {
        if (!viewerId) {
            window.alert('请先登录后再私信');
            return;
        }
        if (!profileId || viewerId === profileId) {
            return;
        }
        if (userRestrictions.isBanned) {
            window.alert('你的账号已被封禁，无法发送私信。');
            return;
        }
        if (userRestrictions.isMuted) {
            window.alert('你已被禁言，暂时无法发送私信。');
            return;
        }
        if (isBlocked(viewerId, profileId)) {
            window.alert('你已拉黑对方，无法发送私信。');
            return;
        }
        if (isBlocked(profileId, viewerId)) {
            window.alert('对方已拉黑你，无法发送私信。');
            return;
        }
        navigate(`/messages/${profileId}`, {
            state: { author: displayAuthor || { id: profileId, name: authorName || '匿名' } },
        });
    };

    const canUseAdminTools = user?.isAdmin === true;

    const coverImage = isViewerLoggedIn ? (displayAuthor?.cover || displayAuthor?.avatar) : '';
    const coverStyle = coverImage
        ? { backgroundImage: `linear-gradient(120deg, rgba(20, 20, 40, 0.4), rgba(30, 30, 60, 0.7)), url(${coverImage})` }
        : undefined;

    if (!author && !displayAuthor) {
        return (
            <div className={styles.page}>
                <p>无法加载用户资料（id: {routeId}）</p>
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
                            style={isViewerLoggedIn && displayAuthor?.avatar ? { backgroundImage: `url(${displayAuthor.avatar})` } : undefined}
                        />
                    </div>
                    <div className={styles.identity}>
                        <div className={styles.nameRow}>
                            <h2 className={styles.name}>{displayName}</h2>
                            {isViewerLoggedIn && tagInfo && (
                                <span
                                    className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}
                                >
                                    {tagInfo.label}
                                </span>
                            )}
                            {isViewerLoggedIn && userRestrictions.isBanned && (
                                <span className={styles.bannedBadge}>
                                    🚫 账号已被管理员封禁
                                </span>
                            )}
                            {isViewerLoggedIn && userRestrictions.isMuted && !userRestrictions.isBanned && (
                                <span className={styles.mutedBadge}>
                                    🔇 已被禁言
                                </span>
                            )}
                        </div>
                        <div className={styles.userId}>ID：{displayId}</div>
                        <div className={styles.meta}>{displayValue(displayAuthor?.school)} · {displayValue(displayAuthor?.className)}</div>
                        <div className={styles.meta}>{displayValue(displayAuthor?.email)}</div>
                    </div>
                    <div className={styles.heroActions}>
                        <div className={styles.actionStack}>
                            {!isViewerLoggedIn && (
                                <button
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => navigate('/login')}
                                >
                                    登录
                                </button>
                            )}
                            {isSelf && isViewerLoggedIn && (
                                <button
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => navigate('/profile')}
                                >
                                    编辑资料
                                </button>
                            )}
                            {isSelf && (
                                <button
                                    type="button"
                                    className={styles.actionButton}
                                    onClick={() => navigate('/blacklist')}
                                    disabled={!isViewerLoggedIn}
                                >
                                    黑名单
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
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                                onClick={handleOpenDm}
                                disabled={!profileId || viewerId === profileId}
                            >
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
                        <span className={styles.statValue}>{displayFollowerCount}</span>
                        <span className={styles.statLabel}>粉丝</span>
                    </div>
                </div>
            </section>

            <section className={styles.body}>
                <div className={styles.leftColumn}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>个人简介</div>
                        <div className={styles.sectionBody}>
                            {isViewerLoggedIn && displayAuthor?.bio
                                ? (
                                    <div className={styles.bioMarkdown}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {displayAuthor.bio}
                                        </ReactMarkdown>
                                    </div>
                                )
                                : (isViewerLoggedIn ? '暂无资料' : '-')}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>最新动态</div>
                        <ul className={styles.activityList}>
                            {loading && (
                                <li className={styles.activityItem}>正在加载动态...</li>
                            )}
                            {!loading && activityItems.length === 0 && (
                                <li className={styles.activityItem}>{isViewerLoggedIn ? '暂无动态' : '-'}</li>
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
                        {(blockedByAuthor || blockedByViewer) && (
                            <div className={styles.sectionNotice}>
                                {blockedByAuthor
                                    ? '你已被该用户拉黑，无法查看对方发布的帖子。'
                                    : '你已拉黑该用户，帖子已隐藏。'}
                            </div>
                        )}
                        <div className={styles.postsWrap}>
                            {loading && (
                                <div className={styles.loading}>正在加载帖子...</div>
                            )}
                            {!loading && displayPosts.length === 0 && (
                                <div className={styles.empty}>{isViewerLoggedIn ? '暂无发布内容' : '-'}</div>
                            )}
                            {!loading && displayPosts.map((post) => (
                                <Post
                                    key={post.id}
                                    post={post}
                                    preview
                                    onReadMore={handleReadMore}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
