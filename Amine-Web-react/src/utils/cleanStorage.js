/**
 * 清理本地存储工具
 * 用于清理本地混入的已发布帖子
 */

// 清理已发布的本地帖子
export function cleanPublishedLocalPosts() {
  try {
    const raw = localStorage.getItem('aw_local_posts');
    if (!raw) {
      console.log('✅ 本地没有帖子数据');
      return { removed: 0, kept: 0 };
    }

    const posts = JSON.parse(raw);
    if (!Array.isArray(posts)) {
      console.log('✅ 本地帖子数据格式错误');
      return { removed: 0, kept: 0 };
    }

    const draftPosts = posts.filter((item) => {
      const isPublished = item.status === 'published' || item.is_published === true;
      return !isPublished; // 只保留未发布的
    });

    const removedCount = posts.length - draftPosts.length;
    
    if (removedCount > 0) {
      localStorage.setItem('aw_local_posts', JSON.stringify(draftPosts));
      console.log(`✅ 已清理 ${removedCount} 个已发布的本地帖子`);
      console.log(`📝 保留 ${draftPosts.length} 个草稿帖子`);
    } else {
      console.log('✅ 没有需要清理的已发布帖子');
    }

    return { removed: removedCount, kept: draftPosts.length };
  } catch (error) {
    console.error('❌ 清理失败:', error);
    return { removed: 0, kept: 0, error: error.message };
  }
}

// 查看本地帖子状态
export function inspectLocalPosts() {
  try {
    const raw = localStorage.getItem('aw_local_posts');
    if (!raw) {
      console.log('📭 本地没有帖子数据');
      return { total: 0, published: 0, draft: 0 };
    }

    const posts = JSON.parse(raw);
    if (!Array.isArray(posts)) {
      console.log('⚠️ 本地帖子数据格式错误');
      return { total: 0, published: 0, draft: 0 };
    }

    const published = posts.filter(p => p.status === 'published' || p.is_published === true);
    const draft = posts.filter(p => p.status !== 'published' && p.is_published !== true);

    console.log('📊 本地帖子统计:');
    console.log(`  总数: ${posts.length}`);
    console.log(`  已发布: ${published.length}`);
    console.log(`  草稿: ${draft.length}`);

    if (published.length > 0) {
      console.log('\n⚠️ 发现已发布的本地帖子（应该删除）:');
      published.forEach((post, index) => {
        console.log(`  ${index + 1}. [${post.id}] ${post.title || '(无标题)'}`);
      });
    }

    if (draft.length > 0) {
      console.log('\n📝 本地草稿帖子:');
      draft.forEach((post, index) => {
        console.log(`  ${index + 1}. [${post.id}] ${post.title || '(无标题)'}`);
      });
    }

    return { total: posts.length, published: published.length, draft: draft.length };
  } catch (error) {
    console.error('❌ 检查失败:', error);
    return { total: 0, published: 0, draft: 0, error: error.message };
  }
}

// 完全清空本地帖子（包括草稿）
export function clearAllLocalPosts() {
  const confirm = window.confirm('⚠️ 警告：这将删除所有本地帖子（包括草稿）！确定继续？');
  if (!confirm) {
    console.log('❌ 操作已取消');
    return false;
  }

  try {
    localStorage.removeItem('aw_local_posts');
    console.log('✅ 已清空所有本地帖子');
    return true;
  } catch (error) {
    console.error('❌ 清空失败:', error);
    return false;
  }
}

// 清空远程帖子缓存
export function clearRemoteCache() {
  try {
    localStorage.removeItem('aw_posts_cache');
    console.log('✅ 已清空远程帖子缓存');
    console.log('💡 刷新页面将从后端重新获取数据');
    return true;
  } catch (error) {
    console.error('❌ 清空失败:', error);
    return false;
  }
}

// 使用说明
export function help() {
  console.log(`
🛠️  本地存储清理工具使用说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

在浏览器控制台（F12）执行以下命令：

1️⃣  查看本地帖子状态
   inspectLocalPosts()

2️⃣  清理已发布的本地帖子（推荐）
   cleanPublishedLocalPosts()

3️⃣  清空所有本地帖子（包括草稿）
   clearAllLocalPosts()

4️⃣  清空远程帖子缓存
   clearRemoteCache()

5️⃣  重新显示帮助
   help()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 提示：清理后记得刷新页面
  `);
}

// 自动导出到 window 对象，方便控制台使用
if (typeof window !== 'undefined') {
  window.inspectLocalPosts = inspectLocalPosts;
  window.cleanPublishedLocalPosts = cleanPublishedLocalPosts;
  window.clearAllLocalPosts = clearAllLocalPosts;
  window.clearRemoteCache = clearRemoteCache;
  window.storageHelp = help;
}

// 初始化时显示帮助
console.log('🛠️  本地存储清理工具已加载！输入 storageHelp() 查看使用说明');
