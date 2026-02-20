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
          <span style={{ color: '#ff8c00', fontWeight: 700 }}>奇迹之年 · 少女们的选择</span>
        </blockquote>

        <p>
          在2011年这个诞生过《魔法少女小圆》《命运石之门》《未闻花名》《偶像大师》《Fate/Zero》《日常》等诸多神作的梦幻之年，位于日本东京都千代田区的传统高校音乃木阪学院——不远的中国辽宁省沈阳市皇姑区的传统高校lnssyzx（<del>后期吐槽：到底不远在哪</del>），因为入读的学生人数骤减，所以正面临着废校的危机。
        </p>
        <p>
          其中九位少女为了保护她们喜爱的学校而决定成为cosplayer，因为只要她们成为cosplayer，学校的名气便会増加，而入读学生的人数也会随之上升。就这样，<span style={{ color: '#1e66f5', fontSize: 18, fontWeight: 700 }}>E=mc²动漫社</span>便在9位少女的拥簇下成立了！
        </p>
      </div>

      <div className="about-text-block">
        <blockquote>
          <span style={{ color: '#e0507d', fontWeight: 700 }}>正式介绍 · 请多关照</span>
        </blockquote>

        <p>
          咳咳，呼，终于把笔从社长手里抢过来了，啊不要走不要走！我们真的不是什么奇怪的社团qwq，刚才只是社长在发癫而已（<del>后期吐槽：什么叫只是在发癫而已，还有为什么不直接把上面发癫的内容删掉啊喂！</del>），现在就由我来正式介绍一下吧我们的社团吧~
        </p>
        <p>
          我们社团成立于2011年，在整个省实验的社团资历里也算是比较前面的了（甚至之前被评为过校五星级社团），还成功的度过了疫情三年的大规模废社并社时期并存活至今（<del>后期吐槽：其实只是疫情期间仍然不影响甚至反倒助长了水群活动提高了社团的活跃度才没暴死，怎么说的这么光彩</del>）！总之，我们的社团真的有在蒸蒸日上哦~
        </p>
        <p>
          嗯，所以说我们社团究竟是干什么的呢？哎遥想我当年当社长的时候第一次开会被问的最多的问题也是这个，记得当时貌似回答的是“基于动漫爱好的大型同好会”，现在想来这个回答其实已经有些过时了，目前的现状更趋向于是“以泛ACGN文化为核心所涉及的所有亚文化的爱好者的一个交流平台”。简单来说，无论你是一个最纯粹的动漫爱好者，还是同人创作大佬，又或者是漫画大手子、旮旯给木高手、轻小说宅、喜欢cosplay的美少女JK（有的话记得加下我微信谢谢）、管人吃、术力口＆JPOP粉丝、特摄厨、二游肝帝、鬼畜/MAD大佬、小偶像、nsyc、偶像宅、谷子妹、甩手区、光棒猴、学cs的xnn等等等等（<del>后期吐槽：说了这么多实际上都是同一批人...</del>），相信你来到这里都能找到同好。我们一直致力于为社团的大家提供一个和谐而自由的交流平台，为此除了日常的水群以外，周末或者节假日偶尔也会举办一些小型线上活动，如二次元相关的小游戏或者线上观影会等，线下的大型活动我们仍旧也会为大家带来各种各样的惊喜，希望大家玩的开心！
        </p>
      </div>

      <div className="about-text-block">
        <blockquote>
          <span style={{ color: '#0fe42b', fontWeight: 700 }}>部门介绍 · 分工协作</span>
        </blockquote>

        <p>接下来介绍一下我们社团的各个部门吧。</p>
        <p>
          首先是社长，负责统筹规划各个活动的策划案，安排每个活动的分工，参与团委组织的社团会议并记录要点告知其他干部，管理好社团的氛围，承担各项活动的核心工作，最后的最后，如果社长是男的那么在任期间必须至少女装一次，嗯。（<del>何意味</del>）
        </p>
        <p>
          接着是副社长，负责承担各项活动中较为重要（可能也是最繁杂）的部分，因此由于工作量较大副社长由2-3人共同担任，其次便是协助社长管理好社团的氛围，并且处理和其他社团的关系（如合作联动等事务），另外副社长由男生担任的也要女装。（<del>这规则到底是谁定的啊！</del>）
        </p>
        <p>
          接下来的职位一起介绍吧，下面的职位一般都是由2-3人共同担任：宣传部长负责活动海报等宣传相关物件的制作与宣发工作；组织部长负责活动的实践组织和维护活动秩序；应援部长负责财务的整理与物资的供给。
        </p>
        <p>
          最后一个是ota部，也是动漫社最大也最重要的部门，由动漫社所有社员构成，每个人都有权利去参与到下一届动漫社招新题的出题之中，也共同维护着动漫社的和谐氛围~
        </p>
        <p>
          说了这么多，值得强调的一点是各个部门没有绝对的上下级关系，每个人都是平等的去维护支持这个社团的运作，即便你可能没能够加入到社团的干部之中，只要进入了e社就可以在ota部中为这个社团出一份力~
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
