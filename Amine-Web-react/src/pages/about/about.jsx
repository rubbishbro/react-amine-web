/*
  网站的关于界面
  介绍动漫的信息
*/
import { useEffect } from 'react'
import './about.css'
import { initPage, teardownPage } from './about.js'

export default function AboutPage() {
  useEffect(() => {
    initPage()
    return () => teardownPage()
  }, [])

  return (
    <div className="about-root">
      <div className="menu-trigger">
        <div className="hamburger"><div></div><div></div><div></div></div>
      </div>

      <main className="main-card">
        <header className="card-header"><div className="logo-area"><h1>关于 · 动漫社</h1></div></header>
        <section className="card-content">
          <h2>我们的故事</h2>
          <p>这里是社团的简介区域，简单介绍社团成立、活动宗旨与联系方式。</p>
        </section>
      </main>
    </div>
  )
}

export function Content() {
  return (
    <>
      <h2>我们的故事</h2>
      <p>这里是社团的简介区域，简单介绍社团成立、活动宗旨与联系方式。</p>
    </>
  )
}
