import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styles from './PublicProfile.module.css';
import { useUser } from '../context/UserContext';
import Post from '../components/Post';
import { loadAllPosts } from '../utils/postLoader';
import { getPostStats } from '../utils/postStats';

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

    const recentActivities = useMemo(() => posts.slice(0, 5), [posts]);

    const handleReadMore = (postId) => {
        navigate(`/post/${postId}`, { state: { from: `/user/${id}` } });
    };

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

    const isSelf = useMemo(() => {
        if (!displayAuthor || !user) return false;
        return isSamePerson(displayAuthor, {
            id: user.id,
            name: user.profile?.name || '匿名'
        });
    }, [displayAuthor, user]);

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
                            {displayAuthor?.isAdmin && <span className={styles.adminBadge}>管理员</span>}
                        </div>
                        <div className={styles.userId}>ID：{displayAuthor?.id || id}</div>
                        <div className={styles.meta}>{displayAuthor?.school} · {displayAuthor?.className}</div>
                        <div className={styles.meta}>{displayAuthor?.email}</div>
                    </div>
                    {isSelf && (
                        <div className={styles.heroActions}>
                            <button
                                className={styles.editBtn}
                                onClick={() => navigate('/profile')}
                            >
                                编辑资料
                            </button>
                        </div>
                    )}
                </div>
                <div className={styles.statsBar}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.posts}</span>
                        <span className={styles.statLabel}>帖子</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.views}</span>
                        <span className={styles.statLabel}>浏览</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.likes}</span>
                        <span className={styles.statLabel}>获赞</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.favorites}</span>
                        <span className={styles.statLabel}>收藏</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{stats.replies}</span>
                        <span className={styles.statLabel}>回复</span>
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
                            {!loading && recentActivities.length === 0 && (
                                <li className={styles.activityItem}>暂无动态</li>
                            )}
                            {!loading && recentActivities.map((post) => (
                                <li key={post.id} className={styles.activityItem}>
                                    <span className={styles.activityBadge}>发布</span>
                                    <span className={styles.activityText}>发布了《{post.title}》</span>
                                    <span className={styles.activityDate}>
                                        {new Date(post.date).toLocaleDateString('zh-CN')}
                                    </span>
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
                            {!loading && posts.length === 0 && (
                                <div className={styles.empty}>暂无发布内容</div>
                            )}
                            {!loading && posts.map((post) => (
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
