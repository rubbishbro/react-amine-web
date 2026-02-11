/*
  CommunityBoard组件，包含侧边导航栏和主内容区，实现了不同页面内容的切换
  网站的核心主页功能集中在此组件中
  改为使用router进行页面导航和内容切换
*/

import { useEffect, useState } from 'react'
import './index.css'
import { initCommunityBoard, teardownCommunityBoard, closeSidebar, usePageTitle } from './index.js'
import PostList from '../components/PostList'
import PostDetail from '../components/PostDetail'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { buildUserId } from '../utils/userId'
import { getUnreadNotificationCount } from '../utils/notifications'

//用户面板组件
import UserPanel from '../components/UserPanel'
import Profile from '../profile';
import PublicProfile from '../profile/PublicProfile';
import AdminPanel from '../admin';
import Messages from '../messages';
import Blacklist from '../blacklist';
import Login from '../login';

//帖子编辑器组件
import PostEditor from '../components/PostEditor';

//搜索结果组件
import SearchResults from '../components/SearchResults';

//社团介绍页面
import { Content as AboutContent } from '../about/about.jsx'
//社团活动页面
import { Content as ActivitiesContent } from '../activities/activities.jsx'
//季度新番页面
import { Content as AmineContent } from '../amine/amine.jsx'
//同人/杂谈页面
import { Content as DerivativeWorksContent } from '../derivativeworks/derivativeworks.jsx'
//论坛闲聊页面
import { Content as ForumContent } from '../forum/forum.jsx'
//网络资源页面
import { Content as ResourcesContent } from '../resources/resources.jsx'
//前沿技术页面
import { Content as TechContent } from '../tech/tech.jsx'
//音游区页面
import { Content as MusicGamesContent } from '../musicgames/musicgames.jsx'
//收藏夹页面
import { Content as FavoritesContent } from '../favorites/index.jsx'

