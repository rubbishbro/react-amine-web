import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './PublicProfile.module.css';
import { useUser } from '../context/userContext.js';
import { adminGetUser } from '../../services/adminApi';
import { fetchCurrentUser, fetchUserByUsername } from '../../services/auth';
import { getFollowing } from '../../services/relationsApi';
import Post from '../components/Post';
import { loadAllPosts } from '../utils/postLoader';
import { getPostStats } from '../utils/postStats';
import { buildTagInfo, readAdminMeta } from '../utils/adminMeta';
import { buildUserId, getMappedUserId, isSupportedUserId } from '../utils/userId';
import {
    getFollowerCount,
    isFollowingUser,
    toggleFollowUser,
    syncFollowFromBackend,
} from '../utils/followStore';
import { isBlocked, syncBlockedFromBackend } from '../utils/blockStore';
import { resolveMediaUrl } from '../config/api.js';

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

const isCredentialError = (error) => {
    const message = normalizeText(error?.message || error);
    return /could not validate credentials/i.test(message)
        || /validate credentials/i.test(message)
        || /http 401/i.test(message)
        || /http 403/i.test(message);
};

const mapRelationUserToAuthor = (backendUser) => {
    const id = backendUser?.id ? String(backendUser.id) : '';
    return {
        id,
        name: backendUser?.username || backendUser?.email || `用户 ${id || ''}`.trim(),
        avatar: resolveMediaUrl(backendUser?.avatar_url),
        cover: resolveMediaUrl(backendUser?.cover_url),
        school: backendUser?.userSchool || '',
        className: backendUser?.userClass || '',
        email: backendUser?.email || '',
        bio: backendUser?.bio || '',
        isAdmin: backendUser?.is_superuser === true,
    };
};

