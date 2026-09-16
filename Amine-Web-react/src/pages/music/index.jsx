import { useEffect } from 'react';

/**
 * 音乐播放器（占位页）。
 * 方案已定为“通用音频 URL / 自传”，等曲目清单接入后再实现播放器 UI。
 */
export default function MusicPage() {
  useEffect(() => {
    document.title = '动漫社基地 | 音乐播放器';
  }, []);

  return (
    <div style={{
      padding: '24px',
      borderRadius: '14px',
      background: 'rgba(255,255,255,0.72)',
    }}>
      <h2 style={{ marginTop: 0 }}>🎧 音乐播放器</h2>
      <p style={{ opacity: 0.75, lineHeight: 1.8 }}>
        播放器建设中～ 这里将展示社团推荐曲目。
      </p>
      <p style={{ opacity: 0.55, fontSize: 13 }}>
        当前为占位页面：待提供歌曲清单（名称 + 音频直链）后开启播放功能。
      </p>
    </div>
  );
}
