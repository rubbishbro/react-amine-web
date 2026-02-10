from fastapi import APIRouter
from app.api.endpoints import auth, users, posts, upload, interact, relations, comments, search

# api接口汇总
api_router = APIRouter()
api_router.include_router(auth.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(posts.router, prefix="/posts", tags=["posts"])
api_router.include_router(interact.router, prefix="/interact", tags=["interact"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(relations.router, prefix="/users", tags=["relations"])
api_router.include_router(comments.router, prefix="/comments", tags=["comments"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
