import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../services/apiClient';

/**
 * 站娘挂件：Live2D 开源样例占位（Cubism4，CDN 加载）+ AI 对话。
 * 若 Live2D 资源加载失败，自动降级为静态站娘占位，不影响对话功能。
 */
const CDN = {
  core: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
  live2d: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
  // 开源示例模型（pixi-live2d-display 测试资源）
  model: 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json',
};

const scriptPromises = {};
function loadScriptOnce(src) {
  if (scriptPromises[src]) return scriptPromises[src];
  scriptPromises[src] = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(el);
  });
  return scriptPromises[src];
}

export default function Mascot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好呀～我是站娘小安，有什么想问的吗？' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [live2d, setLive2d] = useState('idle'); // idle | loading | ready | fallback
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const listRef = useRef(null);

  // 打开面板时加载 Live2D（失败则降级）
  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    setLive2d('loading');
    (async () => {
      try {
        await loadScriptOnce(CDN.core);
        await loadScriptOnce(CDN.pixi);
        await loadScriptOnce(CDN.live2d);
        if (disposed || !canvasRef.current) return;
        const PIXI = window.PIXI;
        const Live2DModel = PIXI?.live2d?.Live2DModel;
        if (!PIXI || !Live2DModel) throw new Error('Live2D 运行时未就绪');
        const app = new PIXI.Application({
          view: canvasRef.current,
          transparent: true,
          autoStart: true,
          width: 200,
          height: 240,
        });
        appRef.current = app;
        const model = await Live2DModel.from(CDN.model, { autoInteract: false });
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        app.stage.addChild(model);
        const scale = Math.min(200 / model.width, 240 / model.height);
        model.scale.set(scale);
        model.x = (200 - model.width * scale) / 2;
        model.y = 240 - model.height * scale;
        setLive2d('ready');
      } catch (error) {
        console.warn('[mascot] Live2D 加载失败，使用占位形象:', error);
        if (!disposed) setLive2d('fallback');
      }
    })();
    return () => {
      disposed = true;
      try {
        appRef.current?.destroy(true, { children: true });
      } catch {
        // ignore
      }
      appRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const res = await apiFetch('/ai/mascot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      if (res.status === 503) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'AI 还没配置好哦，请先让管理员填写 LLM_API_KEY～' }]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '（没有回复）' }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `出错了：${error.message}` }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60 }}>
      {open && (
        <div style={{
          width: 300, marginBottom: 10, borderRadius: 16, overflow: 'hidden',
          background: 'rgba(255,255,255,0.96)', boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', maxHeight: 460,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ff85a1', color: '#fff' }}>
            <strong>站娘 · 小安</strong>
            <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }} aria-label="关闭">×</button>
          </div>
          <div style={{ height: 240, background: 'linear-gradient(180deg,#ffeaf1,#fff)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {live2d === 'fallback' ? (
              <div style={{ fontSize: 72, paddingBottom: 20 }} title="Live2D 占位">🎀</div>
            ) : (
              <canvas ref={canvasRef} width={200} height={240} />
            )}
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                margin: '6px 0', display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <span style={{
                  maxWidth: '80%', padding: '6px 10px', borderRadius: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? '#ffd166' : 'rgba(0,0,0,0.06)',
                }}>{m.content}</span>
              </div>
            ))}
            {sending && <div style={{ opacity: 0.6 }}>小安正在输入...</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="和小安聊聊～"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid #e5e5e5', outline: 'none' }}
            />
            <button type="button" onClick={handleSend} disabled={sending}
              style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#ff85a1', color: '#fff', cursor: 'pointer' }}>
              发送
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#ff85a1', color: '#fff', fontSize: 24, boxShadow: '0 8px 24px rgba(255,133,161,0.5)',
        }}
        title="和站娘聊天"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  );
}
