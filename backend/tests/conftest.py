"""
测试配置（pytest fixtures）
============================
提供两样东西：
1. 独立的内存数据库（每个测试函数都有干净的空库）
2. TestClient 实例（通过 FastAPI 的依赖注入覆盖连接到测试库）

关键设计决策（D21）：
- 用 StaticPool 确保所有查询共用同一个 SQLite 内存连接
  （否则内存 DB 在不同连接间不共享，表看起来不存在）
- 每个测试用 create_all / drop_all 包围，保证完全隔离
- 通过 app.dependency_overrides[get_db] 替换真实 DB 连接，测试库永远不接触 vocab.db
- TESTING=1 让 main.py 的 lifespan 跳过 create_tables()，避免创建真实 vocab.db（D21）
"""

import os

# 必须在 backend.main 被 import 之前设置，lifespan 检查此变量决定是否建表。
# pytest 加载 conftest.py 时这行立即执行，早于任何 fixture 或测试运行。
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app

TEST_DATABASE_URL = "sqlite://"  # 纯内存，不写磁盘文件

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# 内存数据库也需要启用外键约束（SQLite 默认关闭，D18）
@event.listens_for(engine, "connect")
def _set_fk_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def client():
    """
    每个测试函数都会得到一个独立的 client + 空数据库。

    流程：
    1. 在测试 DB 上建表
    2. 覆盖 get_db 依赖，让 API 请求用测试 session
    3. yield TestClient 给测试函数使用
    4. 清理：恢复依赖、删除所有表（下个测试从空库开始）
    """
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(client):
    """
    与 client 共享同一内存库的原始 Session。

    用途：需要绕过 API 直接操作数据的测试，例如把 next_review_at
    拨到过去来模拟"已到期"。

    为什么能共享：StaticPool 让所有 Session 底层复用同一条 SQLite
    连接，所以 client 提交的数据对这个 session 立即可见，反之亦然。
    client fixture 必须先运行（建表），所以这里把它列为依赖。
    """
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
