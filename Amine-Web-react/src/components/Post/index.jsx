import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Post.module.css';

const Post = ({ post, preview = false,isPinned = false , onReadMore }) => {
  if (!post) return null;

  // 如果是预览模式，只显示摘要
  const displayContent = preview 
    ? post.summary 
    : (post.content || post.summary);

  // 根据分类设置不同的颜色
  const getCategoryColor = (category) => {
    const colors = {
      '季度新番': '#FF99C8',
      '社团活动': '#A9DEF9',
      '前沿技术': '#E4C1F9',
      '论坛闲聊': '#FCF6BD',
      '同人/杂谈': '#FF85A1',
      '网络资源': '#4CC9F0',
      '音游区': '#D0F4DE',
      '网站开发': '#FFD6A5'
    };
    return colors[category] || colors['论坛闲聊'];
  };

  return (
    <article className={`${styles.post} ${preview ? styles.preview : ''} ${isPinned ? styles.pinned : ''}`}>

      <div className={styles.postHeader}>
        <div className={styles.postMeta}>

          {/* 置顶标识 - 显示在左上角 */}
          {isPinned && (
            <div className={styles.pinnedBadge}>
              <span className={styles.pinnedIcon}>🔝</span>
              <span className={styles.pinnedText}>置顶</span>
            </div>
          )}

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
        
        <h2 className={styles.postTitle}>{post.title}</h2>
        
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