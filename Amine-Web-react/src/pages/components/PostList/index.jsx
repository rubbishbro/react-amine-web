import React, { useState, useEffect, useRef, useCallback } from 'react';
import Post from '../Post';
import styles from './PostList.module.css';
import { loadAllPosts, loadPostsByCategory, getCategoryDisplayName } from '../../utils/postLoader';
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
  const loaderRef = useRef(null);
  const observerRef = useRef(null);
  const allPostsRef = useRef([]);
  const allPostsRawRef = useRef([]);
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
  const loadPosts = useCallback(async (pageNum = 1, categoryParam = null, sortModeParam = 'time') => {
    try {
      setLoading(true);

      let allPosts;
      if (categoryParam && categoryParam !== 'all') {
        allPosts = await loadPostsByCategory(categoryParam);
      } else {
        allPosts = await loadAllPosts();
      }
      const sortedPosts = applySort(allPosts, sortModeParam, categoryParam);
      // 存储总帖子数 & 缓存所有帖子
      allPostsRawRef.current = allPosts;
      allPostsRef.current = sortedPosts;
      setAllPostsCount(sortedPosts.length);

      // 计算当前页的帖子
      const startIndex = 0;
      const endIndex = pageNum * postsPerPage;
      const currentPosts = sortedPosts.slice(startIndex, endIndex);

      setPosts(currentPosts);
      setPage(pageNum);
      setHasMore(currentPosts.length < allPosts.length);
      setError(null);

      return allPosts;
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

  useEffect(() => {
    const rawPosts = allPostsRawRef.current || [];
    if (!rawPosts.length) return;
    const sortedPosts = applySort(rawPosts, sortMode, category);
    allPostsRef.current = sortedPosts;
    const endIndex = page * postsPerPage;
    setPosts(sortedPosts.slice(0, endIndex));
    setHasMore(endIndex < sortedPosts.length);
    setAllPostsCount(sortedPosts.length);
  }, [sortMode, category, page, postsPerPage, applySort]);

  // 加载更多帖子
  const loadMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const nextPage = page + 1;
      const endIndex = nextPage * postsPerPage;
      const cachedPosts = allPostsRef.current || [];
      const nextPosts = cachedPosts.slice(0, endIndex);
      setPosts(nextPosts);
      setPage(nextPage);
      setHasMore(nextPosts.length < cachedPosts.length);
      setError(null);
    } catch (err) {
      setError('加载更多帖子失败');
      console.error('Error loading more posts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, postsPerPage]);

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
    if (category && category !== 'all') {
      return `共 ${posts.length} 篇帖子`;
    }
    return `共 ${allPostsCount} 篇帖子`;
  }, [category, posts.length, allPostsCount]);

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