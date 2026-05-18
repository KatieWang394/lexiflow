"""
FastAPI 应用入口
================
负责：
1. 创建 app 实例
2. 配置 CORS（前端 localhost 开发地址）
3. 挂载各 router
4. /health 端点
5. 启动时创建数据库表
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.models  # noqa: F401 — 让 Base 知道所有表，create_tables 才能建全
from backend.database import create_tables
from backend.routers import reviews, terms


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动时创建数据库表（如果不存在）"""
    create_tables()
    yield


app = FastAPI(title="LexiFlow API", lifespan=lifespan)

# CORS：允许本地 React 开发服务器访问（D22）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(terms.router)
app.include_router(reviews.router)


@app.get("/health")
def health():
    return {"status": "ok"}
