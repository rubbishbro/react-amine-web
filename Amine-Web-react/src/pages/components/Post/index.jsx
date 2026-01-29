import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Post.module.css';
import { getCategoryColor } from '../../config';

const Post = ({ post, preview = false, onReadMore, isPinned = false, currentCategory = null }) => {
  
  if (!post) return null;

  // 如果是预览模式，只显示摘要
  const displayContent = preview 
    ? post.summary 
    : (post.content || post.summary);

  // 显示置顶在哪些分类中
  const renderPinnedInfo = () => {
    if (!isPinned || !post.pinnedInCategories || post.pinnedInCategories.length === 0) {
      return null;
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
          <span className={styles.author}>👤 {post.author}</span>
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

      {preview && (
        <div className={styles.readMore}>
          <button 
            className={styles.readMoreButton}
            onClick={(e) => {
              e.stopPropagation();
              if (onReadMore) onReadMore(post.id);
            }}
          >
            阅读全文 →
          </button>
        </div>
      )}
    </article>
  );
};

export default Post;