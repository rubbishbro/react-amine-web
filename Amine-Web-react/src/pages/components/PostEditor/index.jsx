import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import MarkdownEditor from 'react-markdown-editor-lite';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkIns from 'remark-ins';
import rehypeHighlight from 'rehype-highlight';
import 'react-markdown-editor-lite/lib/index.css';
import styles from './PostEditor.module.css';
import { getAllCategories, loadPostContent, upsertLocalPost } from '../../utils/postLoader';
import { getCategoryTextColor } from '../../config';
import { useUser } from '../../context/UserContext';
import { buildUserId } from '../../utils/userId';
import { calculatePostReadTime, getPostWordCount } from '../../utils/postReadTime';

const PostEditor = ({ isEditMode = false, initialData = null }) => {
  const navigate = useNavigate();
  const { id: postId } = useParams();
  const { user } = useUser();
  const [loading, setLoading] = useState(false); // 保持用于编辑模式加载
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 添加独立的状态管理
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishLockRef = useRef(false);
  const draftLockRef = useRef(false);

  // 初始化表单
  const { register, formState: { errors }, setValue, watch, reset } = useForm({
    defaultValues: initialData || {
      title: '',
      category: '',
      summary: '',
      content: '# 请输入内容\n\n从这里开始编辑...',
      status: 'draft'
    }
  });

  const formData = watch();

  const logMessage = useCallback((message, level = 'warn') => {
    if (level === 'error') {
      console.error(message);
    } else if (level === 'info') {
      console.info(message);
    } else {
      console.warn(message);
    }
  }, []);

  // 加载分类列表
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoryList = await getAllCategories();
        setCategories(categoryList);
      } catch (error) {
        console.error('加载分类失败:', error);
        logMessage('加载分类失败', 'error');
      }
    };

    loadCategories();
  }, [logMessage]);

  // 如果是编辑模式，加载帖子数据
  useEffect(() => {
    if (isEditMode && postId) {
      const loadPost = async () => {
        setLoading(true);
        try {
          const postData = await loadPostContent(postId);
          if (postData) {
            reset({
              title: postData.title || '',
              category: postData.category || '',
              summary: postData.summary || '',
              content: postData.content || postData.summary || '# 请输入内容\n\n从这里开始编辑...',
              status: postData.status || 'draft',
              id: postData.id,
              tags: postData.tags || [],
            });

            if (postData.tags) {
              setTags(postData.tags);
            } else {
              setTags([]);
            }
            setHasUnsavedChanges(false);
          }
        } catch (error) {
          console.error('加载帖子失败:', error);
          logMessage('加载帖子失败', 'error');
        } finally {
          setLoading(false);
        }
      };

      loadPost();
    }
  }, [isEditMode, postId, reset, logMessage]);

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

  // 自动生成摘要
  const generateSummary = useCallback((content) => {
    if (!content) return '';
    const plainText = content.replace(/[#*`[\]()]/g, '').trim();
    return plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
  }, []);

  // 验证表单
  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      logMessage('请输入帖子标题', 'warn');
      return false;
    }

    if (!formData.category) {
      logMessage('请选择帖子分类', 'warn');
      return false;
    }

    if (!formData.content.trim() || formData.content.trim() === '# 请输入内容\n\n从这里开始编辑...') {
      logMessage('请输入帖子内容', 'warn');
      return false;
    }

    return true;
  }, [formData, logMessage]);

  // 准备保存数据
  const preparePostData = useCallback((status) => {
    const authorName = user?.profile?.name || '匿名';
    const authorId = buildUserId(authorName, user?.id || 'local');
    const author = {
      id: authorId,
      name: authorName,
      avatar: user?.profile?.avatar || '',
      school: user?.profile?.school || '',
      className: user?.profile?.className || '',
      email: user?.profile?.email || '',
      isAdmin: user?.isAdmin === true,
      tagInfo: user?.tagInfo || null,
    };

    const postData = {
      ...formData,
      tags: tags,
      date: new Date().toISOString().split('T')[0],
      author,
      readTime: calculatePostReadTime(formData.content),
      status: status
    };

    // 如果摘要为空，自动生成
    if (!postData.summary) {
      postData.summary = generateSummary(formData.content);
    }

    // 如果是编辑模式且没有ID，自动生成ID
    if (!postData.id && !isEditMode) {
      postData.id = `post-${Date.now()}`;
    }

    return postData;
  }, [formData, tags, generateSummary, isEditMode, user]);

  // 保存函数（不包含状态管理）
  const savePostData = useCallback(async (postData, status) => {
    try {
      // 本地缓存保存
      upsertLocalPost({ ...postData, status });

      // 根据状态显示不同的通知
      console.log('保存完成，显示通知，状态:', status);
      if (status === 'draft') {
        logMessage('草稿已保存到本地缓存', 'info');
      } else {
        logMessage('帖子已成功发布（本地缓存）', 'info');
      }

      setHasUnsavedChanges(false);

      // 只有发布状态才跳转
      if (status === 'published') {
        console.log('发布成功，准备跳转');
        setTimeout(() => {
          navigate(`/post/${postData.id}`);
        }, 1500);
      }

      return true;
    } catch (error) {
      console.error('保存失败:', error);
      logMessage('保存失败，请检查网络连接', 'error');
      throw error;
    }
  }, [logMessage, navigate]);

  // 保存草稿
  const handleSaveDraft = useCallback(async () => {
    console.log('开始保存草稿');

    if (draftLockRef.current || savingDraft || publishing) {
      return;
    }

    draftLockRef.current = true;

    setSavingDraft(true);

    try {
      const postData = preparePostData('draft');
      console.log('准备保存草稿，数据状态:', postData.status);

      await savePostData(postData, 'draft');
    } catch (error) {
      console.error('保存草稿失败:', error);
    } finally {
      setSavingDraft(false);
      draftLockRef.current = false;
    }
  }, [preparePostData, savePostData, savingDraft, publishing]);

  // 发布帖子
  const handlePublishPost = useCallback(async () => {
    console.log('开始发布帖子');

    if (publishLockRef.current || publishing || savingDraft) {
      return;
    }

    // 验证表单
    if (!validateForm()) {
      return;
    }

    publishLockRef.current = true;

    setPublishing(true);

    let didPublish = false;

    try {
      const postData = preparePostData('published');
      console.log('准备发布，数据状态:', postData.status);

      await savePostData(postData, 'published');
      didPublish = true;
    } catch (error) {
      console.error('发布失败:', error);
    } finally {
      if (!didPublish) {
        setPublishing(false);
        publishLockRef.current = false;
      }
    }
  }, [validateForm, preparePostData, savePostData]);

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
    htmlClass: 'markdown-body markdown-preview',
    markdownClass: 'markdown-editor',
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
          {/* 保存草稿按钮 */}
          <button
            onClick={handleSaveDraft}
            className={`${styles.actionButton} ${styles.saveDraftButton}`}
            disabled={savingDraft || publishing}
          >
            {savingDraft ? '保存中...' : '保存草稿'}
          </button>

          {/* 发布按钮 */}
          <button
            onClick={handlePublishPost}
            className={`${styles.actionButton} ${styles.publishButton}`}
            disabled={publishing || savingDraft}
          >
            {publishing ? '发布中...' : '发布帖子'}
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
              value={formData.category || ''}
              style={{
                borderColor: formData.category ? getCategoryTextColor(formData.category) : '#e0e0e0',
                color: formData.category ? getCategoryTextColor(formData.category) : 'var(--text-sub)',
                backgroundColor: 'white'
              }}
              onChange={(e) => {
                setValue('category', e.target.value, { shouldDirty: true, shouldTouch: true });
              }}
            >
              <option value="" style={{ color: 'var(--text-sub)', backgroundColor: 'white' }}>选择分类</option>
              {categories.map(cat => {
                const categoryColor = getCategoryTextColor(cat.name);
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
            <div className={styles.authorDisplay}>
              {user?.profile?.name || '匿名'}
            </div>
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
            <div className={styles.editorStatsBadge}>
              字数: {getPostWordCount(formData.content)}
            </div>
            <MarkdownEditor
              value={formData.content}
              style={{ height: '500px' }}
              onChange={({ text }) => setValue('content', text)}
              renderHTML={(text) => (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkIns]}
                  rehypePlugins={[rehypeHighlight]}
                >
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
            ⏱️ 预计阅读时间: {calculatePostReadTime(formData.content)}
          </div>
        </div>
      </div>

    </div>
  );
};

export default PostEditor;