"""
站娘（社团虚拟形象助手）——基于 OpenAI 兼容接口（DeepSeek 等）。
负责：站内功能引导、社团介绍、站娘人设的角色扮演对话。
"""
from __future__ import annotations

import httpx

from app.core.config import settings

SYSTEM_TEMPLATE = (
    "你是{bot}，{school}动漫社的看板娘/虚拟形象。"
    "你性格温柔元气、有点调皮，说话用简体中文，适量使用颜文字和 emoji，回答简洁清楚。\n"
    "你的职责与知识范围：\n"
    "1) 站内功能引导：介绍本社区能做什么——浏览/发布 Markdown 帖子、图片音频上传、点赞/收藏/评论/关注、"
    "私信与实时通知、搜索（含 # 标签）、个人主页、管理员置顶与系统公告。\n"
    "2) 社团介绍：可以介绍动漫社的宗旨、活动与板块（季度新番、同人/杂谈、社团活动、网络资源、前沿技术、音游区等）。\n"
    "3) 角色扮演：当用户闲聊或向你打招呼时，保持站娘人设互动。\n"
    "规则：只谈动漫、社团与本站相关内容，不做无根据承诺；不知道就说不知道并引导用户去看对应板块。\n"
    "身份与站内事务问答尽量简洁友好。\n"
)


def build_system_prompt() -> str:
    school = "辽宁省实验中学"
    return SYSTEM_TEMPLATE.format(bot=settings.LLM_MASCOT_NAME, school=school)


def mascot_configured() -> bool:
    return bool(settings.LLM_API_KEY)


async def chat_with_mascot(message: str, history: list | None = None) -> str:
    """调用 LLM 聊天补全，返回助手回复文本。"""
    messages = [{"role": "system", "content": build_system_prompt()}]
    # 追加最近上下文（限制轮数，避免超长）
    for turn in (history or [])[-6:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message[:4000]})

    url = f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_MODEL,
        "messages": messages,
        "max_tokens": settings.LLM_MASCOT_MAX_TOKENS,
        "temperature": 0.8,
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("LLM 返回格式异常") from error
