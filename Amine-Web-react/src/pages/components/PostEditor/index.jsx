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
import { getAllCategories, loadPostContent, publishLocalDraft, saveLocalDraft } from '../../utils/postLoader';
import { getCategoryTextColor } from '../../config';
import { useUser } from '../../context/userContext.js';
import { buildUserId } from '../../utils/userId';
import { calculatePostReadTime, getPostWordCount } from '../../utils/postReadTime';

const buildDefaultValues = (initialData = null) => initialData || {
  title: '',
  category: '',
  summary: '',
  content: '',
  status: 'draft',
};

const PostEditor = ({ isEditMode = false, initialData = null }) => {
  const navigate = useNavigate();
  const { id: postId } = useParams();
  const { user } = useUser();
  const authToken = user?.loggedIn ? 'cookie-session' : '';
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const publishLockRef = useRef(false);
  const draftLockRef = useRef(false);

  const {
    register,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    defaultValues: buildDefaultValues(initialData),
  });

  const formData = watch();

  const logMessage = useCallback((message, level = 'warn') => {
    if (level === 'error') {
      console.error(message);
      return;
    }
    if (level === 'info') {
      console.info(message);
      return;
    }
    console.warn(message);
  }, []);

  const showFeedback = useCallback((type, message) => {
    setFeedback({ type, message });
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoryList = await getAllCategories();
        setCategories(categoryList);
      } catch (error) {
        console.error('加载分类失败:', error);
        logMessage('加载分类失败', 'error');
        showFeedback('error', '分类加载失败，请刷新后重试');
      }
    };

    loadCategories();
  }, [logMessage, showFeedback]);

  useEffect(() => {
    if (!isEditMode || !postId) return;

    const loadPost = async () => {
      setLoading(true);
      try {
        const postData = await loadPostContent(postId);
        if (!postData) {
          showFeedback('error', '未找到可编辑的帖子或草稿');
          return;
        }

        reset({
          title: postData.title || '',
          category: postData.category || '',
          summary: postData.summary || '',
          content: postData.content || '',
          status: postData.status || 'draft',
          id: postData.id,
          tags: postData.tags || [],
        });
        setTags(Array.isArray(postData.tags) ? postData.tags : []);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('加载帖子失败:', error);
        logMessage('加载帖子失败', 'error');
        showFeedback('error', '加载帖子失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [isEditMode, postId, reset, logMessage, showFeedback]);

  useEffect(() => {
    const subscription = watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const handleAddTag = useCallback((event) => {
    if (event.key !== 'Enter' || !currentTag.trim()) return;
    event.preventDefault();

    const nextTag = currentTag.trim();
    if (!tags.includes(nextTag)) {
      setTags((prev) => [...prev, nextTag]);
    }
    setCurrentTag('');
  }, [currentTag, tags]);

  const handleRemoveTag = useCallback((tagToRemove) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  }, []);

  const generateSummary = useCallback((content) => {
    if (!content) return '';
    const plainText = content.replace(/[#*`[\]()]/g, '').trim();
    return plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      showFeedback('error', '请输入帖子标题');
      return false;
    }

    if (!formData.category) {
      showFeedback('error', '请选择帖子分类');
      return false;
    }

    if (!formData.content.trim()) {
      showFeedback('error', '请输入帖子内容');
      return false;
    }

    return true;
  }, [formData.title, formData.category, formData.content, showFeedback]);

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

    const nextPost = {
      ...formData,
      id: formData.id || (!isEditMode ? `post-${Date.now()}` : formData.id),
      tags,
      date: new Date().toISOString().split('T')[0],
      author,
      draftOwnerId: authorId,
      readTime: calculatePostReadTime(formData.content),
      status,
    };

    if (!nextPost.summary) {
      nextPost.summary = generateSummary(formData.content);
    }

    return nextPost;
  }, [formData, tags, generateSummary, isEditMode, user]);

  const savePostData = useCallback(async (postData, status) => {
    try {
      if (status === 'draft') {
        saveLocalDraft(postData);
        setHasUnsavedChanges(false);
        showFeedback('success', '草稿已保存到本地，仅当前账号可见');
        return true;
      }

      const created = await publishLocalDraft(postData, authToken);
      setHasUnsavedChanges(false);
      showFeedback('success', '帖子已成功发布');

      setTimeout(() => {
        navigate(`/post/${created.id}`);
      }, 200);

      return true;
    } catch (error) {
      console.error('保存失败:', error);
      const message = error?.message || '发布失败，请稍后重试';
      showFeedback('error', message);
      logMessage(message, 'error');
      throw error;
    }
  }, [authToken, logMessage, navigate, showFeedback]);

  const handleSaveDraft = useCallback(async () => {
    if (draftLockRef.current || savingDraft || publishing) return;

    draftLockRef.current = true;
    setSavingDraft(true);
    setFeedback(null);

    try {
      const postData = preparePostData('draft');
      await savePostData(postData, 'draft');
    } catch (error) {
      console.error('保存草稿失败:', error);
    } finally {
      setSavingDraft(false);
      draftLockRef.current = false;
    }
  }, [preparePostData, publishing, savePostData, savingDraft]);

  const handlePublishPost = useCallback(async () => {
    if (publishLockRef.current || publishing || savingDraft) return;
    if (!validateForm()) return;

    publishLockRef.current = true;
    setPublishing(true);
    setFeedback(null);

    let didPublish = false;

    try {
      const postData = preparePostData('published');
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
  }, [preparePostData, publishing, savePostData, savingDraft, validateForm]);

  const handleCancel = useCallback(() => {
    if (!hasUnsavedChanges) {
      navigate(-1);
      return;
    }

    if (window.confirm('您有未保存的更改，确定要离开吗？')) {
      navigate(-1);
    }
  }, [hasUnsavedChanges, navigate]);

  const mdEditorConfig = {
    view: {
      menu: true,
      md: true,
      html: true,
    },
    canView: {
      menu: true,
      md: true,
      html: true,
      fullScreen: true,
      hideMenu: true,
    },
    htmlClass: 'markdown-body markdown-preview',
    markdownClass: 'markdown-editor',
    syncScrollMode: ['leftFollowRight', 'rightFollowLeft'],
    imageAccept: '.jpg,.jpeg,.png,.gif,.webp',
    linkAccept: '.*',
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
      <div className={styles.editorHeader}>
        <button onClick={handleCancel} className={styles.backButton}>
          返回
        </button>

        <div className={styles.headerTitle}>
          <h2>{isEditMode ? '编辑帖子' : '新建帖子'}</h2>
          {hasUnsavedChanges && (
            <span className={styles.unsavedIndicator}>未保存</span>
          )}
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={handleSaveDraft}
            className={`${styles.actionButton} ${styles.saveDraftButton}`}
            disabled={savingDraft || publishing}
          >
            {savingDraft ? '保存中...' : '保存草稿'}
          </button>

          <button
            onClick={handlePublishPost}
            className={`${styles.actionButton} ${styles.publishButton}`}
            disabled={publishing || savingDraft}
          >
            {publishing ? '发布中...' : '发布帖子'}
          </button>
        </div>
      </div>

      {feedback?.message && (
        <div
          className={`${styles.feedbackBanner} ${feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <div className={styles.editorContent}>
        <div className={styles.formGroup}>
          <input
            type="text"
            placeholder="输入帖子标题..."
            className={`${styles.titleInput} ${errors.title ? styles.error : ''}`}
            {...register('title', {
              required: '标题不能为空',
              minLength: { value: 2, message: '标题至少 2 个字' },
              maxLength: { value: 100, message: '标题最多 100 个字' },
            })}
          />
          {errors.title && (
            <span className={styles.errorMessage}>{errors.title.message}</span>
          )}
          <div className={styles.charCount}>{formData.title.length}/100</div>
        </div>

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
                backgroundColor: 'white',
              }}
              onChange={(event) => {
                setValue('category', event.target.value, { shouldDirty: true, shouldTouch: true });
              }}
            >
              <option value="" style={{ color: 'var(--text-sub)', backgroundColor: 'white' }}>
                选择分类
              </option>
              {categories.map((cat) => {
                const categoryColor = getCategoryTextColor(cat.name);
                return (
                  <option
                    key={cat.id}
                    value={cat.name}
                    style={{
                      color: categoryColor,
                      backgroundColor: 'white',
                      fontWeight: '600',
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
            <div className={styles.authorDisplay}>{user?.profile?.name || '匿名'}</div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>发布日期</label>
            <div className={styles.dateDisplay}>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </div>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>标签</label>
          <div className={styles.tagInputContainer}>
            <input
              type="text"
              placeholder="输入标签后按回车添加"
              value={currentTag}
              onChange={(event) => setCurrentTag(event.target.value)}
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
                const tagStyle = tagColors[index % tagColors.length];

                return (
                  <span
                    key={tag}
                    className={styles.tag}
                    style={{
                      backgroundColor: tagStyle.bg,
                      color: tagStyle.color,
                      borderColor: tagStyle.border,
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

        <div className={styles.formGroup}>
          <label className={styles.label}>
            摘要
            <span className={styles.optional}>(可选，不填将自动生成)</span>
          </label>
          <textarea
            placeholder="输入帖子摘要，建议不超过 200 字..."
            className={`${styles.summaryInput} ${errors.summary ? styles.error : ''}`}
            {...register('summary', {
              maxLength: { value: 300, message: '摘要最多 300 个字' },
            })}
            rows="3"
          />
          {errors.summary && (
            <span className={styles.errorMessage}>{errors.summary.message}</span>
          )}
          <div className={styles.charCount}>{formData.summary?.length || 0}/300</div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>内容 *</label>
          <div className={styles.markdownContainer}>
            <div className={styles.editorStatsBadge}>字数: {getPostWordCount(formData.content)}</div>
            <MarkdownEditor
              value={formData.content}
              style={{ height: '500px' }}
              onChange={({ text }) => setValue('content', text, { shouldDirty: true, shouldTouch: true })}
              renderHTML={(text) => (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkIns]} rehypePlugins={[rehypeHighlight]}>
                  {text}
                </ReactMarkdown>
              )}
              config={mdEditorConfig}
              placeholder="# 请输入内容..."
            />
          </div>
          {errors.content && (
            <span className={styles.errorMessage}>{errors.content.message}</span>
          )}
        </div>

        <div className={styles.previewInfo}>
          <div className={styles.readTimePreview}>
            预计阅读时间: {calculatePostReadTime(formData.content)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