export default function ProfileView() {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useUser();
    const effectiveAuthToken = user?.loggedIn ? 'cookie-session' : '';
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
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);
    const [blockedByViewer, setBlockedByViewer] = useState(false);
    const [blockedByAuthor, setBlockedByAuthor] = useState(false);
    const [actionNotice, setActionNotice] = useState('');
    const [followingPanelOpen, setFollowingPanelOpen] = useState(false);
    const [followingUsers, setFollowingUsers] = useState([]);
    const [followingLoading, setFollowingLoading] = useState(false);
    const [followingError, setFollowingError] = useState('');
    const [sessionState, setSessionState] = useState(() => (
        effectiveAuthToken ? 'checking' : 'ready'
    ));
    const [freshTargetUser, setFreshTargetUser] = useState(null);
    const [targetBackendUser, setTargetBackendUser] = useState(null);

    const authorFromState = state?.author
        ? { ...state.author, id: getMappedUserId(state.author.id || '') }
        : null;
    const authorFromUser = user?.id === routeId
        ? {
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
        }
        : null;

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

            const sorted = filtered.sort((left, right) => new Date(right.date) - new Date(left.date));
            if (!active) return;

            setPosts(sorted);
            const totals = sorted.reduce((accumulator, post) => {
                const base = {
                    views: post?.views ?? 0,
                    likes: post?.likes ?? 0,
                    favorites: post?.favorites ?? 0,
                    replies: post?.replies ?? 0,
                };
                const postStats = getPostStats(post.id, base);
                return {
                    posts: accumulator.posts + 1,
                    views: accumulator.views + postStats.views,
                    likes: accumulator.likes + postStats.likes,
                    favorites: accumulator.favorites + postStats.favorites,
                    replies: accumulator.replies + postStats.replies,
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
            const firstAuthor = posts[0]?.author;
            if (firstAuthor && typeof firstAuthor === 'object') {
                resolved = firstAuthor;
            } else if (typeof firstAuthor === 'string' && firstAuthor.trim()) {
                resolved = { id: buildUserId(firstAuthor.trim(), 'local'), name: firstAuthor.trim() };
            }
        }

        if (resolved && user && isSamePerson(resolved, {
            id: buildUserId(user?.profile?.name, user?.id || 'local'),
            name: user.profile?.name || '匿名',
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

    const isViewerLoggedIn = user?.loggedIn === true;
    const recentActivities = useMemo(() => posts.slice(0, 5), [posts]);
    const profileId = getMappedUserId(displayAuthor?.id || routeId || '');
    const viewerId = isViewerLoggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : '';
    const adminMeta = useMemo(() => readAdminMeta(profileId), [profileId]);
    const isViewerAdmin = user?.isAdmin === true;

    const handleCredentialFailure = useCallback((error, fallbackMessage = '登录状态已失效，请重新登录后重试') => {
        if (!isCredentialError(error)) return false;
        setActionNotice(fallbackMessage);
        logout();
        return true;
    }, [logout]);

    useEffect(() => {
        let cancelled = false;

        if (!effectiveAuthToken || !isViewerLoggedIn) {
            setSessionState('ready');
            return () => {
                cancelled = true;
            };
        }

        setSessionState('checking');
        fetchCurrentUser(effectiveAuthToken)
            .then(() => {
                if (!cancelled) {
                    setSessionState('ready');
                }
            })
            .catch((error) => {
                if (cancelled) return;
                if (handleCredentialFailure(error)) {
                    setSessionState('invalid');
                    return;
                }
                setSessionState('ready');
            });

        return () => {
            cancelled = true;
        };
    }, [effectiveAuthToken, handleCredentialFailure, isViewerLoggedIn]);

    const displayValue = useCallback((value) => {
        if (!isViewerLoggedIn) return '-';
        const normalized = normalizeText(value);
        return normalized || '-';
    }, [isViewerLoggedIn]);

    const displayPosts = isViewerLoggedIn ? posts : [];
    const displayStats = isViewerLoggedIn
        ? stats
        : { posts: '-', views: '-', likes: '-', favorites: '-', replies: '-' };
    const isSelf = useMemo(() => {
        if (!displayAuthor || !user) return false;
        return isSamePerson(displayAuthor, {
            id: buildUserId(user?.profile?.name, user?.id || 'local'),
            name: user.profile?.name || '匿名',
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

    useEffect(() => {
        if (!displayAuthor?.name || isSelf) {
            setFreshTargetUser(null);
            return;
        }

        let cancelled = false;
        fetchUserByUsername(displayAuthor.name)
            .then((data) => {
                if (!cancelled && data) {
                    setFreshTargetUser(data);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [displayAuthor?.name, isSelf]);

    const tagInfo = useMemo(() => {
        if (freshTargetUser) return buildTagInfo(freshTargetUser);
        return buildTagInfo(displayAuthor, adminMeta);
    }, [adminMeta, displayAuthor, freshTargetUser]);

    const freshAvatar = freshTargetUser?.avatar_url || null;
    const freshCover = freshTargetUser?.cover_url || null;

    useEffect(() => {
        if (!isViewerAdmin || !profileId || isSelf || !effectiveAuthToken || sessionState !== 'ready') {
            setTargetBackendUser(null);
            return;
        }

        let cancelled = false;
        adminGetUser(effectiveAuthToken, profileId)
            .then((data) => {
                if (!cancelled) {
                    setTargetBackendUser(data);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    if (!handleCredentialFailure(error)) {
                        setTargetBackendUser(null);
                    }
                }
            });

        return () => {
            cancelled = true;
        };
    }, [effectiveAuthToken, handleCredentialFailure, isSelf, isViewerAdmin, profileId, sessionState]);

    const userRestrictions = useMemo(() => {
        if (isSelf) {
            return { isMuted: user?.isMuted === true, isBanned: user?.isBanned === true };
        }
        if (targetBackendUser) {
            return {
                isMuted: targetBackendUser.is_muted === true,
                isBanned: targetBackendUser.is_banned === true,
            };
        }
        return { isMuted: false, isBanned: false };
    }, [isSelf, targetBackendUser, user]);

    const adminTarget = useMemo(() => (
        displayAuthor || {
            id: profileId || 'local',
            name: authorName || '匿名',
        }
    ), [authorName, displayAuthor, profileId]);

    const displayFollowerCount = isViewerLoggedIn ? followerCount : '-';

    useEffect(() => {
        if (!profileId) {
            setIsFollowing(false);
            setFollowerCount(0);
            setBlockedByViewer(false);
            setBlockedByAuthor(false);
            return;
        }

        let cancelled = false;
        const canQueryRelation = isViewerLoggedIn && sessionState === 'ready' && !!effectiveAuthToken;

        setIsFollowing(isFollowingUser(viewerId, profileId));
        setFollowerCount(getFollowerCount(profileId));
        setBlockedByViewer(viewerId ? isBlocked(viewerId, profileId) : false);
        setBlockedByAuthor(false);

        syncFollowFromBackend(profileId, canQueryRelation ? effectiveAuthToken : '', viewerId)
            .then(({ followerCount: nextFollowerCount, isFollowing: nextIsFollowing }) => {
                if (cancelled) return;
                setFollowerCount(nextFollowerCount);
                if (canQueryRelation) {
                    setIsFollowing(nextIsFollowing);
                }
            });

        if (viewerId && canQueryRelation) {
            syncBlockedFromBackend(effectiveAuthToken, viewerId)
                .then((ids) => {
                    if (!cancelled) {
                        setBlockedByViewer(ids.includes(String(profileId)));
                    }
                });
        }

        return () => {
            cancelled = true;
        };
    }, [effectiveAuthToken, isViewerLoggedIn, profileId, sessionState, viewerId]);

    useEffect(() => {
        if (!followingPanelOpen) return;
        if (!profileId) {
            setFollowingUsers([]);
            setFollowingError('当前用户没有可用的关注列表。');
            return;
        }

        let cancelled = false;
        setFollowingLoading(true);
        setFollowingError('');

        getFollowing(profileId, { skip: 0, limit: 100 })
            .then((items) => {
                if (cancelled) return;
                const normalized = Array.isArray(items) ? items.map(mapRelationUserToAuthor) : [];
                setFollowingUsers(normalized);
            })
            .catch((error) => {
                if (cancelled) return;
                setFollowingUsers([]);
                setFollowingError(error?.message || '关注列表加载失败，请稍后重试。');
            })
            .finally(() => {
                if (!cancelled) {
                    setFollowingLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [followingPanelOpen, profileId]);

    const handleReadMore = (postId) => {
        navigate(`/post/${postId}`, { state: { from: `/user/${routeId}` } });
    };

    const handleToggleFollow = async () => {
        setActionNotice('');

        if (!isViewerLoggedIn || !viewerId || !effectiveAuthToken) {
            setActionNotice('请先登录后再关注该用户。');
            navigate('/login');
            return;
        }
        if (!profileId) return;
        if (viewerId === profileId) {
            setActionNotice('不能关注自己。');
            return;
        }
        if (sessionState === 'checking') {
            setActionNotice('正在校验登录状态，请稍后再试。');
            return;
        }
        if (followLoading) return;

        setFollowLoading(true);
        try {
            const result = await toggleFollowUser(effectiveAuthToken, viewerId, profileId);
            setIsFollowing(result.isFollowing);
            setFollowerCount(result.followerCount);
            setActionNotice(result.isFollowing ? '已关注该用户。' : '已取消关注。');
        } catch (error) {
            if (handleCredentialFailure(error, '登录状态已失效，请重新登录后再关注。')) return;
            setActionNotice(error?.message || '关注操作失败，请稍后重试。');
        } finally {
            setFollowLoading(false);
        }
    };

    const handleToggleFollowingPanel = () => {
        setActionNotice('');
        setFollowingPanelOpen((current) => !current);
    };

    const handleOpenMessageList = () => {
        setActionNotice('');

        if (!isViewerLoggedIn || !viewerId || !effectiveAuthToken) {
            setActionNotice('请先登录后查看私信列表。');
            navigate('/login');
            return;
        }
        if (sessionState === 'checking') {
            setActionNotice('正在校验登录状态，请稍后再试。');
            return;
        }
        navigate('/messages');
    };

    const handleOpenFollowingProfile = (targetAuthor) => {
        const targetId = getMappedUserId(targetAuthor?.id || '') || targetAuthor?.id || '';
        if (!targetId) return;
        navigate(`/user/${targetId}`, { state: { author: targetAuthor } });
    };

    const canUseAdminTools = user?.isAdmin === true;
    const coverImage = isViewerLoggedIn
        ? (freshCover || displayAuthor?.cover || freshAvatar || displayAuthor?.avatar)
        : '';
    const coverStyle = coverImage
        ? { backgroundImage: `linear-gradient(120deg, rgba(20, 20, 40, 0.4), rgba(30, 30, 60, 0.7)), url(${coverImage})` }
        : undefined;

    if (!author && !displayAuthor) {
        return (
            <div className={styles.page}>
                <p>无法加载用户资料（ID: {routeId}）。</p>
                <button type="button" onClick={() => navigate(-1)}>返回</button>
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
                            style={
                                isViewerLoggedIn && (freshAvatar || displayAuthor?.avatar)
                                    ? { backgroundImage: `url(${freshAvatar || displayAuthor.avatar})` }
                                    : undefined
                            }
                        />
                    </div>
                    <div className={styles.identity}>
                        <div className={styles.nameRow}>
                            <h2 className={styles.name}>{displayName}</h2>
                            {isViewerLoggedIn && tagInfo && (
                                <span className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                                    {tagInfo.label}
                                </span>
                            )}
                            {isViewerLoggedIn && userRestrictions.isBanned && (
                                <span className={styles.bannedBadge}>账号已被管理员封禁</span>
                            )}
                            {isViewerLoggedIn && userRestrictions.isMuted && !userRestrictions.isBanned && (
                                <span className={styles.mutedBadge}>已被禁言</span>
                            )}
                        </div>
                        <div className={styles.userId}>ID: {displayId}</div>
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
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.actionButtonFollow}`}
                                onClick={handleToggleFollowingPanel}
                                disabled={!profileId}
                            >
                                查看关注列表
                            </button>
                            {profileId && viewerId && !isSelf && (
                                <button
                                    type="button"
                                    className={`${styles.actionButton} ${styles.actionButtonMuted}`}
                                    onClick={handleToggleFollow}
                                    disabled={followLoading || sessionState === 'checking'}
                                >
                                    {followLoading ? '处理中...' : (isFollowing ? '已关注' : '关注TA')}
                                </button>
                            )}
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                                onClick={handleOpenMessageList}
                            >
                                查看私信列表
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
                            {actionNotice && (
                                <div className={styles.actionNotice} role="status">
                                    {actionNotice}
                                </div>
                            )}
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
                            {isViewerLoggedIn && displayAuthor?.bio ? (
                                <div className={styles.bioMarkdown}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {displayAuthor.bio}
                                    </ReactMarkdown>
                                </div>
                            ) : (isViewerLoggedIn ? '暂无资料' : '-')}
                        </div>
                    </div>

                    {followingPanelOpen && (
                        <div className={styles.section}>
                            <div className={styles.sectionHeaderRow}>
                                <div className={styles.sectionHeader}>关注列表</div>
                                <button
                                    type="button"
                                    className={styles.inlineAction}
                                    onClick={handleToggleFollowingPanel}
                                >
                                    收起
                                </button>
                            </div>
                            {followingLoading && (
                                <div className={styles.followingState}>正在加载关注列表...</div>
                            )}
                            {!followingLoading && followingError && (
                                <div className={styles.followingError}>{followingError}</div>
                            )}
                            {!followingLoading && !followingError && followingUsers.length === 0 && (
                                <div className={styles.followingState}>暂时还没有关注任何人。</div>
                            )}
                            {!followingLoading && !followingError && followingUsers.length > 0 && (
                                <div className={styles.followingList}>
                                    {followingUsers.map((item) => {
                                        const meta = [item.school, item.className].filter(Boolean).join(' · ') || item.email || '暂未完善资料';
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={styles.followingItem}
                                                onClick={() => handleOpenFollowingProfile(item)}
                                            >
                                                <div
                                                    className={styles.followingAvatar}
                                                    style={item.avatar ? { backgroundImage: `url(${item.avatar})` } : undefined}
                                                />
                                                <div className={styles.followingContent}>
                                                    <div className={styles.followingNameRow}>
                                                        <span className={styles.followingName}>{item.name}</span>
                                                        {item.isAdmin && (
                                                            <span className={styles.followingBadge}>管理员</span>
                                                        )}
                                                    </div>
                                                    <div className={styles.followingMeta}>{meta}</div>
                                                    {item.bio && (
                                                        <div className={styles.followingBio}>{item.bio}</div>
                                                    )}
                                                </div>
                                                <span className={styles.followingLink}>查看主页</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

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
                                    : '你已拉黑该用户，帖子内容已隐藏。'}
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
