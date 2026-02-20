import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Post.module.css';
import { getCategoryColor } from '../../config';
import { Link, useNavigate } from 'react-router-dom';
import { getPostStats, onPostStatsUpdated } from '../../utils/postStats';
import { buildTagInfo } from '../../utils/adminMeta';
import { useUser } from '../../context/UserContext';
import { getMappedUserId } from '../../utils/userId';

const Post = ({ post, preview = false, onReadMore, isPinned = false, currentCategory = null }) => {
  const { user } = useUser();
  const isViewerLoggedIn = user?.loggedIn === true;
  // 如果是预览模式，只显示摘要
  const displayContent = preview
    ? (post?.summary || '')
    : (post?.content || post?.summary || '');

  // 显示置顶在哪些分类中
  const renderPinnedInfo = () => {
    if (!isPinned) {
      return null;
    }

    if (!post.pinnedInCategories || post.pinnedInCategories.length === 0) {
      return (
        <div className={styles.pinnedBadge}>
          <span className={styles.pinnedIcon}>🔝</span>
          <span className={styles.pinnedText}>置顶</span>
        </div>
      );
    }

    // 如果只在当前分类中置顶，显示简单的"置顶"
    if (currentCategory && post.pinnedInCategories.length === 1 &&
      post.pinnedInCategories[0] === currentCategory) {
      return (
        <div className={styles.pinnedBadge}>
          <span className={styles.pinnedIcon}>🔝</span>
          <span className={styles.pinnedText}>置顶</span>
        </div>
      );
    }

    // 如果在多个分类中置顶，显示具体分类
    return (
      <div className={styles.pinnedBadge}>
        <span className={styles.pinnedIcon}>🔝</span>
        <span className={styles.pinnedText}>
          置顶：{post.pinnedInCategories.join('、')}
        </span>
      </div>
    );
  };

  const authorInfo = typeof post.author === 'object' && post.author !== null
    ? post.author
    : { name: post.author || '匿名' };
  const authorLinkId = getMappedUserId(authorInfo.id || '');
  const hasAuthorLink = !!authorLinkId;

  // 直接从后端数据构建 tagInfo，不依赖 localStorage
  const tagInfo = useMemo(() => buildTagInfo(authorInfo), [authorInfo]);

  const baseStats = useMemo(() => ({
    views: post?.views ?? 0,
    likes: post?.likes ?? 0,
    favorites: post?.favorites ?? 0,
    replies: post?.replies ?? 0,
  }), [post?.views, post?.likes, post?.favorites, post?.replies]);

  const navigate = useNavigate();

  const [stats, setStats] = useState(() => getPostStats(post?.id, baseStats));

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

  // 提前返回检查放在所有hooks之后
  if (!post) return null;

  return (
    <article className={`${styles.post} ${preview ? styles.preview : ''} ${isPinned ? styles.pinned : ''}`}>
      {/* 置顶标识 */}
      {isPinned && renderPinnedInfo()}

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
              to={`/user/${authorLinkId}`}
              state={{ author: { ...authorInfo, id: authorLinkId } }}
              className={styles.authorLink}
            >
              <div
                className={styles.authorAvatar}
                style={authorInfo.avatar ? { backgroundImage: `url(${authorInfo.avatar})` } : undefined}
              />
              <span className={styles.authorName}>{authorInfo.name || '匿名'}</span>
              {isViewerLoggedIn && tagInfo && (
                <span className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                  {tagInfo.label}
                </span>
              )}
            </Link>
          ) : (
            <span className={styles.author}>
              {authorInfo.name || '匿名'}
              {isViewerLoggedIn && tagInfo && (
                <span className={`${styles.adminBadge} ${tagInfo.variant === 'user' ? styles.userBadge : ''}`}>
                  {tagInfo.label}
                </span>
              )}
            </span>
          )}
          {post.readTime && (
            <span className={styles.readTime}>⏱️ {post.readTime}</span>
          )}
        </div>

        <h2 className={styles.postTitle}>
          {post.title}
        </h2>

        {post.tags && post.tags.length > 0 && (
          <div className={styles.tags}>
            {post.tags.map(tag => (
              <span key={tag} className={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.postContent}>
        {preview ? (
          <p className={styles.summary}>{displayContent}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 className={styles.markdownH1} {...props} />,
              h2: (props) => <h2 className={styles.markdownH2} {...props} />,
              h3: (props) => <h3 className={styles.markdownH3} {...props} />,
              p: (props) => <p className={styles.markdownParagraph} {...props} />,
              code: (props) => <code className={styles.inlineCode} {...props} />,
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt}
                  className={styles.markdownImage}
                  loading="lazy"
                />
              ),
              blockquote: (props) => (
                <blockquote className={styles.blockquote} {...props} />
              ),
              ul: (props) => <ul className={styles.markdownList} {...props} />,
              ol: (props) => <ol className={styles.markdownList} {...props} />,
              a: (props) => <a className={styles.markdownLink} {...props} />,
            }}
          >
            {displayContent}
          </ReactMarkdown>
        )}
      </div>

      <div className={styles.postFooter}>
        <div className={styles.postStats}>
          <span className={styles.statItem}>👀 {isViewerLoggedIn ? stats.views : '-'}</span>
          <span className={styles.statItem}>❤️ {isViewerLoggedIn ? stats.likes : '-'}</span>
          <span className={styles.statItem}>⭐ {isViewerLoggedIn ? stats.favorites : '-'}</span>
          <span className={styles.statItem}>💬 {isViewerLoggedIn ? stats.replies : '-'}</span>
        </div>

        {preview && (
          <div className={styles.readMore}>
            <button
              className={styles.readMoreButton}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onReadMore) {
                  onReadMore(post.id);
                  return;
                }
                if (post?.id) {
                  navigate(`/post/${post.id}`);
                }
              }}
            >
              阅读全文 →
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default Post;