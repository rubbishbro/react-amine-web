import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import rehypeHighlight from 'rehype-highlight';
import MarkdownEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import styles from './PostDetail.module.css';
import { loadPostContent, markPostDeleted, setPostPinnedLocally } from '../../utils/postLoader';
import { getCategoryColor } from '../../config';
import { useUser } from '../../context/UserContext';
import {
  getPostStats,
  incrementPostViews,
  onPostStatsUpdated,
  syncPostReplies,
  updatePostFavorites,
  updatePostLikes,
} from '../../utils/postStats';
import { buildTagInfo, readAdminMeta, getUserRestrictions } from '../../utils/adminMeta';
import { buildUserId } from '../../utils/userId';
import { getFollowerCount, isFollowingUser, toggleFollowUser } from '../../utils/followStore';

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
  const { user, toggleLike, toggleFavorite, isLiked, isFavorited } = useUser();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replies, setReplies] = useState([]);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [followVersion, setFollowVersion] = useState(0);
  const adminMenuRef = useRef(null);
  const viewTrackedRef = useRef(null);
  const LOCAL_REPLIES_KEY = 'aw_local_replies';

  const readLocalReplies = () => {
    try {
      const raw = localStorage.getItem(LOCAL_REPLIES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('Error reading local replies:', error);
      return {};
    }
  };

  const writeLocalReplies = (data) => {
    try {
      localStorage.setItem(LOCAL_REPLIES_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing local replies:', error);
    }
  };

  const loadRepliesFromCache = (postId) => {
    const data = readLocalReplies();
    const list = Array.isArray(data[postId]) ? data[postId] : [];
    setReplies(list);
  };

  const persistReplies = (postId, nextReplies) => {
    const data = readLocalReplies();
    data[postId] = nextReplies;
    writeLocalReplies(data);
  };
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [nestedDraft, setNestedDraft] = useState('');

  // 构建当前用户信息，ID生成方式与帖子作者一致
  const currentUserName = user?.profile?.name || '游客';
  const currentUserId = buildUserId(currentUserName, user?.id || 'guest');
  const currentUser = {
    id: currentUserId,
    name: currentUserName,
    avatar: user?.profile?.avatar || '',
    school: user?.profile?.school || '',
    className: user?.profile?.className || '',
    email: user?.profile?.email || '',
    isAdmin: user?.isAdmin === true,
  };

  // 获取当前用户的禁言/封禁状态
  const userRestrictions = useMemo(() => getUserRestrictions(currentUserId), [currentUserId]);

  const authorMeta = useMemo(() => readAdminMeta(post?.author?.id), [post?.author?.id]);

  const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
    if (id) {
      loadRepliesFromCache(id);
    }
  }, [id]);

  const handleSubmitReply = () => {
    if (!user?.loggedIn) {
      window.alert('请先登录后再评论');
      navigate('/profile');
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
    const newReply = {
      id: createId(),
      author: currentUser,
      content: replyDraft.trim(),
      createdAt: new Date().toISOString(),
      parentId: null,
      replyToName: null,
    };
    setReplies((prev) => {
      const next = [...prev, newReply];
      persistReplies(id, next);
      return next;
    });
    setReplyDraft('');
    setIsReplyOpen(false);
  };

  const handleOpenNestedReply = (replyId) => {
    if (!user?.loggedIn) {
      window.alert('请先登录后再评论');
      navigate('/profile');
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

  const handleSubmitNestedReply = (replyId) => {
    if (!user?.loggedIn) {
      window.alert('请先登录后再评论');
      navigate('/profile');
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
    const newReply = {
      id: createId(),
      author: currentUser,
      content: nestedDraft.trim(),
      createdAt: new Date().toISOString(),
      parentId: replyId,
      replyToName: target?.author?.name || '用户',
    };
    setReplies((prev) => {
      const next = [...prev, newReply];
      persistReplies(id, next);
      return next;
    });
    setNestedDraft('');
    setActiveReplyId(null);
  };

  const handleDeletePost = () => {
    const canDeletePost = currentUser.isAdmin || (post?.author?.id && currentUser.id === post.author.id);
    if (!canDeletePost) {
      window.alert('你没有权限删除该帖子。');
      return;
    }
    if (!window.confirm('确定删除该帖子吗？此操作不可恢复。')) return;
    markPostDeleted(id);
    setPost(null);
    handleBack();
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
    const canEdit = authorInfo.id && currentUser.id === authorInfo.id;
    if (!canEdit) return;
    navigate(`/editor/${id}`);
  };

  const handleDeleteReply = (replyId) => {
    const target = replies.find((reply) => reply.id === replyId);
    const canDeleteReply = currentUser.isAdmin || (target?.author?.id && currentUser.id === target.author.id);
    if (!canDeleteReply) {
      window.alert('你没有权限删除该回复。');
      return;
    }
    if (!window.confirm('确定删除该回复吗？')) return;
    setReplies((prev) => {
      const next = prev.filter((reply) => reply.id !== replyId && reply.parentId !== replyId);
      persistReplies(id, next);
      return next;
    });
    if (activeReplyId === replyId) {
      setActiveReplyId(null);
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
    if (!post?.id) return;
    if (viewTrackedRef.current === post.id) return;
    viewTrackedRef.current = post.id;
    incrementPostViews(post.id);
  }, [post?.id]);

  useEffect(() => {
    if (!id) return;
    syncPostReplies(id, replies.length);
  }, [id, replies.length]);

  const handleToggleLike = () => {
    if (!user?.loggedIn) {
      window.alert('请先登录后再点赞');
      navigate('/profile');
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
    if (!user?.loggedIn) {
      window.alert('请先登录后再收藏');
      navigate('/profile');
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
  const authorInfo = typeof author === 'object' && author !== null
    ? author
    : { name: author || '匿名' };
  const hasAuthorLink = !!authorInfo.id;
  const authorTagInfo = useMemo(() => buildTagInfo(authorInfo, authorMeta), [authorInfo, authorMeta]);
  const authorId = authorInfo?.id || '';
  const viewerId = user?.id || '';
  const isSelfAuthor = useMemo(() => isSameUser(authorInfo, currentUser), [authorInfo, currentUser]);
  const isFollowing = useMemo(
    () => isFollowingUser(viewerId, authorId),
    [viewerId, authorId, followVersion]
  );
  const followerCount = useMemo(
    () => getFollowerCount(authorId),
    [authorId, followVersion]
  );
  const replyTagMap = useMemo(() => {
    const map = new Map();
    replies.forEach((reply) => {
      if (!reply?.author?.id) return;
      const meta = readAdminMeta(reply.author.id);
      const info = buildTagInfo(reply.author, meta);
      if (info) {
        map.set(reply.id, info);
      }
    });
    return map;
  }, [replies]);
  const canDeletePost = currentUser.isAdmin || (authorInfo.id && currentUser.id === authorInfo.id);

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
                  to={`/user/${authorInfo.id}`}
                  state={{ author: authorInfo }}
                  className={styles.authorLink}
                >
                  <div
                    className={styles.authorAvatar}
                    style={authorInfo.avatar ? { backgroundImage: `url(${authorInfo.avatar})` } : undefined}
                  />
                  <span className={styles.authorName}>{authorInfo.name || '匿名'}</span>
                  {authorTagInfo && (
                    <span className={`${styles.adminBadge} ${authorTagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                      {authorTagInfo.label}
                    </span>
                  )}
                </Link>
              ) : (
                <span className={styles.author}>
                  {authorInfo.name || '匿名'}
                  {authorTagInfo && (
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
                  onClick={() => {
                    if (isSelfAuthor) {
                      return;
                    }
                    toggleFollowUser(viewerId, authorId);
                    setFollowVersion((prev) => prev + 1);
                  }}
                  disabled={isSelfAuthor}
                >
                  {isFollowing ? '已关注' : '关注'}
                </button>
              )}
              {authorId && (
                <span className={styles.followCount}>粉丝 {followerCount}</span>
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
              <span className={styles.statItem}>👀 {stats.views}</span>
              <span className={styles.statItem}>❤️ {stats.likes}</span>
              <span className={styles.statItem}>⭐ {stats.favorites}</span>
              <span className={styles.statItem}>💬 {stats.replies}</span>
            </div>

            <h1 className={styles.postTitle}>{post.title}</h1>

            {post.tags && post.tags.length > 0 && (
              <div className={styles.tags}>
                {post.tags.map(tag => (
                  <span key={tag} className={styles.tag}>#{tag}</span>
                ))}
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
            <button className={styles.actionButton} onClick={() => setIsReplyOpen(true)}>
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
          </div>

          <div className={styles.replySection}>
            <h3 className={styles.replyTitle}>回复</h3>
            {replies.length === 0 ? (
              <div className={styles.emptyReply}>还没有人回复，来抢沙发吧～</div>
            ) : (
              <div className={styles.replyList}>
                {[...replies]
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .map((reply) => (
                    <div key={reply.id} className={styles.replyItem}>
                      <div className={styles.replyBody}>
                        <div className={styles.replyHeader}>
                          <div className={styles.replyAuthor}>
                            {reply.author?.id ? (
                              <Link
                                to={`/user/${reply.author.id}`}
                                state={{ author: reply.author }}
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
                            className={styles.replyButton}
                            onClick={() => handleOpenNestedReply(reply.id)}
                          >
                            回复
                          </button>
                          {(currentUser.isAdmin || (reply.author?.id && currentUser.id === reply.author.id)) && (
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
        </>
      )}

      {hasAuthorLink && (
        <div className={styles.author}>
          <Link to={`/user/${authorInfo.id}`} state={{ author: authorInfo }} className={styles.authorLink}>
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