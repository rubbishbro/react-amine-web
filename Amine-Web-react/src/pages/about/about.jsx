/*
  网站的关于界面
  介绍动漫的信息
*/
import { useEffect } from 'react'
import './about.css'
import { initPage, teardownPage } from './about.js'

function IntroContent() {
  return (
    <>
      <h2>我们的故事</h2>

      <div className="about-text-block">
        <blockquote>
          <span style={{ color: '#ff8c00', fontWeight: 700 }}>2011 · 一切开始的地方</span>
        </blockquote>

        <p>
          2011 年，《魔法少女小圆》《命运石之门》《未闻花名》《Fate/Zero》《日常》等作品扎堆出现，堪称动画爱好者的“神仙打架之年”。也正是在这一年，辽宁省实验中学的一群同好成立了 <span style={{ color: '#1e66f5', fontSize: 18, fontWeight: 700 }}>E=mc² 动漫社</span>。
        </p>
        <p>
          故事的开头没有废校危机，也没有需要拯救的世界线。只是有人觉得：既然大家都喜欢这些东西，为什么不找个地方一起聊？于是 E 社就这么诞生了。十几年过去，每届社员喜欢的作品都不太一样，但“因为喜欢而聚在一起”这件事一直没变。
        </p>
      </div>

      <div className="about-text-block">
        <blockquote>
          <span style={{ color: '#e0507d', fontWeight: 700 }}>所以，E 社到底是干什么的？</span>
        </blockquote>

        <p>
          这个问题几乎每届招新都会被问。标准答案是：“以泛 ACGN 文化为核心的同好交流社团。”人话版则是：一群爱好多少有点重合的人，聚在一起分享最近让自己上头的东西。
        </p>
        <p>
          动画、漫画、游戏、轻小说、同人创作、音乐、特摄、偶像文化……只要有人愿意聊，就可能在这里找到同好。不需要先背完什么“入社必看番单”，也没有阅番量考试；哪怕你只是最近刚好喜欢上一部作品，也完全可以加入讨论。
        </p>
        <p>
          除了日常聊天，我们也会办观影、问答、小游戏、作品分享和线下主题活动。有些活动从完整的策划案开始，有些则起源于群里一句“今晚有人看吗”。规模不一定大，重点是大家真的能玩到一起；毕竟很多值得记住的故事，本来就始于一次临时起意。
        </p>
      </div>

      <div className="about-text-block">
        <blockquote>
          <span style={{ color: '#20b45a', fontWeight: 700 }}>部门介绍 · 分工协作，也一起玩</span>
        </blockquote>

        <p>
          社长和副社长主要负责统筹活动、安排分工和对外联络，也负责把会议里此起彼伏的“我都可以”变成一个明确方案。宣传组负责海报、视觉和活动信息；组织组负责把大家的脑洞整理成能落地的流程；应援组负责物资和经费记录，让每次活动都能顺利开场。
        </p>
        <p>
          最后是 OTA 部，由全体社员组成，也是 E 社人数最多、最重要的部分。这里没有固定的任务清单，因为社团真正的内容，本来就来自每一个愿意分享、愿意参与的人。
        </p>
        <p>
          你不需要先成为干部，才有资格提出活动、参与创作或给下一届招新出题。部门只是为了让合作更顺畅，不是拿来区分谁更重要。只要进了 E 社，这里就有一部分属于你——至于要怎么参与，可以慢慢找到自己的答案。
        </p>
      </div>

      <p className="about-section-label">一些活动照片：</p>
      <div className="about-placeholder about-placeholder-photos" aria-label="活动照片占位"></div>

      <p className="about-section-label">联系方式：</p>
      <div className="about-placeholder about-placeholder-contact" aria-label="联系方式占位"></div>

      <div className="about-signature">by 25届冻鳗社社长warma</div>
    </>
  )
}

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
          <IntroContent />
        </section>
      </main>
    </div>
  )
}

export function Content() {
  return (
    <>
      <IntroContent />
    </>
  )
}
