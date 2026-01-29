import { useEffect } from 'react'
import './tech.css'
import { initPage, teardownPage } from './tech.js'
import { useNavigate,useLocation } from 'react-router-dom'
import PostList from '../components/PostList'

export default function TechPage() {
  useEffect(() => { initPage(); return () => teardownPage() }, [])
  return (
    <div className="tech-root">
      <div className="menu-trigger"><div className="hamburger"><div></div><div></div><div></div></div></div>
      <nav className="sidebar" id="sidebar">
        <div style={{ padding: '0 30px 30px', textAlign: 'center' }}>
          <h3>技术</h3>
          <p style={{ fontSize: 12, color: '#888' }}>前沿工具与教程</p>
        </div>
        <a href="#" className="nav-item">教程</a>
        <a href="#" className="nav-item">工具链</a>
      </nav>
      <main className="main-card"><header className="card-header"><div className="logo-area"><h1>技术 · 文章</h1></div></header>
        <section className="card-content"><p>分享开发、部署与自动化相关的技巧与资源。</p></section>
      </main>
    </div>
  )
}

export function Content() {
  const navigate = useNavigate();

  const location = useLocation();

  const handleReadMore = (postId) => {
    navigate(`/post/${postId}`, {state : { from: location.pathname } });
  };  
  
  return (
    <>
      <div className="welcome-banner">
        <h2>技术 · 文章</h2>
        <p>分享开发、部署与自动化相关的技巧与资源。</p>
      </div>
      <PostList 
        onReadMore={handleReadMore} 
        category="前沿技术"
      />
    </>
  )
}