export default function CommunityBoard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setTitle } = usePageTitle();
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useUser();
  const viewerId = user?.loggedIn ? buildUserId(user?.profile?.name, user?.id || 'guest') : '';
  const [unreadCount, setUnreadCount] = useState(0);

  const readThread = (key) => {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const readThreadReadAt = (viewer, other) => {
    if (!viewer || !other) return '';
    try {
      return localStorage.getItem(`aw_dm_read_${viewer}_${other}`) || '';
    } catch {
      return '';
    }
  };

  const getUnreadCount = (messages, viewer, other) => {
    if (!messages.length || !viewer || !other) return 0;
    const readAt = readThreadReadAt(viewer, other);
    const readTime = readAt ? new Date(readAt).getTime() : 0;
    return messages.reduce((count, msg) => {
      if (msg.from !== other) return count;
      const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
      return msgTime > readTime ? count + 1 : count;
    }, 0);
  };

  const refreshUnreadCount = () => {
    if (!viewerId) {
      setUnreadCount(0);
      return;
    }
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('aw_dm_')) continue;
      if (!key.includes(viewerId)) continue;
      const list = readThread(key);
      if (!list.length) continue;
      const last = list[list.length - 1];
      const otherId = last.from === viewerId ? last.to : last.from;
      total += getUnreadCount(list, viewerId, otherId);
    }
    total += getUnreadNotificationCount(viewerId);
    setUnreadCount(total);
  };

  // 根据当前路径设置标题
  useEffect(() => {
    const pageTitles = {
      '/': '动漫社基地 | 首页',
      '/about': '动漫社基地 | 社团介绍',
      '/amine': '动漫社基地 | 季度新番',
      '/forum': '动漫社基地 | 论坛闲聊',
      '/activities': '动漫社基地 | 社团活动',
      '/derivativeworks': '动漫社基地 | 同人/杂谈',
      '/tech': '动漫社基地 | 前沿技术',
      '/resources': '动漫社基地 | 网络资源',
      '/musicgames': '动漫社基地 | 音游区',
      '/favorites': '动漫社基地 | 我的收藏夹',
      '/messages': '动漫社基地 | 私信'
      , '/blacklist': '动漫社基地 | 黑名单'
      , '/login': '动漫社基地 | 登录'
      , '/search': '动漫社基地 | 搜索结果'
    };

    if (pageTitles[location.pathname]) {
      setTitle(pageTitles[location.pathname]);
    } else if (location.pathname.startsWith('/post/')) {
      setTitle('动漫社基地 | 帖子详情');
    } else if (location.pathname.startsWith('/messages/')) {
      setTitle('动漫社基地 | 私信');
    } else if (location.pathname.startsWith('/blacklist')) {
      setTitle('动漫社基地 | 黑名单');
    }
  }, [location, setTitle]);

  // 处理初始化
  useEffect(() => {
    initCommunityBoard();
    return () => teardownCommunityBoard();
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const handleUpdate = () => refreshUnreadCount();
    window.addEventListener('aw-messages-updated', handleUpdate);
    window.addEventListener('aw-notifications-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('aw-messages-updated', handleUpdate);
      window.removeEventListener('aw-notifications-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [viewerId, location.key]);

  // 处理阅读全文点击
  const handleReadMore = (postId) => {
    navigate(`/post/${postId}`, {
      state: { from: location.pathname }
    });
    closeSidebar();
  };

  // 处理搜索
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      closeSidebar();
    }
  };

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [location.key]);

  return (
    <div className="community-root">
      <div className="menu-trigger">
        <div className="hamburger">
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>

      {/*主要内容部分*/}
      <Link to="/" className="home-button" onClick={closeSidebar}>
        🏠
      </Link>

      {/*侧边导航栏*/}
      <nav className="sidebar" id="sidebar">
        {/*用户信息*/}
        <UserPanel />
        {/*导航链接*/}
        <Link to="/about" className="nav-item" onClick={closeSidebar}><span>🏫 社团介绍</span></Link>
        <Link to="/amine" className="nav-item" onClick={closeSidebar}><span>📺 季度新番</span></Link>
        <Link to="/forum" className="nav-item" onClick={closeSidebar}><span>💬 论坛闲聊</span></Link>
        <Link to="/activities" className="nav-item" onClick={closeSidebar}><span>🎉 社团活动</span></Link>
        <Link to="/derivativeworks" className="nav-item" onClick={closeSidebar}><span>🎨 同人/杂谈</span></Link>
        <Link to="/tech" className="nav-item" onClick={closeSidebar}><span>💻 前沿技术</span></Link>
        <Link to="/resources" className="nav-item" onClick={closeSidebar}><span>💾 网络资源</span></Link>
        <Link to="/musicgames" className="nav-item" onClick={closeSidebar}><span>🎵 音游区</span></Link>
        <Link to="/favorites" className="nav-item" onClick={closeSidebar}><span>⭐ 收藏夹</span></Link>
        <Link to="/messages" className="nav-item nav-item--with-badge" onClick={closeSidebar}>
          <span>✉️ 消息</span>
          {unreadCount > 0 && (
            <span className="nav-badge" aria-label={`未读消息 ${unreadCount} 条`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </nav>

      {/*主内容区*/}
      <main className="main-card">

        {/*上边栏*/}
        <header className="card-header">
          <div className="logo-area">
            <img className="logo-image" src="/e.jpg" alt="E=mc²动漫社" />
            <h1 className="logo-text">E=mc²动漫社·基地</h1>
          </div>
          <form className="search-bar" onSubmit={handleSearch}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="搜索帖子、用户... (以 # 开头搜索标签)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.trim().startsWith('#') && (
              <span className="tag-mode">标签模式</span>
            )}
          </form>
        </header>

        <section className="card-content" style={{ position: 'relative', minHeight: '200px' }}>
          <Routes>
            {/* 首页 */}
            <Route path="/" element={
              <>
                <div className="welcome-banner">
                  <h2>👋 下午好！今天想看点什么？</h2>
                  <p>欢迎来到LNSY动漫社官网~</p>
                </div>
                <div style={{ marginBottom: 20, fontWeight: 'bold', color: 'var(--text-main)', fontSize: 18 }}>
                  ✨ 最新动态
                </div>
                <PostList onReadMore={handleReadMore} />
              </>
            } />

            {/* 各个子页面 */}
            <Route path="/about" element={<AboutContent />} />
            <Route path="/amine" element={<AmineContent />} />
            <Route path="/activities" element={<ActivitiesContent />} />
            <Route path="/derivativeworks" element={<DerivativeWorksContent />} />
            <Route path="/forum" element={<ForumContent />} />
            <Route path="/resources" element={<ResourcesContent />} />
            <Route path="/tech" element={<TechContent />} />
            <Route path="/musicgames" element={<MusicGamesContent />} />
            <Route path="/favorites" element={<FavoritesContent onReadMore={handleReadMore} />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/user/:id" element={<PublicProfile />} />
            <Route path="/editor" element={<PostEditor />} />
            <Route path="/editor/:id" element={<PostEditor isEditMode={true} />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/blacklist" element={<Blacklist />} />
            <Route path="/search" element={<SearchResults />} />
          </Routes>
        </section>
      </main>
    </div>
  )
}