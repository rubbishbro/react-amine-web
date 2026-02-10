import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './SearchResults.module.css';
import Post from '../Post';
import { useUser } from '../../context/UserContext';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState({ posts: [], users: [], isTagSearch: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'posts', 'users'

  useEffect(() => {
    if (!query.trim()) {
      setResults({ posts: [], users: [], isTagSearch: false });
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`http://localhost:8000/api/v1/search/all?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
          throw new Error('搜索请求失败');
        }
        
        const data = await response.json();
        setResults({
          posts: data.posts || [],
          users: data.users || [],
          isTagSearch: data.is_tag_search || false,
        });
      } catch (err) {
        console.error('搜索错误:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  const handleReadMore = (postId) => {
    navigate(`/post/${postId}`);
  };

  const handleUserClick = (userId, username) => {
    navigate(`/user/${username}`);
  };

  const totalResults = results.posts.length + results.users.length;

  if (!query.trim()) {
    return (
      <div className={styles.searchResults}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔍</span>
          <p className={styles.emptyText}>请输入搜索关键词</p>
          <p className={styles.emptyHint}>提示：以 # 开头搜索标签</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.searchResults}>
      {/* 搜索头部 */}
      <div className={styles.searchHeader}>
        <h2 className={styles.searchTitle}>
          {results.isTagSearch ? (
            <>搜索标签: <span className={styles.highlight}>#{query.substring(1)}</span></>
          ) : (
            <>搜索: <span className={styles.highlight}>{query}</span></>
          )}
        </h2>
        {!loading && (
          <p className={styles.searchStats}>
            找到 {totalResults} 个结果
            {results.posts.length > 0 && ` (${results.posts.length} 篇帖子`}
            {results.users.length > 0 && `, ${results.users.length} 位用户)`}
          </p>
        )}
      </div>

      {/* 标签页切换 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          全部 ({totalResults})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'posts' ? styles.active : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          帖子 ({results.posts.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          用户 ({results.users.length})
        </button>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>搜索中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* 搜索结果 */}
      {!loading && !error && (
        <>
          {totalResults === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>😔</span>
              <p className={styles.emptyText}>未找到相关结果</p>
              <p className={styles.emptyHint}>
                {results.isTagSearch 
                  ? '尝试搜索其他标签，或移除 # 进行普通搜索'
                  : '尝试使用不同的关键词，或以 # 开头搜索标签'
                }
              </p>
            </div>
          ) : (
            <>
              {/* 帖子结果 */}
              {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>📝 帖子</h3>
                  <div className={styles.postsList}>
                    {results.posts.map(post => (
                      <Post
                        key={post.id}
                        post={post}
                        preview={true}
                        onReadMore={handleReadMore}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 用户结果 */}
              {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>👤 用户</h3>
                  <div className={styles.usersList}>
                    {results.users.map(u => (
                      <div
                        key={u.id}
                        className={styles.userCard}
                        onClick={() => handleUserClick(u.id, u.username)}
                      >
                        <div className={styles.userAvatar}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                          <h4 className={styles.username}>{u.username}</h4>
                          <p className={styles.userEmail}>{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResults;
