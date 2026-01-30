import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './PostDetail.module.css';
import { loadPostContent } from '../../utils/postLoader';
import { getCategoryColor } from '../../config';

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getBackPath = () => {
    if (location.state?.from) return location.state.from;
    const referrer = document.referrer;
    if (referrer) {
      const url = new URL(referrer);
      if (url.origin === window.location.origin) return url.pathname;
    }
    return '/';
  };

  const handleBack = () => {
    navigate(getBackPath());
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

  const author = post?.author;

  return (
    <div className={styles.detail}>
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
                  <img src={src} alt={alt} className={styles.markdownImage} loading="lazy" />
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

      {author && (
        <div className={styles.author}>
          <Link to={`/user/${author.id}`} state={{ author }} className={styles.authorLink}>
            <div
              className={styles.authorAvatar}
              style={author.avatar ? { backgroundImage: `url(${author.avatar})` } : undefined}
            />
            <span className={styles.authorName}>{author.name}</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PostDetail;