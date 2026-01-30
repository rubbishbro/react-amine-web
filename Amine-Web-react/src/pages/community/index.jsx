/*
  CommunityBoard组件，包含侧边导航栏和主内容区，实现了不同页面内容的切换
  网站的核心主页功能集中在此组件中
  改为使用router进行页面导航和内容切换
*/

import { useEffect } from 'react'
import './index.css'
import { initCommunityBoard, teardownCommunityBoard, closeSidebar, usePageTitle } from './index.js'
import PostList from '../components/PostList'
import PostDetail from '../components/PostDetail'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'

//用户面板组件
import UserPanel from '../components/UserPanel'
import Profile from '../profile';

//帖子编辑器组件
import PostEditor from '../components/PostEditor';

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

export default function CommunityBoard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setTitle } = usePageTitle();

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
      '/musicgames': '动漫社基地 | 音游区'
    };

    if (pageTitles[location.pathname]) {
      setTitle(pageTitles[location.pathname]);
    } else if (location.pathname.startsWith('/post/')) {
      setTitle('动漫社基地 | 帖子详情');
    }
  }, [location, setTitle]);

  // 处理初始化
  useEffect(() => {
    initCommunityBoard();
    return () => teardownCommunityBoard();
  }, []);

  // 处理阅读全文点击
  const handleReadMore = (postId) => {
    navigate(`/post/${postId}`, {
      state: { from: location.pathname }
    });
    closeSidebar();
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
      </nav>

      {/*主内容区*/}
      <main className="main-card">

        {/*上边栏*/}
        <header className="card-header">
          <div className="logo-area">
            <h1>动漫社 · 基地</h1>
          </div>
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder="搜索帖子、番剧..." />
          </div>
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
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/editor" element={<PostEditor />} />
            <Route path="/editor/:id" element={<PostEditor isEditMode={true} />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </section>
      </main>
    </div>
  )
}