"""
站娘 AI 端点
路由前缀: /ai/mascot
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings
from app.core.limiter import limiter
from app.core import mascot

router = APIRouter()


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)

    model_config = ConfigDict(extra="forbid")


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: Optional[List[Turn]] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


@router.get("/info")
def mascot_info() -> Any:
    """站娘基本信息（无需登录）。"""
    return {
        "name": settings.LLM_MASCOT_NAME,
        "configured": mascot.mascot_configured(),
        "greeting": f"你好呀～我是{settings.LLM_MASCOT_NAME}，想逛哪里都可以问我哦！",
        "capabilities": ["站内功能引导", "社团介绍", "角色扮演闲聊"],
    }


@router.post("/chat")
@limiter.limit("20/minute")
async def mascot_chat(
    request: Request,
    payload: ChatIn,
) -> Any:
    """与站娘对话（返回普通文本回复）。"""
    if not mascot.mascot_configured():
        raise HTTPException(status_code=503, detail="AI 服务未配置（LLM_API_KEY）")
    history = [
        {"role": t.role, "content": t.content}
        for t in (payload.history or [])
    ]
    try:
        reply = await mascot.chat_with_mascot(payload.message, history)
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI 服务暂时不可用") from error
    return {"name": settings.LLM_MASCOT_NAME, "reply": reply}
