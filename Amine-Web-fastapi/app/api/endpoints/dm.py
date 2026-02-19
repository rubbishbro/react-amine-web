"""
私信 API 端点（REST + WebSocket）
路由前缀: /dm
"""
from typing import Any, Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlmodel import Session
from pydantic import BaseModel

from app.api import deps
from app.crud import crud_dm
from app.models.direct_message import DirectMessage
from app.models.user import User

router = APIRouter()


# ── WebSocket 连接管理器 ───────────────────────────────────────────────────────

class ConnectionManager:
    """
    维护 {user_id: [WebSocket, ...]} 映射，支持同一用户多端在线。
    """
    def __init__(self):
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        sockets = self._connections.get(user_id, [])
        if ws in sockets:
            sockets.remove(ws)
        if not sockets:
            self._connections.pop(user_id, None)

    async def send_to(self, user_id: int, payload: dict):
        """向指定用户所有在线连接推送消息。"""
        import json
        data = json.dumps(payload, ensure_ascii=False, default=str)
        dead: List[WebSocket] = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))


manager = ConnectionManager()


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: Optional[int]
    sender_id: int
    receiver_id: int
    content: str
    is_read: bool
    recalled: bool
    created_at: Any

    class Config:
        from_attributes = True


class SendMessageIn(BaseModel):
    receiver_id: int
    content: str


class ThreadSummary(BaseModel):
    other_id: int
    last_message: MessageOut
    unread_count: int


# ── REST 端点 ─────────────────────────────────────────────────────────────────

@router.get("/threads", response_model=List[Dict])
def list_threads(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取当前用户所有会话列表（每个会话取最新一条消息）。
    返回 [{other_id, last_message{...}, unread_count}]
    """
    threads = crud_dm.get_threads_list(db, user_id=current_user.id)
    result = []
    for t in threads:
        msg = t["last_message"]
        result.append({
            "other_id": t["other_id"],
            "other_name": t.get("other_name", str(t["other_id"])),
            "unread_count": t["unread_count"],
            "last_message": {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "content": msg.content if not msg.recalled else "该消息已撤回",
                "is_read": msg.is_read,
                "recalled": msg.recalled,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            },
        })
    return result


@router.get("/thread/{other_id}", response_model=List[Dict])
def get_thread(
    other_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """获取与某用户的完整聊天记录，并自动标记对方发来的消息为已读。"""
    msgs = crud_dm.get_thread(
        db, user_a=current_user.id, user_b=other_id, skip=skip, limit=limit
    )
    # 标记已读
    crud_dm.mark_thread_read(db, reader_id=current_user.id, sender_id=other_id)
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "content": m.content if not m.recalled else "该消息已撤回",
            "is_read": m.is_read,
            "recalled": m.recalled,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


@router.post("/send", response_model=Dict)
async def send_message(
    payload: SendMessageIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    REST 方式发送私信（与 WebSocket 互补；前端可根据情况选择）。
    发送后实时推送给在线的接收方。
    """
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    if payload.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能给自己发私信")

    msg = crud_dm.send(
        db,
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=payload.content,
    )
    msg_dict = {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "recalled": msg.recalled,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
    # 推送给在线的接收方
    await manager.send_to(payload.receiver_id, {"event": "new_message", "data": msg_dict})
    return msg_dict


@router.post("/{message_id}/recall", response_model=Dict)
async def recall_message(
    message_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """撤回自己发出的一条消息。"""
    msg = crud_dm.recall(db, message_id=message_id, sender_id=current_user.id)
    if not msg:
        raise HTTPException(status_code=404, detail="消息不存在或无权撤回")
    msg_dict = {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "content": "该消息已撤回",
        "recalled": True,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "event": "recalled",
    }
    # 通知对方
    await manager.send_to(msg.receiver_id, {"event": "message_recalled", "data": msg_dict})
    return msg_dict


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """删除一条消息（双方视角同步删除）。"""
    ok = crud_dm.delete_for_me(db, message_id=message_id, user_id=current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="消息不存在或无权删除")
    return {"deleted": True, "message_id": message_id}


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """获取当前用户未读私信总数（用于全局 badge）。"""
    count = crud_dm.get_total_unread(db, user_id=current_user.id)
    return {"unread_count": count}


# ── WebSocket 端点 ────────────────────────────────────────────────────────────

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    token: str = Query(...),
    db: Session = Depends(deps.get_db),
):
    """
    WebSocket 私信通道。
    连接地址: ws://<host>/api/v1/dm/ws/{user_id}?token=<bearer_token>

    客户端发送格式（JSON）:
        { "event": "send", "receiver_id": 123, "content": "你好" }
        { "event": "recall", "message_id": 99 }
        { "event": "ping" }

    服务器推送格式（JSON）:
        { "event": "new_message",      "data": { MessageOut } }
        { "event": "message_recalled", "data": { MessageOut } }
        { "event": "pong" }
        { "event": "error",            "detail": "..." }
    """
    import json
    # Token 鉴权
    try:
        from jose import jwt, JWTError
        from app.core.config import settings
        from app.schemas.token import TokenPayload
        payload_data = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload_data)
        auth_user = db.get(User, int(token_data.sub))
        if not auth_user or not auth_user.is_active or auth_user.id != user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"event": "error", "detail": "无效 JSON"}))
                continue

            event = data.get("event")

            if event == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

            elif event == "send":
                receiver_id = data.get("receiver_id")
                content = (data.get("content") or "").strip()
                if not receiver_id or not content:
                    await websocket.send_text(json.dumps({"event": "error", "detail": "receiver_id 和 content 必填"}))
                    continue
                if receiver_id == user_id:
                    await websocket.send_text(json.dumps({"event": "error", "detail": "不能给自己发私信"}))
                    continue
                msg = crud_dm.send(db, sender_id=user_id, receiver_id=receiver_id, content=content)
                msg_dict = {
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "receiver_id": msg.receiver_id,
                    "content": msg.content,
                    "is_read": msg.is_read,
                    "recalled": msg.recalled,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                }
                # 回传给自己（发送确认）
                await websocket.send_text(json.dumps({"event": "sent", "data": msg_dict}, default=str))
                # 推送给接收方
                await manager.send_to(receiver_id, {"event": "new_message", "data": msg_dict})

            elif event == "recall":
                message_id = data.get("message_id")
                if not message_id:
                    await websocket.send_text(json.dumps({"event": "error", "detail": "message_id 必填"}))
                    continue
                msg = crud_dm.recall(db, message_id=message_id, sender_id=user_id)
                if not msg:
                    await websocket.send_text(json.dumps({"event": "error", "detail": "消息不存在或无权撤回"}))
                    continue
                msg_dict = {
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "receiver_id": msg.receiver_id,
                    "content": "该消息已撤回",
                    "recalled": True,
                    "is_read": msg.is_read,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                }
                await websocket.send_text(json.dumps({"event": "message_recalled", "data": msg_dict}))
                await manager.send_to(msg.receiver_id, {"event": "message_recalled", "data": msg_dict})

            else:
                await websocket.send_text(json.dumps({"event": "error", "detail": f"未知事件: {event}"}))

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
