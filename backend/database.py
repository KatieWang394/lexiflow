"""
数据库配置模块
==============
负责三件事：
1. 创建 SQLAlchemy engine（连接 SQLite 数据库）
2. 创建 SessionLocal 工厂（每次请求获取一个数据库 session）
3. 定义 Base 类（所有 ORM 模型继承它）

概念解释：
- engine：数据库的"连接入口"，知道数据库在哪、用什么驱动
- SessionLocal：一个工厂函数，每次调用创建一个新的数据库会话（session）
  session 是你和数据库交互的上下文，查询、插入、更新都通过它
- Base：所有 ORM 模型的父类，SQLAlchemy 通过它知道哪些类对应哪些表
- get_db：FastAPI 的"依赖注入"函数，每个请求自动获取 session，请求结束自动关闭
"""

import os
from datetime import timezone as _tz

from sqlalchemy import DateTime as _DateTime, TypeDecorator, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 数据库文件路径：backend/data/vocab.db
# os.path.dirname(__file__) 获取当前文件所在目录（backend/）
_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(_data_dir, exist_ok=True)  # 确保 data/ 目录存在

SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(_data_dir, 'vocab.db')}"

# 创建 engine
# connect_args={"check_same_thread": False} 是 SQLite 特有的设置：
# SQLite 默认只允许创建它的线程使用它，但 FastAPI 可能在不同线程处理请求，
# 所以需要关闭这个限制
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# 启用 SQLite 外键约束
# SQLite 默认不执行外键约束（即使你定义了 FOREIGN KEY 也不检查），
# 必须在每次连接时手动开启。这里用 SQLAlchemy 的事件机制：
# 每当创建新连接时，自动执行 PRAGMA foreign_keys = ON
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


# 创建 session 工厂
# autocommit=False：不自动提交，需要显式 db.commit()
# autoflush=False：不自动刷新，避免意外的隐式查询
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# 声明式基类（SQLAlchemy 2.x 风格）
class Base(DeclarativeBase):
    pass


class TZDateTime(TypeDecorator):
    """SQLite 的 DateTime(timezone=True) 读回时会丢失 tzinfo，这个类在读取时补回 UTC。"""

    impl = _DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=_tz.utc)
        return value


def get_db():
    """
    FastAPI 依赖注入函数。

    用法（在路由中）：
        @router.get("/terms")
        def list_terms(db: Session = Depends(get_db)):
            ...

    工作原理：
    - 每次 API 请求进来时，FastAPI 调用 get_db()
    - yield 出一个 session 供路由函数使用
    - 路由函数执行完后（无论成功还是异常），finally 块关闭 session
    - 这就是 Python 的 generator + context manager 模式

    测试时可以通过 app.dependency_overrides[get_db] 替换成测试数据库的 session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    根据所有继承 Base 的 ORM 模型创建数据库表。
    如果表已存在则跳过（create_all 的默认行为）。

    注意：必须在调用此函数之前 import models.py，
    否则 Base 不知道有哪些表需要创建。
    """
    Base.metadata.create_all(bind=engine)
