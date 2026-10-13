/*
  社团活动发布页
*/

import { useEffect } from 'react'
import './musicgames.css'
import { initPage, teardownPage } from './musicgames.js'
import { useNavigate,useLocation } from 'react-router-dom'
import PostList from '../components/PostList'

/*
  音游区文字模板
  结构、层级与 about.jsx 里的 IntroContent 完全一致，只把 about-* 换成 musicgames-*
  （对应样式见 musicgames.css 末尾）。要改文案只动这里，不用改别的文件。

  对应关系：
    <h2>                        -> 大标题（同 about 的「我们的故事」）
    .musicgames-text-block      -> 一个文字块（小标题 + 若干段落）
    blockquote > span           -> 块内小标题，颜色由行内 style 控制
    .musicgames-section-label   -> 小节标题（活动照片 / 联系方式）
    .musicgames-placeholder     -> 占位方块（斜纹 + 虚线框）
    .musicgames-signature       -> 右下角署名
*/
function IntroContent() {
  return (
    <>
      <h2>音游区的故事</h2>
      <div className="musicgames-text-block">
          <blockquote>
              <span style={{ color: '#005eff', fontWeight: 700 }}>现部长给大家的话</span>
          </blockquote>

          <p>
              Ciallo~☆
              大家好! 我是Zestsauce（2809zzq），现任我们音游同好会的「部长」，也是28届ssy音游群的群主喵，欢迎大家的到来！
              <br></br><br></br>
              音游同好会说不上是一个正式的社团，属于我们的一个民间组织(´∀｀)<br></br><br></br>
              在这里 大家可以随意聊天（!!!合法范围内，补药争吵引战），本群的成分也是十分复杂，包括但不限于：<br></br><br></br>
              最主要的音游方面（phigros arcaea pjsk Maimai 中二节奏 范式起源 节奏大师 Malody 等），FPS游戏，一些沙盒游戏，塔，动漫，信竞等等<br></br><br></br>
              在有的周末或者假期时间群里会举办一些活动（出勤之类的），也可能会组织一些有意思的东西（联合手元？接力写谱？敬请期待！）。<br></br><br></br>在我们的微信群里也会不定期投喂红包，大家不要忘记来抢(￣▽￣)，在接下来一年里学校的几次大型活动期间，我们也大概率会有音游展区，欢迎大家来玩！<br></br><br></br>
              希望大家能玩的开心喵 LNSY音游同好会欢迎你们！
          </p>
      </div>
      <div className="musicgames-text-block">
        <blockquote>
          <span style={{ color: '#ff8c00', fontWeight: 700 }}>先从一块屏幕开始</span>
        </blockquote>

        <p>
          LNSYZX音游同好会挂名于吉他社，是给音游同好们留的一块地方：喜欢打音游的同学在这里分享情报、交流手感，也约着一起玩。
        </p>
        <p>
          这里没有对任何一款音游的水平要求，也不设置其他任何门槛。街机、移动、PC，手柄，玩什么平台都可以；只要愿意聊，就总能找到同好。
        </p>
      </div>

      <div className="musicgames-text-block">
        <blockquote>
          <span style={{ color: '#e0507d', fontWeight: 700 }}>所以，音游区在聊什么？</span>
        </blockquote>

        <p>
          新曲与新活动的情报、谱面手感与难度讨论、设备和外设的调校、推分与成绩记录，都是这里的日常话题。
        </p>
        <p>
          想约人出勤、Link、找同好一起推分、交换打谱心得，或者单纯想安利一首最近上头的曲子（X！ X！ XXX！），也可以直接发帖。
        </p>
        <p>
          比起成绩高低，更希望这里是“愿意分享就有人接话”的地方——毕竟很多值得记住的歌单，往往就是从一句“这首你听了吗”开始的。
        </p>
      </div>

      <div className="musicgames-text-block">
        <blockquote>
          <span style={{ color: '#20b45a', fontWeight: 700 }}>玩法与活动 · 一起打歌，也一起交流</span>
        </blockquote>

        <p>
          日常以线上交流为主：情报帖、安利帖、推分记录和手感讨论，随时都可以发。
        </p>
        <p>
          主要的线下活动是在每届运动会吉他社摊位旁的音游活动摊。一般会组织打歌局、联机对战和曲目分享之类的活动。规模不一定大，重点是大家真的能玩到一起。
        </p>
        <p>
          不需要先成为“大佬”才有资格发言或组织活动。只要你进了音游区，这里就有一部分属于你——至于要怎么参与，可以慢慢找到自己的答案。
        </p>
      </div>

      <p className="musicgames-section-label">一些活动照片：</p>
      <div className="musicgames-placeholder musicgames-placeholder-photos" aria-label="活动照片占位"></div>

      <p className="musicgames-section-label">联系方式：<br></br> 先进入外群（QQ群），在外群内完成简单的审核流程可以进入内群（微信群）</p>
      <div className="musicgames-placeholder musicgames-placeholder-contact" aria-label="联系方式占位">
          <br></br>
          <p>
              &nbsp;
              WeiXin: ***
          </p>
          <br></br>
          <p>
              &nbsp;
              QQ:1093213013
          </p>
      </div>

      <div className="musicgames-signature">by 27届音游区负责人 L1SkyL （a.k.a. 2705 ShenShui）</div>
    </>
  )
}

export default function MusicGamesPage() {
  useEffect(() => {
    initPage()
    return () => teardownPage()
  }, [])

  return (
    <div className="musicgames-root">
      <div className="menu-trigger">
        <div className="hamburger"><div></div><div></div><div></div></div>
      </div>

      <main className="main-card">
        <header className="card-header"><div className="logo-area"><h1>音游 · 动漫社</h1></div></header>
        <section className="card-content">
          <IntroContent />
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
    <div className='musicgames-content'>
      <div className='welcome-banner'>
        <h2>音游爱好者的F8FQ</h2>
        <p>这里可以随意讨论任何音游内容。</p>
      </div>

      <IntroContent />

      <PostList 
        onReadMore={handleReadMore}
        category="音游区"
      />
    </div>
  )
}
