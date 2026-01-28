import { useEffect } from 'react'
import './amine.css'
import { initPage, teardownPage } from './amine.js'
import PostList from '../components/PostList'
import { useNavigate,useLocation } from 'react-router-dom'

export default function AminePage() {
  useEffect(() => {
    initPage()
    return () => teardownPage()
  }, [])

  return (
    <div className="amine-root">
      <div className="menu-trigger"><div className="hamburger"><div></div><div></div><div></div></div></div>
      <main className="main-card"><header className="card-header"><div className="logo-area"><h1>番剧 · 资料</h1></div></header>
        <section className="card-content">
          <Content />
        </section>
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
        <h2>📺 季度新番</h2>
        <p>最新番剧资讯、推荐与讨论</p>
      </div>
      <PostList 
        onReadMore={handleReadMore} 
        category="季度新番"
      />
    </>
  )
}