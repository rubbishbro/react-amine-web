import React, { useState, useEffect, useRef, useCallback } from 'react';
import Post from '../Post';
import styles from './PostList.module.css';
import { loadAllPosts, loadPostsByCategory, getCategoryDisplayName } from '../../utils/postLoader';
import { getCategoryColor } from '../../config/colors';
import { getContrastTextColor, generateGradient } from '../../utils/colorUtils';

const PostList = ({ onReadMore, category = null }) => {
  const [posts, setPosts] = useState([]);
  const [allPostsCount, setAllPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const loaderRef = useRef(null);
  const observerRef = useRef(null);
  const postsPerPage = 5;

  // 根据分类加载帖子
  const loadPosts = useCallback(async (pageNum = 1, categoryParam = null) => {
    try {
      setLoading(true);
      
      let allPosts;
      if (categoryParam && categoryParam !== 'all') {
        allPosts = await loadPostsByCategory(categoryParam);
      } else {
        allPosts = await loadAllPosts();
      }
      
      // 存储总帖子数
      setAllPostsCount(allPosts.length);
      
      // 计算当前页的帖子
      const startIndex = 0;
      const endIndex = pageNum * postsPerPage;
      const currentPosts = allPosts.slice(startIndex, endIndex);
      
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
  }, [postsPerPage]);

  // 初始加载帖子
  useEffect(() => {
    loadPosts(1, category);
  }, [category, loadPosts]);

  // 加载更多帖子
  const loadMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;
    
    try {
      setLoading(true);
      const nextPage = page + 1;
      await loadPosts(nextPage, category);
    } catch (err) {
      setError('加载更多帖子失败');
      console.error('Error loading more posts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, category, loadPosts]);

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
    } else {
      // 主页显示总帖子数
      return `共 ${allPostsCount} 篇帖子`;
    }
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
        <div className={styles.categoryBadge} style={getBadgeStyles()}>
          {getCategoryBadgeText()}
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
      <div ref={loaderRef} className={styles.loaderArea}>
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
          <button 
            onClick={loadMorePosts}
            className={styles.loadMoreButton}
            disabled={loading}
            style={getLoadMoreButtonStyles()}
          >
            加载更多{getCategoryLabel()}
          </button>
        )}
      </div>
    </div>
  );
};

export default PostList;