import { useEffect, useState } from 'react'
import './amine.css'
import { initPage, teardownPage } from './amine.js'
import PostList from '../components/PostList'
import { useNavigate,useLocation } from 'react-router-dom'
import { apiFetch } from '../../services/apiClient'

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
      <AnimeCalendar />
      <PostList 
        onReadMore={handleReadMore} 
        category="季度新番"
      />
    </>
  )
}

/** 每日放送时间表（数据源：Bangumi 开放 API，经后端缓存） */
function AnimeCalendar() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/anime/calendar')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || '加载失败'); });
    return () => { cancelled = true; };
  }, []);

  const wrapStyle = {
    margin: '16px 0 24px',
    padding: '16px',
    background: 'rgba(255,255,255,0.72)',
    borderRadius: '14px',
  };
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
  };
  const cardStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '6px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.03)',
    textDecoration: 'none',
    color: 'inherit',
  };

  if (error) {
    return (
      <div style={wrapStyle}>
        <strong>新番时间表</strong>
        <p style={{ opacity: 0.7 }}>数据加载失败：{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={wrapStyle}>
        <strong>新番时间表</strong>
        <p style={{ opacity: 0.7 }}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <strong>🗓️ 新番时间表（每日放送）</strong>
      {(data.days || []).map((day) => (
        <div key={day.weekday_id ?? day.weekday_cn} style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>{day.weekday_cn}</div>
          {(day.items || []).length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: '13px' }}>暂无</div>
          ) : (
            <div style={gridStyle}>
              {(day.items || []).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={cardStyle}
                  title={item.name_cn}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name_cn}
                      loading="lazy"
                      style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  )}
                  <span style={{ fontSize: '13px', lineHeight: 1.3 }}>{item.name_cn}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.55 }}>
        数据来源：Bangumi 番组计划
      </div>
    </div>
  );
}