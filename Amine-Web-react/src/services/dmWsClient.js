/**
 * 私信 WebSocket 客户端
 *
 * 使用方式：
 *   import { DmWsClient } from '../../services/dmWsClient';
 *
 *   const client = new DmWsClient(userId, token, {
 *     onMessage: (msg) => { ... },   // 收到新消息
 *     onRecalled: (msg) => { ... },  // 有消息被撤回
 *     onSent: (msg) => { ... },      // 自己发送成功确认
 *     onError: (detail) => { ... },  // 服务器返回错误
 *     onOpen: () => { ... },
 *     onClose: () => { ... },
 *   });
 *   client.connect();
 *   client.send(receiverId, content);
 *   client.recall(messageId);
 *   client.disconnect();
 */

const WS_BASE_URL = (() => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE_URL) {
        return import.meta.env.VITE_WS_BASE_URL.replace(/\/$/, '');
    }
    // 根据当前页面协议自动推断
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
    return `${protocol}://${host}/api/v1`;
})();

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class DmWsClient {
    /**
     * @param {number|string} userId       - 当前登录用户 ID
     * @param {string}        token        - Bearer token（用于 WS 鉴权）
     * @param {object}        handlers     - 事件回调
     * @param {Function} [handlers.onMessage]
     * @param {Function} [handlers.onRecalled]
     * @param {Function} [handlers.onSent]
     * @param {Function} [handlers.onError]
     * @param {Function} [handlers.onOpen]
     * @param {Function} [handlers.onClose]
     */
    constructor(userId, token, handlers = {}) {
        this.userId = userId;
        this.token = token;
        this.handlers = handlers;
        this._ws = null;
        this._reconnectAttempts = 0;
        this._manualClose = false;
        this._pendingQueue = [];   // 连接中暂存待发消息
    }

    get isConnected() {
        return this._ws?.readyState === WebSocket.OPEN;
    }

    connect() {
        if (this._ws && this._ws.readyState === WebSocket.CONNECTING) return;
        this._manualClose = false;
        this._buildSocket();
    }

    _buildSocket() {
        const url = `${WS_BASE_URL}/dm/ws/${this.userId}?token=${encodeURIComponent(this.token)}`;
        try {
            this._ws = new WebSocket(url);
        } catch (e) {
            console.error('[DmWsClient] WebSocket 创建失败:', e);
            return;
        }

        this._ws.onopen = () => {
            this._reconnectAttempts = 0;
            this.handlers.onOpen?.();
            // 发送积压消息
            while (this._pendingQueue.length) {
                const payload = this._pendingQueue.shift();
                this._ws.send(JSON.stringify(payload));
            }
        };

        this._ws.onmessage = (event) => {
            try {
                const frame = JSON.parse(event.data);
                switch (frame.event) {
                    case 'new_message':
                        this.handlers.onMessage?.(frame.data);
                        break;
                    case 'sent':
                        this.handlers.onSent?.(frame.data);
                        break;
                    case 'message_recalled':
                        this.handlers.onRecalled?.(frame.data);
                        break;
                    case 'pong':
                        // heartbeat ok
                        break;
                    case 'error':
                        this.handlers.onError?.(frame.detail);
                        break;
                    default:
                        break;
                }
            } catch (e) {
                console.warn('[DmWsClient] 解析消息失败:', e);
            }
        };

        this._ws.onerror = (e) => {
            console.error('[DmWsClient] WebSocket 错误:', e);
        };

        this._ws.onclose = () => {
            this.handlers.onClose?.();
            if (!this._manualClose && this._reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                this._reconnectAttempts += 1;
                console.info(`[DmWsClient] 断开，${RECONNECT_DELAY_MS}ms 后第 ${this._reconnectAttempts} 次重连...`);
                setTimeout(() => this._buildSocket(), RECONNECT_DELAY_MS);
            }
        };
    }

    /**
     * 发送一条私信
     * @param {number} receiverId
     * @param {string} content
     */
    send(receiverId, content) {
        const payload = { event: 'send', receiver_id: receiverId, content };
        if (this.isConnected) {
            this._ws.send(JSON.stringify(payload));
        } else {
            // 暂存，待连接成功后发送
            this._pendingQueue.push(payload);
        }
    }

    /**
     * 撤回一条消息
     * @param {number} messageId
     */
    recall(messageId) {
        const payload = { event: 'recall', message_id: messageId };
        if (this.isConnected) {
            this._ws.send(JSON.stringify(payload));
        } else {
            this._pendingQueue.push(payload);
        }
    }

    ping() {
        if (this.isConnected) {
            this._ws.send(JSON.stringify({ event: 'ping' }));
        }
    }

    disconnect() {
        this._manualClose = true;
        this._pendingQueue = [];
        this._ws?.close();
        this._ws = null;
    }
}
