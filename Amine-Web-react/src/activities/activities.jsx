/*
  社团活动发布页
*/

import { useEffect } from 'react'
import './activities.css'
import { initPage, teardownPage } from './activities.js'
import { useNavigate,useLocation } from 'react-router-dom'
import PostList from '../components/PostList'

export default function ActivitiesPage() {
  useEffect(() => {
    initPage()
    return () => teardownPage()
  }, [])

  return (
    <div className="activities-root">
      <div className="menu-trigger">
        <div className="hamburger"><div></div><div></div><div></div></div>
      </div>

      <main className="main-card">
        <header className="card-header"><div className="logo-area"><h1>活动 · 动漫社</h1></div></header>
        <section className="card-content">
          <h2>即将到来的活动</h2>
          <p>本页展示活动时间、地点与报名方式，方便成员快速参与。</p>
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
        <h2>即将到来的活动</h2>
        <p>本页展示活动时间、地点与报名方式，方便成员快速参与。</p>
      </div>
        <PostList 
          onReadMore={handleReadMore} 
          category="社团活动"
        />
    </>
  )
}
