import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import MarkdownEditor from 'react-markdown-editor-lite';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'react-markdown-editor-lite/lib/index.css';
import styles from './PostEditor.module.css';
import { getAllCategories, loadPostContent } from '../../utils/postLoader';
import { getCategoryColor } from '../../config/colors';

const PostEditor = ({ isEditMode = false, initialData = null }) => {
  const navigate = useNavigate();
  const { id: postId } = useParams();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  // 初始化表单
  const { register, formState: { errors }, setValue, watch } = useForm({
    defaultValues: initialData || {
      title: '',
      category: '',
      summary: '',
      content: '# 请输入内容\n\n从这里开始编辑...',
      status: 'draft'
    }
  });

  const formData = watch();

  // 移除通知
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // 添加通知
  const addNotification = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    
    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration + 300);
    }
    
    return id;
  }, [removeNotification]);

  // 加载分类列表
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoryList = await getAllCategories();
        setCategories(categoryList);
      } catch (error) {
        console.error('加载分类失败:', error);
        addNotification('加载分类失败', 'error');
      }
    };
    
    loadCategories();
  }, [addNotification]);

  // 如果是编辑模式，加载帖子数据
  useEffect(() => {
    if (isEditMode && postId) {
      const loadPost = async () => {
        setLoading(true);
        try {
          const postData = await loadPostContent(postId);
          if (postData) {
            // 设置表单值
            Object.keys(postData).forEach(key => {
              if (key in formData) {
                setValue(key, postData[key]);
              }
            });
            
            // 设置标签
            if (postData.tags) {
              setTags(postData.tags);
            }
          }
        } catch (error) {
          console.error('加载帖子失败:', error);
          addNotification('加载帖子失败', 'error');
        } finally {
          setLoading(false);
        }
      };
      
      loadPost();
    }
  }, [isEditMode, postId, setValue, formData, addNotification]);

  // 监听表单变化
  useEffect(() => {
    const subscription = watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // 标签处理函数
  const handleAddTag = useCallback((e) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        setTags([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  }, [currentTag, tags]);

  const handleRemoveTag = useCallback((tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  }, [tags]);

  // 自动计算阅读时间
  const calculateReadTime = useCallback((content) => {
    if (!content) return '0 min read';
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
  }, []);

  // 自动生成摘要
  const generateSummary = useCallback((content) => {
    if (!content) return '';
    const plainText = content.replace(/[#*`[\]()]/g, '').trim();
    return plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
  }, []);

  // 修改 handleSave 函数，确保状态正确传递
  const handleSave = useCallback(async (status = 'draft') => {
    console.log('handleSave 调用，状态:', status);
    
    // 基础验证
    if (!formData.title.trim()) {
      addNotification('请输入帖子标题', 'warning', 2000);
      return;
    }
    
    if (!formData.category) {
      addNotification('请选择帖子分类', 'warning', 2000);
      return;
    }
    
    if (!formData.content.trim() || formData.content.trim() === '# 请输入内容\n\n从这里开始编辑...') {
      addNotification('请输入帖子内容', 'warning', 2000);
      return;
    }
    
    setLoading(true);
    
    try {
      // 准备数据 - 确保 status 正确传递
      const postData = {
        ...formData,
        tags: tags,
        date: new Date().toISOString().split('T')[0],
        author: 'Lilizi-ovo',
        readTime: calculateReadTime(formData.content),
        status: status // 确保这里使用的是传入的 status 参数
      };
      
      console.log('准备保存，状态:', status, '数据状态:', postData.status);
      
      // 如果摘要为空，自动生成
      if (!postData.summary) {
        postData.summary = generateSummary(formData.content);
      }
      
      // 如果是编辑模式且没有ID，自动生成ID
      if (!postData.id && !isEditMode) {
        postData.id = `post-${Date.now()}`;
      }
      
      // TODO: 调用API保存数据
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 根据状态显示不同的通知
      console.log('保存完成，显示通知，状态:', status);
      if (status === 'draft') {
        addNotification('草稿已保存到服务器', 'success');
      } else {
        addNotification('帖子已成功发布', 'success');
      }
      
      setHasUnsavedChanges(false);
      
      // 只有发布状态才跳转
      if (status === 'published') {
        console.log('发布成功，准备跳转');
        setTimeout(() => {
          navigate(`/post/${postData.id}`);
        }, 1500);
      }
      
    } catch (error) {
      console.error('保存失败:', error);
      addNotification('保存失败，请检查网络连接', 'error', 4000);
    } finally {
      setLoading(false);
    }
  }, [formData, tags, calculateReadTime, generateSummary, isEditMode, addNotification, navigate]);

  // 处理发布
  const handlePublish = useCallback(() => {
    if (!formData.title.trim()) {
      addNotification('请输入帖子标题', 'warning', 2000);
      return;
    }
    
    if (!formData.category) {
      addNotification('请选择帖子分类', 'warning', 2000);
      return;
    }
    
    if (!formData.content.trim() || formData.content.trim() === '# 请输入内容\n\n从这里开始编辑...') {
      addNotification('请输入帖子内容', 'warning', 2000);
      return;
    }
    
    handleSave('published');
  }, [formData, addNotification, handleSave]);

  // 处理取消
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm('您有未保存的更改，确定要离开吗？')) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  }, [hasUnsavedChanges, navigate]);

  // Markdown编辑器配置
  const mdEditorConfig = {
    view: {
      menu: true,
      md: true,
      html: true
    },
    canView: {
      menu: true,
      md: true,
      html: true,
      fullScreen: true,
      hideMenu: true
    },
    htmlClass: styles.markdownPreview,
    markdownClass: styles.markdownEditor,
    syncScrollMode: ['leftFollowRight', 'rightFollowLeft'],
    imageAccept: '.jpg,.jpeg,.png,.gif,.webp',
    linkAccept: '.*'
  };

  if (loading && isEditMode) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }

  // 通知组件
  // 在 PostEditor 组件中的 Notification 内部组件
  const Notification = ({ notification }) => {
    const [progress, setProgress] = useState(100);
    const [isExiting, setIsExiting] = useState(false);

    // 将 startExit 移到 useEffect 之前，并用 useCallback 包装
    const startExit = useCallback(() => {
      setIsExiting(true);
      setTimeout(() => {
        removeNotification(notification.id);
      }, 300);
    }, [notification.id]);

    useEffect(() => {
      if (notification.duration > 0) {
        const startTime = Date.now();
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, 100 - (elapsed / notification.duration * 100));
          setProgress(remaining);
          
          if (remaining <= 0) {
            clearInterval(interval);
            startExit();
          }
        }, 50);

        return () => clearInterval(interval);
      }
    }, [notification.duration, startExit]); // 添加 startExit 到依赖数组

    const handleClose = (e) => {
      e.stopPropagation();
      startExit();
    };

    const icons = {
      success: '✅',
      error: '❌',
      info: '💡',
      warning: '⚠️'
    };

    const typeLabels = {
      success: '成功',
      error: '错误',
      info: '信息',
      warning: '警告'
    };

    return (
      <div 
        className={`${styles.notification} ${styles[notification.type]} ${isExiting ? styles.exiting : ''}`}
        onClick={startExit}
      >
        <div className={styles.notificationHeader}>
          <div className={styles.notificationIcon}>
            {icons[notification.type]}
          </div>
          <div className={styles.notificationTitle}>
            <span className={styles.notificationType}>{typeLabels[notification.type]}</span>
            <span className={styles.notificationTime}>刚刚</span>
          </div>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        
        <div className={styles.notificationBody}>
          {notification.message}
        </div>
        
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={styles.postEditor}>
      {/* 头部操作栏 */}
      <div className={styles.editorHeader}>
        <button onClick={handleCancel} className={styles.backButton}>
          ← 返回
        </button>
        
        <div className={styles.headerTitle}>
          <h2>{isEditMode ? '编辑帖子' : '新建帖子'}</h2>
          {hasUnsavedChanges && (
            <span className={styles.unsavedIndicator}>未保存</span>
          )}
        </div>
        
        <div className={styles.headerActions}>
          {/* 保存草稿按钮 - 明确传递 'draft' */}
          <button 
            onClick={() => {
              console.log('点击保存草稿按钮');
              handleSave('draft');
            }}
            className={`${styles.actionButton} ${styles.saveDraftButton}`}
            disabled={loading}
          >
            {loading ? '保存中...' : '保存草稿'}
          </button>
          
          {/* 发布按钮 - 调用 handlePublish */}
          <button 
            onClick={() => {
              console.log('点击发布按钮');
              handlePublish();
            }}
            className={`${styles.actionButton} ${styles.publishButton}`}
            disabled={loading}
          >
            {loading ? '发布中...' : '发布帖子'}
          </button>
        </div>
      </div>

      {/* 主编辑区域 */}
      <div className={styles.editorContent}>
        {/* 标题输入 */}
        <div className={styles.formGroup}>
          <input
            type="text"
            placeholder="输入帖子标题..."
            className={`${styles.titleInput} ${errors.title ? styles.error : ''}`}
            {...register('title', { 
              required: '标题不能为空',
              minLength: { value: 2, message: '标题至少2个字' },
              maxLength: { value: 100, message: '标题最多100个字' }
            })}
          />
          {errors.title && (
            <span className={styles.errorMessage}>{errors.title.message}</span>
          )}
          <div className={styles.charCount}>
            {formData.title.length}/100
          </div>
        </div>

        {/* 基本信息 */}
        <div className={styles.basicInfo}>
          <div className={styles.formGroup}>
            <label className={styles.label}>分类 *</label>
            <select
              className={`${styles.categorySelect} ${errors.category ? styles.error : ''}`}
              {...register('category', { required: '请选择分类' })}
              style={{
                borderColor: formData.category ? getCategoryColor(formData.category) : '#e0e0e0',
                color: formData.category ? getCategoryColor(formData.category) : 'var(--text-sub)'
              }}
              onChange={(e) => {
                setValue('category', e.target.value);
              }}
            >
              <option value="" style={{ color: 'var(--text-sub)' }}>选择分类</option>
              {categories.map(cat => {
                const categoryColor = getCategoryColor(cat.name);
                return (
                  <option 
                    key={cat.id} 
                    value={cat.name}
                    style={{
                      color: categoryColor,
                      backgroundColor: 'white',
                      fontWeight: '600'
                    }}
                  >
                    {cat.name}
                  </option>
                );
              })}
            </select>
            {errors.category && (
              <span className={styles.errorMessage}>{errors.category.message}</span>
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>作者</label>
            <div className={styles.authorDisplay}>Lilizi-ovo</div>
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>发布日期</label>
            <div className={styles.dateDisplay}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </div>
          </div>
        </div>

        {/* 标签输入 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>标签</label>
          <div className={styles.tagInputContainer}>
            <input
              type="text"
              placeholder="输入标签后按回车添加"
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              onKeyDown={handleAddTag}
              className={styles.tagInput}
            />
            <div className={styles.tagsDisplay}>
              {tags.map((tag, index) => {
                const tagColors = [
                  { bg: 'rgba(255, 133, 161, 0.1)', color: '#FF85A1', border: 'rgba(255, 133, 161, 0.3)' },
                  { bg: 'rgba(76, 201, 240, 0.1)', color: '#4CC9F0', border: 'rgba(76, 201, 240, 0.3)' },
                  { bg: 'rgba(255, 209, 102, 0.1)', color: '#FFD166', border: 'rgba(255, 209, 102, 0.3)' },
                  { bg: 'rgba(102, 187, 106, 0.1)', color: '#06D6A0', border: 'rgba(102, 187, 106, 0.3)' },
                ];
                const colorIndex = index % tagColors.length;
                const tagStyle = tagColors[colorIndex];
                
                return (
                  <span 
                    key={tag} 
                    className={styles.tag}
                    style={{
                      backgroundColor: tagStyle.bg,
                      color: tagStyle.color,
                      borderColor: tagStyle.border
                    }}
                  >
                    #{tag}
                    <button 
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className={styles.removeTag}
                      style={{ color: tagStyle.color }}
                      aria-label={`删除标签 ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 摘要输入 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            摘要
            <span className={styles.optional}>(可选，不填将自动生成)</span>
          </label>
          <textarea
            placeholder="输入帖子摘要，建议不超过200字..."
            className={`${styles.summaryInput} ${errors.summary ? styles.error : ''}`}
            {...register('summary', { 
              maxLength: { value: 300, message: '摘要最多300个字' }
            })}
            rows="3"
          />
          {errors.summary && (
            <span className={styles.errorMessage}>{errors.summary.message}</span>
          )}
          <div className={styles.charCount}>
            {formData.summary?.length || 0}/300
          </div>
        </div>

        {/* Markdown编辑器 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>内容 *</label>
          <div className={styles.markdownContainer}>
            <MarkdownEditor
              value={formData.content}
              style={{ height: '500px' }}
              onChange={({ text }) => setValue('content', text)}
              renderHTML={(text) => (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {text}
                </ReactMarkdown>
              )}
              config={mdEditorConfig}
              placeholder="在这里输入Markdown格式的内容..."
            />
          </div>
          {errors.content && (
            <span className={styles.errorMessage}>{errors.content.message}</span>
          )}
        </div>

        {/* 阅读时间预览 */}
        <div className={styles.previewInfo}>
          <div className={styles.readTimePreview}>
            ⏱️ 预计阅读时间: {calculateReadTime(formData.content)}
          </div>
        </div>
      </div>

      {/* 通知容器 */}
      <div className={styles.notificationContainer}>
        {notifications.map(notification => (
          <Notification 
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>
    </div>
  );
};

export default PostEditor;