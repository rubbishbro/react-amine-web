import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './PostDetail.module.css';
import { loadPostContent } from '../../utils/postLoader'; // 如果这个文件存在

const PostDetail = () => {
  const { id: postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        
        // 如果有 postLoader，使用它
        if (typeof loadPostContent === 'function') {
          const postData = await loadPostContent(postId);
          if (postData) {
            setPost(postData);
            setError(null);
          } else {
            setError('帖子不存在或加载失败');
          }
        }
      } catch (err) {
        setError('加载帖子时发生错误');
        console.error('Error loading post:', err);
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      loadPost();
    }
  }, [postId]);

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

  return (
    <div className={styles.postDetail}>
      <button onClick={() => navigate('/')} className={styles.backButton}>
        ← 返回
      </button>
      
      {post && (
        <>
          <div className={styles.postHeader}>
            <div className={styles.postMeta}>
              <span 
                className={styles.category}
                style={{ 
                  backgroundColor: getCategoryColor(post.category) 
                }}
              >
                {post.category}
              </span>
              <span className={styles.date}>
                📅 {new Date(post.date).toLocaleDateString('zh-CN')}
              </span>
              <span className={styles.author}>👤 {post.author}</span>
              {post.readTime && (
                <span className={styles.readTime}>⏱️ {post.readTime}</span>
              )}
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

          <div className={styles.postContent}>
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
              {post.content || post.summary}
            </ReactMarkdown>
          </div>
        </>
      )}
    </div>
  );
};

// 辅助函数：获取分类颜色
const getCategoryColor = (category) => {
  const colors = {
    '季度新番': '#FF99C8',
    '社团活动': '#A9DEF9',
    '前沿技术': '#E4C1F9',
    '论坛闲聊': '#FCF6BD',
    '同人/杂谈': '#FF85A1',
    '网络资源': '#4CC9F0',
    '音游区': '#D0F4DE'
  };
  return colors[category] || colors['论坛闲聊'];
};

export default PostDetail;