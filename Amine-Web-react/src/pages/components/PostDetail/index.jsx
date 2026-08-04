import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import rehypeHighlight from 'rehype-highlight';
import MarkdownEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import styles from './PostDetail.module.css';
import { clearPostsCache, deletePublishedPost, loadPostContent, publishLocalDraft, removeLocalDraft, setPostPinnedLocally } from '../../utils/postLoader';
import { getCategoryColor } from '../../config';
import { useUser } from '../../context/userContext.js';
import {
  getPostStats,
  incrementPostViews,
  onPostStatsUpdated,
  syncPostReplies,
  updatePostFavorites,
  updatePostLikes,
} from '../../utils/postStats';
import { buildTagInfo } from '../../utils/adminMeta';
import { buildUserId, getMappedUserId } from '../../utils/userId';
import { getFollowerCount, isFollowingUser, syncFollowFromBackend, toggleFollowUser } from '../../utils/followStore';
import { getPostComments, createComment, deleteComment, likeComment } from '../../../services/commentsApi';

const isSameUser = (left, right) => {
  if (!left || !right) return false;
  const leftId = (left.id ?? '').toString().trim();
  const rightId = (right.id ?? '').toString().trim();
  if (leftId && rightId && leftId === rightId) return true;
  const leftName = (left.name ?? '').toString().trim();
  const rightName = (right.name ?? '').toString().trim();
  return !!(leftName && rightName && leftName === rightName);
};

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authToken, toggleLike, toggleFavorite, isLiked, isFavorited } = useUser();
  const isViewerLoggedIn = user?.loggedIn === true;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replies, setReplies] = useState([]);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  // 关注状态（从后端初始化）
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [draftActionLoading, setDraftActionLoading] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState('');
  const [replySort, setReplySort] = useState('time');
  const adminMenuRef = useRef(null);
  const viewTrackedRef = useRef(null);

  // 评论点赞本地状态（{ [commentId]: { liked: bool, count: number } }）
  // 初始值来自后端返回的 likes 字段，点赞后乐观更新
  const [replyLikeMap, setReplyLikeMap] = useState({});
  const isLocalDraft = post?.isDraft === true || post?.status === 'draft';

  const getReplyLikeInfo = useCallback((_, replyId) => {
    if (!replyId) return { count: 0, liked: false };
    const info = replyLikeMap[String(replyId)];
    return info || { count: 0, liked: false };
  }, [replyLikeMap]);

  const isReplyLikedByUser = (_, replyId) => {
    return getReplyLikeInfo(_, replyId).liked;
  };

  const [activeReplyId, setActiveReplyId] = useState(null);
  const [nestedDraft, setNestedDraft] = useState('');

  // 构建当前用户信息，ID生成方式与帖子作者一致
  const currentUserName = user?.profile?.name || '游客';
  const currentUserId = buildUserId(currentUserName, user?.id || 'guest');
  const currentUser = useMemo(() => ({
    id: currentUserId,
    backendId: user?.id || null,
    name: currentUserName,
    avatar: user?.profile?.avatar || '',
    school: user?.profile?.school || '',
    className: user?.profile?.className || '',
    email: user?.profile?.email || '',
    isAdmin: user?.isAdmin === true,
  }), [
    currentUserId,
    currentUserName,
    user?.id,
    user?.isAdmin,
    user?.profile?.avatar,
    user?.profile?.school,
    user?.profile?.className,
    user?.profile?.email,
  ]);

  // 获取当前用户的禁言/封禁状态（直接读后端同步的 user 对象）
  const userRestrictions = useMemo(() => ({
    isMuted: user?.isMuted === true,
    isBanned: user?.isBanned === true,
  }), [user?.isMuted, user?.isBanned]);

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const postData = await loadPostContent(id);
        if (!postData) {
          setError('帖子不存在或加载失败');
          return;
        }
        setPost(postData);
        setIsPinned(postData.isPinnedGlobally === true);
        setError(null);
      } catch (err) {
        setError('加载帖子失败，请刷新重试');
        console.error('Error loading post:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  // 从后端加载评论列表
  useEffect(() => {
    if (!id || isLocalDraft) {
      setReplies([]);
      return;
    }
    let cancelled = false;
    // 尝试将 id 转换为数字（后端帖子 ID 是整数）
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return;
    }
    getPostComments(numericId)
      .then((data) => {
        if (cancelled) return;
        // 将后端评论格式转换为前端格式
        const mapped = (data || []).map((c) => ({
          id: String(c.id),
          backendId: c.id,
          author: {
            id: String(c.author_id),
            name: c.author_name || '匿名',
            avatar: c.author_avatar || '',
          },
          content: c.content,
          createdAt: c.created_at,
          parentId: c.parent_id ? String(c.parent_id) : null,
          replyToName: null, // 后端未直接返回，可通过 parent 查找
          likes: c.likes ?? 0,
          is_deleted: c.is_deleted,
        }));
        // 填充 replyToName
        const idMap = {};
        mapped.forEach((c) => { idMap[c.id] = c; });
        mapped.forEach((c) => {
          if (c.parentId && idMap[c.parentId]) {
            c.replyToName = idMap[c.parentId].author?.name || '用户';
          }
        });
        setReplies(mapped.filter((c) => !c.is_deleted));
        // 初始化点赞状态（liked = false，后端暂不返回"我是否点赞"，乐观更新）
        const likeInit = {};
        mapped.forEach((c) => {
          likeInit[c.id] = { count: c.likes, liked: false };
        });
        setReplyLikeMap(likeInit);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[PostDetail] 加载评论失败，回退到空列表:', err.message);
        setReplies([]);
      });
    return () => { cancelled = true; };
  }, [id, isLocalDraft]);

  useEffect(() => {
    setIsPinned(post?.isPinnedGlobally === true);
  }, [post?.isPinnedGlobally]);

  useEffect(() => {
    if (!adminMenuOpen) return;
    const handleClickOutside = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [adminMenuOpen]);

  useEffect(() => {
    if (!location.hash) return;
    const hashId = location.hash.replace('#', '').trim();
    if (!hashId) return;
    const timer = setTimeout(() => {
      const target = document.getElementById(hashId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [location.hash, replies]);

  const handleSubmitReply = async () => {
    if (!isViewerLoggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }
    // 检查禁言/封禁状态
    if (userRestrictions.isBanned) {
      window.alert('您的账号已被封禁，无法发布回复。');
      return;
    }
    if (userRestrictions.isMuted) {
      window.alert('您已被禁言，暂时无法发布回复。');
      return;
    }
    if (!replyDraft.trim()) return;
    const numericPostId = Number(id);
    if (Number.isNaN(numericPostId)) return;
    try {
      const created = await createComment(authToken, { post_id: numericPostId, content: replyDraft.trim() });
      const newReply = {
        id: String(created.id),
        backendId: created.id,
        author: { id: String(currentUser.backendId || currentUser.id), name: currentUser.name, avatar: currentUser.avatar },
        content: created.content,
        createdAt: created.created_at,
        parentId: null,
        replyToName: null,
        likes: 0,
      };
      setReplies((prev) => [...prev, newReply]);
      setReplyLikeMap((prev) => ({ ...prev, [newReply.id]: { count: 0, liked: false } }));
      setReplyDraft('');
      setIsReplyOpen(false);
    } catch (err) {
      window.alert(err.message || '发布失败，请重试');
    }
  };

  const handleOpenNestedReply = (replyId) => {
    if (!isViewerLoggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }
    // 检查禁言/封禁状态
    if (userRestrictions.isBanned) {
      window.alert('您的账号已被封禁，无法发布回复。');
      return;
    }
    if (userRestrictions.isMuted) {
      window.alert('您已被禁言，暂时无法发布回复。');
      return;
    }
    setActiveReplyId(replyId);
    setNestedDraft('');
  };

  const handleSubmitNestedReply = async (replyId) => {
    if (!isViewerLoggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }
    // 检查禁言/封禁状态
    if (userRestrictions.isBanned) {
      window.alert('您的账号已被封禁，无法发布回复。');
      return;
    }
    if (userRestrictions.isMuted) {
      window.alert('您已被禁言，暂时无法发布回复。');
      return;
    }
    if (!nestedDraft.trim()) return;
    const target = replies.find((item) => item.id === replyId);
    const numericPostId = Number(id);
    if (Number.isNaN(numericPostId)) return;
    // backendId 可能是 number，也可能已经是字符串形式的数字
    const numericParentId = target?.backendId ?? Number(replyId);
    try {
      const created = await createComment(authToken, {
        post_id: numericPostId,
        content: nestedDraft.trim(),
        parent_id: numericParentId,
      });
      const newReply = {
        id: String(created.id),
        backendId: created.id,
        author: { id: String(currentUser.backendId || currentUser.id), name: currentUser.name, avatar: currentUser.avatar },
        content: created.content,
        createdAt: created.created_at,
        parentId: replyId,
        replyToName: target?.author?.name || '用户',
        likes: 0,
      };
      setReplies((prev) => [...prev, newReply]);
      setReplyLikeMap((prev) => ({ ...prev, [newReply.id]: { count: 0, liked: false } }));
      setNestedDraft('');
      setActiveReplyId(null);
    } catch (err) {
      window.alert(err.message || '发布失败，请重试');
    }
  };

  const handleDeletePost = async () => {
    const canDeletePost = currentUser.isAdmin || isSelfAuthor;
    if (!canDeletePost) {
      window.alert('你没有权限删除该帖子。');
      return;
    }
    if (!window.confirm('确定删除该帖子吗？此操作不可恢复。')) return;
    try {
      if (isLocalDraft) {
        removeLocalDraft(id);
      } else {
        await deletePublishedPost(id, authToken);
      }
      clearPostsCache();
      setPost(null);
      const fallbackRoute = typeof location.state?.from === 'string' ? location.state.from : '/';
      navigate(fallbackRoute, {
        replace: true,
        state: { refreshPostsAt: Date.now() },
      });
    } catch (err) {
      window.alert(err?.message || '鍒犻櫎澶辫触锛岃閲嶈瘯');
    }
  };

  const handleTogglePinned = () => {
    if (!currentUser.isAdmin) return;
    const nextPinned = !isPinned;
    setPostPinnedLocally(id, nextPinned);
    setIsPinned(nextPinned);
    setPost((prev) => {
      if (!prev) return prev;
      const nextCategories = nextPinned
        ? (prev.pinnedInCategories?.length ? prev.pinnedInCategories : ['全站'])
        : (prev.pinnedInCategories || []).filter((item) => item !== '全站');
      return {
        ...prev,
        isPinnedGlobally: nextPinned,
        pinnedInCategories: nextCategories,
      };
    });
    setAdminMenuOpen(false);
  };

  const handleEditPost = () => {
    // 只有自己可以编辑自己的帖子
    const canEdit = isSelfAuthor;
    if (!canEdit) return;
    navigate(`/editor/${id}`);
  };

  const handlePublishDraft = async () => {
    if (!post) return;
    setDraftFeedback('');
    setDraftActionLoading(true);

    try {
      const published = await publishLocalDraft(post, authToken);
      navigate(`/post/${published.id}`);
    } catch (err) {
      setDraftFeedback(err?.message || '草稿发布失败，请稍后重试');
    } finally {
      setDraftActionLoading(false);
    }
  };

  const handleDeleteReply = async (replyId) => {
    const target = replies.find((reply) => reply.id === replyId);
    const replyAuthorId = target?.author?.id || '';
    const canDeleteReply = currentUser.isAdmin || (replyAuthorId && String(currentUser.backendId || currentUser.id) === String(replyAuthorId));
    if (!canDeleteReply) {
      window.alert('你没有权限删除该回复。');
      return;
    }
    if (!window.confirm('确定删除该回复吗？')) return;
    const backendId = target?.backendId ?? Number(replyId);
    try {
      await deleteComment(authToken, backendId);
      setReplies((prev) => prev.filter((reply) => reply.id !== replyId && reply.parentId !== replyId));
      if (activeReplyId === replyId) {
        setActiveReplyId(null);
      }
    } catch (err) {
      window.alert(err.message || '删除失败，请重试');
    }
  };

  const baseStats = useMemo(() => ({
    views: post?.views ?? 0,
    likes: post?.likes ?? 0,
    favorites: post?.favorites ?? 0,
    replies: post?.replies ?? 0,
  }), [post?.views, post?.likes, post?.favorites, post?.replies]);

  const [stats, setStats] = useState(() => getPostStats(id, baseStats));

  useEffect(() => {
    if (!post?.id) return;
    setStats(getPostStats(post.id, baseStats));
    const unsubscribe = onPostStatsUpdated((event) => {
      if (event?.detail?.postId === post.id) {
        setStats(getPostStats(post.id, baseStats));
      }
    });
    return unsubscribe;
  }, [post?.id, baseStats]);

  useEffect(() => {
    if (!post?.id || isLocalDraft) return;
    if (viewTrackedRef.current === post.id) return;
    viewTrackedRef.current = post.id;
    if (isViewerLoggedIn) {
      incrementPostViews(post.id);
    }
  }, [post?.id, isViewerLoggedIn, isLocalDraft]);

  useEffect(() => {
    if (!id || !isViewerLoggedIn || isLocalDraft) return;
    syncPostReplies(id, replies.length);
  }, [id, replies.length, isViewerLoggedIn, isLocalDraft]);

  const handleToggleLike = () => {
    if (!isViewerLoggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }
    // 检查禁言/封禁状态
    if (userRestrictions.isBanned) {
      window.alert('您的账号已被封禁，无法进行点赞操作。');
      return;
    }
    if (userRestrictions.isMuted) {
      window.alert('您已被禁言，暂时无法进行点赞操作。');
      return;
    }
    const wasLiked = isLiked(id);
    toggleLike(id);
    updatePostLikes(id, wasLiked ? -1 : 1);
  };

  const handleToggleFavorite = () => {
    if (!isViewerLoggedIn) {
      window.alert('请先登录后再发帖！');
      navigate('/login');
      return;
    }
    // 检查禁言/封禁状态
    if (userRestrictions.isBanned) {
      window.alert('您的账号已被封禁，无法进行收藏操作。');
      return;
    }
    if (userRestrictions.isMuted) {
      window.alert('您已被禁言，暂时无法进行收藏操作。');
      return;
    }
    const wasFavorited = isFavorited(id);
    toggleFavorite(id);
    updatePostFavorites(id, wasFavorited ? -1 : 1);
  };

  const replyEditorConfig = {
    view: {
      menu: true,
      md: true,
      html: true,
    },
    canView: {
      menu: true,
      md: true,
      html: true,
      fullScreen: false,
      hideMenu: true,
    },
    htmlClass: 'markdown-body markdown-preview markdown-reply',
    markdownClass: 'markdown-editor',
    syncScrollMode: ['leftFollowRight', 'rightFollowLeft'],
    imageAccept: '.jpg,.jpeg,.png,.gif,.webp',
    linkAccept: '.*',
  };

  const author = post?.author;
  const authorInfo = useMemo(
    () => (typeof author === 'object' && author !== null
      ? author
      : { name: author || '匿名' }),
    [author],
  );
  const mappedAuthorId = getMappedUserId(authorInfo.id || '');
  const hasAuthorLink = !!mappedAuthorId;
  const authorTagInfo = useMemo(() => buildTagInfo(authorInfo), [authorInfo]);
  const authorId = mappedAuthorId || '';
  const viewerId = user?.id || '';
  const isSelfAuthor = useMemo(() => isSameUser(authorInfo, currentUser), [authorInfo, currentUser]);
  const displayFollowerCount = isViewerLoggedIn ? followerCount : '-';

  // 从后端初始化关注状态（作者 ID 已知后触发）
  useEffect(() => {
    if (!authorId || !isViewerLoggedIn) return;
    let cancelled = false;
    // 先用缓存快速渲染
    setIsFollowing(isFollowingUser(viewerId, authorId));
    setFollowerCount(getFollowerCount(authorId));
    // 再从后端拉取真实值
    syncFollowFromBackend(authorId, authToken, viewerId).then(({ followerCount: fc, isFollowing: isF }) => {
      if (cancelled) return;
      setIsFollowing(isF);
      setFollowerCount(fc);
    });
    return () => { cancelled = true; };
  }, [authorId, viewerId, isViewerLoggedIn, authToken]);

  const replyTagMap = useMemo(() => {
    if (!isViewerLoggedIn) return new Map();
    const map = new Map();
    replies.forEach((reply) => {
      if (!reply?.author?.id) return;
      const info = buildTagInfo(reply.author);
      if (info) {
        map.set(reply.id, info);
      }
    });
    return map;
  }, [replies, isViewerLoggedIn]);
  const canDeletePost = currentUser.isAdmin || isSelfAuthor;
  const sortedReplies = useMemo(() => {
    const list = [...replies];
    if (replySort === 'likes') {
      list.sort((a, b) => {
        const likeDiff = getReplyLikeInfo(id, b.id).count - getReplyLikeInfo(id, a.id).count;
        if (likeDiff !== 0) return likeDiff;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      return list;
    }
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return list;
  }, [replies, replySort, id, getReplyLikeInfo]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h3>{error}</h3>
        <button onClick={() => navigate('/')} className={styles.backButton}>
          返回首页
        </button>
      </div>
    );
  }

  const modalNode = isReplyOpen && typeof document !== 'undefined'
    ? createPortal(
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3>发布回复</h3>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.replyEditor}>
              <MarkdownEditor
                value={replyDraft}
                style={{ height: '280px' }}
                onChange={({ text }) => setReplyDraft(text)}
                renderHTML={(text) => (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkIns]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {text}
                  </ReactMarkdown>
                )}
                config={replyEditorConfig}
                placeholder="使用 Markdown 编写回复内容..."
              />
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button className={styles.ghostButton} onClick={() => setIsReplyOpen(false)}>
              取消
            </button>
            <button className={styles.primaryButton} onClick={handleSubmitReply}>
              发送回复
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return (
    <div className={styles.postDetail}>
      <button onClick={handleBack} className={styles.backButton}>
        ← 返回
      </button>

      {post && (
        <>
          <div className={styles.postHeader}>
            <div className={styles.postMeta}>
              <span
                className={styles.category}
                style={{ backgroundColor: getCategoryColor(post.category) }}
              >
                {post.category}
              </span>
              <span className={styles.date}>
                📅 {new Date(post.date).toLocaleDateString('zh-CN')}
              </span>
              {hasAuthorLink ? (
                <Link
                  to={`/user/${mappedAuthorId}`}
                  state={{ author: { ...authorInfo, id: mappedAuthorId } }}
                  className={styles.authorLink}
                >
                  <div
                    className={styles.authorAvatar}
                    style={authorInfo.avatar ? { backgroundImage: `url(${authorInfo.avatar})` } : undefined}
                  />
                  <span className={styles.authorName}>{authorInfo.name || '匿名'}</span>
                  {isViewerLoggedIn && authorTagInfo && (
                    <span className={`${styles.adminBadge} ${authorTagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                      {authorTagInfo.label}
                    </span>
                  )}
                </Link>
              ) : (
                <span className={styles.author}>
                  {authorInfo.name || '匿名'}
                  {isViewerLoggedIn && authorTagInfo && (
                    <span className={`${styles.adminBadge} ${authorTagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                      {authorTagInfo.label}
                    </span>
                  )}
                </span>
              )}
              {authorId && viewerId && (
                <button
                  type="button"
                  className={`${styles.followButton} ${isFollowing ? styles.followButtonActive : ''}`}
                  disabled={isSelfAuthor || followLoading}
                  onClick={async () => {
                    if (isSelfAuthor || followLoading) return;
                    setFollowLoading(true);
                    try {
                      const result = await toggleFollowUser(authToken, viewerId, authorId);
                      setIsFollowing(result.isFollowing);
                      setFollowerCount(result.followerCount);
                    } catch (err) {
                      window.alert(err.message || '操作失败，请重试');
                    } finally {
                      setFollowLoading(false);
                    }
                  }}
                >
                  {followLoading ? '...' : isFollowing ? '已关注' : '关注'}
                </button>
              )}
              {authorId && (
                <span className={styles.followCount}>粉丝 {displayFollowerCount}</span>
              )}
              {post.readTime && (
                <span className={styles.readTime}>⏱️ {post.readTime}</span>
              )}
              {currentUser.isAdmin && (
                <div className={styles.adminTools} ref={adminMenuRef}>
                  <button
                    type="button"
                    className={styles.adminToolButton}
                    onClick={handleTogglePinned}
                    aria-label={isPinned ? '取消置顶' : '置顶帖子'}
                    title={isPinned ? '取消置顶' : '置顶帖子'}
                  >
                    {isPinned ? '📌' : '📍'}
                  </button>
                </div>
              )}
            </div>

            <div className={styles.postStats}>
              <span className={styles.statItem}>👀 {isViewerLoggedIn ? stats.views : '-'}</span>
              <span className={styles.statItem}>❤️ {isViewerLoggedIn ? stats.likes : '-'}</span>
              <span className={styles.statItem}>⭐ {isViewerLoggedIn ? stats.favorites : '-'}</span>
              <span className={styles.statItem}>💬 {isViewerLoggedIn ? stats.replies : '-'}</span>
            </div>

            <h1 className={styles.postTitle}>{post.title}</h1>

            {post.tags && post.tags.length > 0 && (
              <div className={styles.tags}>
                {post.tags.map(tag => (
                  <span key={tag} className={styles.tag}>#{tag}</span>
                ))}
              </div>
            )}

            {isLocalDraft && (
              <div className={styles.draftNotice}>
                <strong>本地草稿</strong>
                <span>这篇内容仅当前账号可见，还没有发布到服务器。</span>
                {draftFeedback && <span className={styles.draftNoticeError}>{draftFeedback}</span>}
              </div>
            )}
          </div>

          <div className={`${styles.postContent} markdown-body`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkIns]}
              rehypePlugins={[rehypeHighlight]}
            >
              {post.content || post.summary}
            </ReactMarkdown>
          </div>

          <div className={styles.actionBar}>
            {isLocalDraft && (
              <>
                <button className={styles.actionButton} onClick={handleEditPost} title="继续编辑草稿">
                  继续编辑
                </button>
                <button
                  className={`${styles.actionButton} ${styles.publishDraftButton}`}
                  onClick={handlePublishDraft}
                  disabled={draftActionLoading}
                  title="发布草稿"
                >
                  {draftActionLoading ? '发布中...' : '立即发布'}
                </button>
                <button className={`${styles.actionButton} ${styles.dangerButton}`} onClick={handleDeletePost} title="删除草稿">
                  删除草稿
                </button>
              </>
            )}
            {!isLocalDraft && (
              <>
            <button
              className={`${styles.actionButton} ${isLiked(id) ? styles.liked : ''}`}
              onClick={handleToggleLike}
              title={isLiked(id) ? '取消点赞' : '点赞'}
            >
              {isLiked(id) ? '❤️' : '🤍'} 点赞
            </button>
            <button
              className={`${styles.actionButton} ${isFavorited(id) ? styles.favorited : ''}`}
              onClick={handleToggleFavorite}
              title={isFavorited(id) ? '取消收藏' : '收藏'}
            >
              {isFavorited(id) ? '⭐' : '☆'} 收藏
            </button>
            <button
              className={styles.actionButton}
              onClick={() => {
                if (!isViewerLoggedIn) {
                  window.alert('请先登录后再发帖！');
                  navigate('/login');
                  return;
                }
                setIsReplyOpen(true);
              }}
            >
              💬 回复
            </button>
            {canDeletePost && (
              <button className={`${styles.actionButton} ${styles.dangerButton}`} onClick={handleDeletePost} title="删除帖子">
                🗑️
              </button>
            )}
            {isSelfAuthor && (
              <button className={styles.actionButton} onClick={handleEditPost} title="编辑帖子">
                ✏️
              </button>
            )}
              </>
            )}
          </div>

          {!isLocalDraft && (
          <div className={styles.replySection}>
            <div className={styles.replyHeaderRow}>
              <h3 className={styles.replyTitle}>回复</h3>
              <div className={styles.replySort}>
                <button
                  type="button"
                  className={`${styles.replySortButton} ${replySort === 'time' ? styles.replySortActive : ''}`}
                  onClick={() => setReplySort('time')}
                >
                  时间
                </button>
                <button
                  type="button"
                  className={`${styles.replySortButton} ${replySort === 'likes' ? styles.replySortActive : ''}`}
                  onClick={() => setReplySort('likes')}
                >
                  点赞
                </button>
              </div>
            </div>
            {replies.length === 0 ? (
              <div className={styles.emptyReply}>还没有人回复，来抢沙发吧～</div>
            ) : (
              <div className={styles.replyList}>
                {sortedReplies
                  .map((reply) => (
                    <div key={reply.id} id={`reply-${reply.id}`} className={styles.replyItem}>
                      <div className={styles.replyBody}>
                        <div className={styles.replyHeader}>
                          <div className={styles.replyAuthor}>
                            {reply.author?.id ? (
                              <Link
                                to={`/user/${getMappedUserId(reply.author.id)}`}
                                state={{ author: { ...reply.author, id: getMappedUserId(reply.author.id) } }}
                                className={styles.replyAuthorLink}
                              >
                                <div
                                  className={styles.replyAvatar}
                                  style={reply.author.avatar ? { backgroundImage: `url(${reply.author.avatar})` } : undefined}
                                />
                                <span className={styles.replyName}>{reply.author.name}</span>
                                {replyTagMap.get(reply.id) && (
                                  <span className={`${styles.adminBadge} ${replyTagMap.get(reply.id).variant === 'user' ? styles.userBadge : ''}`}>
                                    {replyTagMap.get(reply.id).label}
                                  </span>
                                )}
                              </Link>
                            ) : (
                              <>
                                <div
                                  className={styles.replyAvatar}
                                  style={reply.author.avatar ? { backgroundImage: `url(${reply.author.avatar})` } : undefined}
                                />
                                <span className={styles.replyName}>{reply.author.name}</span>
                                {replyTagMap.get(reply.id) && (
                                  <span className={`${styles.adminBadge} ${replyTagMap.get(reply.id).variant === 'user' ? styles.userBadge : ''}`}>
                                    {replyTagMap.get(reply.id).label}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <span className={styles.replyTime}>
                            {new Date(reply.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {reply.parentId && (
                          <div className={styles.replyTo}>回复 @ {reply.replyToName}</div>
                        )}
                        <div className={styles.replyContent}>
                          <div className={`${styles.replyMarkdown} markdown-body markdown-reply`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkIns]}
                              rehypePlugins={[rehypeHighlight]}
                            >
                              {reply.content}
                            </ReactMarkdown>
                          </div>
                        </div>

                        <div className={styles.replyFooter}>
                          <button
                            className={`${styles.replyButton} ${isReplyLikedByUser(id, reply.id) ? styles.replyLiked : ''}`}
                            onClick={async () => {
                              if (!isViewerLoggedIn) {
                                window.alert('请先登录后再点赞！');
                                navigate('/login');
                                return;
                              }
                              if (userRestrictions.isBanned) {
                                window.alert('您的账号已被封禁，无法进行点赞操作。');
                                return;
                              }
                              if (userRestrictions.isMuted) {
                                window.alert('您已被禁言，暂时无法进行点赞操作。');
                                return;
                              }
                              const prevInfo = getReplyLikeInfo(id, reply.id);
                              // 乐观更新
                              const nextLiked = !prevInfo.liked;
                              const nextCount = Math.max(0, prevInfo.count + (nextLiked ? 1 : -1));
                              setReplyLikeMap((prev) => ({
                                ...prev,
                                [String(reply.id)]: { count: nextCount, liked: nextLiked },
                              }));
                              try {
                                const backendId = reply.backendId ?? Number(reply.id);
                                const result = await likeComment(authToken, backendId);
                                // 以后端返回的 likes 和 liked 为准
                                const trueLiked = result.liked ?? nextLiked;
                                setReplyLikeMap((prev) => ({
                                  ...prev,
                                  [String(reply.id)]: { count: result.likes ?? nextCount, liked: trueLiked },
                                }));
                              } catch {
                                // 回滚乐观更新
                                setReplyLikeMap((prev) => ({
                                  ...prev,
                                  [String(reply.id)]: prevInfo,
                                }));
                              }
                            }}
                          >
                            {isReplyLikedByUser(id, reply.id) ? '❤️' : '🤍'} {getReplyLikeInfo(id, reply.id).count}
                          </button>
                          <button
                            className={styles.replyButton}
                            onClick={() => handleOpenNestedReply(reply.id)}
                          >
                            回复
                          </button>
                          {(currentUser.isAdmin || (reply.author?.id && String(currentUser.backendId || currentUser.id) === String(reply.author.id))) && (
                            <button
                              className={styles.replyDeleteButton}
                              onClick={() => handleDeleteReply(reply.id)}
                            >
                              删除
                            </button>
                          )}
                        </div>

                        {activeReplyId === reply.id && (
                          <div className={styles.replyBox}>
                            <div className={styles.replyEditor}>
                              <MarkdownEditor
                                value={nestedDraft}
                                style={{ height: '220px' }}
                                onChange={({ text }) => setNestedDraft(text)}
                                renderHTML={(text) => (
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkIns]}
                                    rehypePlugins={[rehypeHighlight]}
                                  >
                                    {text}
                                  </ReactMarkdown>
                                )}
                                config={replyEditorConfig}
                                placeholder={`回复 @${reply.author.name} ...`}
                              />
                            </div>
                            <div className={styles.replyBoxActions}>
                              <button
                                className={styles.ghostButton}
                                onClick={() => setActiveReplyId(null)}
                              >
                                取消
                              </button>
                              <button
                                className={styles.primaryButton}
                                onClick={() => handleSubmitNestedReply(reply.id)}
                              >
                                发送回复
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          )}
        </>
      )}

      {hasAuthorLink && (
        <div className={styles.author}>
          <Link to={`/user/${mappedAuthorId}`} state={{ author: { ...authorInfo, id: mappedAuthorId } }} className={styles.authorLink}>
            <div
              className={styles.authorAvatar}
              style={authorInfo.avatar ? { backgroundImage: `url(${authorInfo.avatar})` } : undefined}
            />
            <span className={styles.authorName}>{authorInfo.name || '匿名'}</span>
          </Link>
        </div>
      )}

      {modalNode}
    </div>
  );
};

export default PostDetail;
