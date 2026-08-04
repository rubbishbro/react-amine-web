import React, { useState, useEffect, useRef, useCallback } from 'react';
import Post from '../Post';
import styles from './PostList.module.css';
import { loadPostsPage, getCategoryDisplayName } from '../../utils/postLoader';
import { getCategoryColor } from '../../config/colors';
import { getContrastTextColor, generateGradient } from '../../utils/colorUtils';
import { getPostStats } from '../../utils/postStats';

const PostList = ({ onReadMore, category = null }) => {
  const [posts, setPosts] = useState([]);
  const [allPostsCount, setAllPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('time');
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(null);
  const observerRef = useRef(null);
  const postsPerPage = 5;

  const applySort = useCallback((inputPosts, mode, categoryParam) => {
    const posts = [...inputPosts];
    const isPinnedPost = (post) => {
      if (categoryParam && categoryParam !== 'all') {
        return post.isPinnedInCurrentCategory;
      }
      return post.isPinnedGlobally;
    };
    const getLikeCount = (post) => {
      const baseStats = { likes: post?.likes ?? 0 };
      return getPostStats(post?.id, baseStats).likes;
    };

    return posts.sort((a, b) => {
      const aPinned = isPinnedPost(a);
      const bPinned = isPinnedPost(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned && a.order !== b.order) return a.order - b.order;
      if (mode === 'likes') {
        const likeDiff = getLikeCount(b) - getLikeCount(a);
        if (likeDiff !== 0) return likeDiff;
      }
      return new Date(b.date) - new Date(a.date);
    });
  }, []);

  // 根据分类加载帖子
  const loadPosts = useCallback(async (pageNum = 1, categoryParam = null, sortModeParam = 'time', forceRefresh = false) => {
    try {
      setLoading(true);

      const { posts: fetchedPosts, remoteTotal: nextRemoteTotal, localDraftCount, remoteCount } = await loadPostsPage({
        page: pageNum,
        pageSize: postsPerPage,
        category: categoryParam,
        forceRefresh,
      });

      const sortedPosts = applySort(fetchedPosts, sortModeParam, categoryParam);

      setPosts((prev) => (pageNum === 1 ? sortedPosts : [...prev, ...sortedPosts]));
      setPage(pageNum);
      setAllPostsCount(nextRemoteTotal + localDraftCount);
      setHasMore(pageNum * postsPerPage < nextRemoteTotal && remoteCount > 0);
      setError(null);
      return sortedPosts;
    } catch (err) {
      setError('加载帖子失败，请刷新重试');
      console.error('Error loading posts:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [postsPerPage, applySort]);

  // 初始加载帖子
  useEffect(() => {
    loadPosts(1, category, sortMode);
  }, [category, sortMode, loadPosts]);

  // 手动刷新功能
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPosts(1, category, sortMode, true);
    } catch (err) {
      console.error('刷新失败:', err);
    } finally {
      setRefreshing(false);
    }
  }, [category, sortMode, loadPosts]);

  // 加载更多帖子
  const loadMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    await loadPosts(nextPage, category, sortMode, false);
  }, [page, loading, hasMore, loadPosts, category, sortMode]);

  // 观察器回调
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      loadMorePosts();
    }
  }, [hasMore, loading, loadMorePosts]);

  // 设置Intersection Observer
  useEffect(() => {
    const currentLoaderRef = loaderRef.current;
    const option = {
      root: null,
      rootMargin: "20px",
      threshold: 0
    };

    // 先清理之前的observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 创建新的observer
    const observer = new IntersectionObserver(handleObserver, option);
    observerRef.current = observer;

    if (currentLoaderRef) {
      observer.observe(currentLoaderRef);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [handleObserver]);

  // 获取当前分类的显示名称（中文）
  const getCategoryLabel = useCallback(() => {
    if (!category || category === 'all') return '帖子';
    return getCategoryDisplayName(category);
  }, [category]);

  // 获取分类徽章的文本
  const getCategoryBadgeText = useCallback(() => {
    return `共 ${allPostsCount} 篇帖子`;
  }, [allPostsCount]);

  // 获取当前分类的颜色
  const getCurrentCategoryColor = useCallback(() => {
    if (!category || category === 'all') {
      return '#FFD6A5'; // 主页使用网站开发的颜色
    }
    return getCategoryColor(category);
  }, [category]);

  // 获取分类头部样式
  const getHeaderStyles = useCallback(() => {
    const color = getCurrentCategoryColor();
    return {
      borderBottom: `2px solid ${color}`,
      borderLeft: `4px solid ${color}`,
      paddingLeft: '12px'
    };
  }, [getCurrentCategoryColor]);

  // 获取徽章样式
  const getBadgeStyles = useCallback(() => {
    const color = getCurrentCategoryColor();
    return {
      background: generateGradient(color),
      color: getContrastTextColor(color)
    };
  }, [getCurrentCategoryColor]);

  // 获取加载更多按钮样式
  const getLoadMoreButtonStyles = useCallback(() => {
    const color = getCurrentCategoryColor();
    return {
      background: generateGradient(color),
      color: getContrastTextColor(color)
    };
  }, [getCurrentCategoryColor]);

  // 如果没有帖子
  if (!loading && posts.length === 0 && !error) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📝</div>
        <h3>暂无{getCategoryLabel()}</h3>
        <p>当前分类还没有发布任何内容</p>
      </div>
    );
  }

  return (
    <div className={styles.postList}>
      {/* 分类标题 - 使用动态样式 */}
      <div className={styles.categoryHeader} style={getHeaderStyles()}>
        <h2>
          {category && category !== 'all'
            ? getCategoryLabel()
            : '最新帖子'
          }
        </h2>
        <div className={styles.headerActions}>
          <div className={styles.categoryBadge} style={getBadgeStyles()}>
            {getCategoryBadgeText()}
          </div>
          <button
            type="button"
            className={`${styles.refreshButton} ${refreshing ? styles.refreshing : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="刷新帖子列表"
          >
            <span className={styles.refreshIcon}>{refreshing ? '🔄' : '🔃'}</span>
            <span className={styles.refreshText}>
              {refreshing ? '刷新中...' : '刷新'}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.sortToggle} ${sortMode === 'likes' ? styles.sortToggleActive : ''}`}
            onClick={() => setSortMode((prev) => (prev === 'time' ? 'likes' : 'time'))}
          >
            <span className={styles.sortIcon}>{sortMode === 'time' ? '🕒' : '💖'}</span>
            <span className={styles.sortText}>
              {sortMode === 'time' ? '时间排序' : '点赞排序'}
            </span>
            <span className={styles.sortHint}>点击切换</span>
          </button>
        </div>
      </div>

      {/* 帖子列表 */}
      <div className={styles.postsContainer}>
        {posts.map((post) => (
          <Post
            key={post.id}
            post={post}
            preview={true}
            onReadMore={onReadMore}
            isPinned={
              category && category !== 'all'
                ? post.isPinnedInCurrentCategory
                : post.isPinnedGlobally
            }
            currentCategory={category}
          />
        ))}
      </div>

      {/* 加载更多区域 */}
      <div className={styles.loaderArea}>
        <div ref={loaderRef} className={styles.sentinel} aria-hidden="true" />
        {loading ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
            <span>加载更多帖子中...</span>
          </div>
        ) : !hasMore ? (
          <div className={styles.endMessage}>
            <div className={styles.endIcon}>✨</div>
            <h3>已经到底了~</h3>
            <p>没有更多{getCategoryLabel()}了</p>
          </div>
        ) : (
          <div className={styles.loadingHint} style={getLoadMoreButtonStyles()}>
            继续下滑加载更多{getCategoryLabel()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostList;
