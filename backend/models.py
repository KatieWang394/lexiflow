"""
数据库模型定义
==============
这个文件只放 SQLAlchemy ORM 类，定义数据库表的结构。
不要在这里放 Pydantic schema（那些在 schemas.py 里）。

两个模型：
- Term：词条表，存储用户添加的每一个单词/短语/术语
- ReviewLog：复习记录表，每次复习产生一条记录
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.utils.time import utc_now


class Term(Base):
    """
    词条表。

    这是整个应用最核心的表。每一行代表一个要背的词条。
    除了基本信息（term, definition 等），还包含调度相关字段
    （ease_factor, interval_days, repetitions），
    这些字段由 scheduler.py 在每次复习后更新。
    """

    __tablename__ = "terms"

    # === 基本信息 ===
    id = Column(Integer, primary_key=True, autoincrement=True)
    term = Column(String, nullable=False)  # 单词/短语/术语，唯一的必填字段
    language = Column(String, default="en")  # 语言代码，默认英文
    definition = Column(String, default="")  # 释义，用户可后补
    examples = Column(String, default="")  # 例句，纯文本，多条用换行分隔
    usage_context = Column(String, default="")  # 使用场景描述
    tags = Column(String, default="")  # 标签，逗号分隔字符串（API 层用 list[str]）

    # === 调度相关字段 ===
    # status: 词条当前状态
    #   "new"      → 从未学过，等待第一次复习
    #   "learning" → 学习中，还不够熟练
    #   "mastered" → 已掌握，进入长间隔复习
    status = Column(String, default="new")

    # ease_factor: SM-2 算法的难度因子
    #   默认 2.5，范围通常 1.3~3.0
    #   值越大 → 间隔增长越快（这个词对你来说容易）
    #   v0.1 保持不变，v0.2 升级 SM-2 时会动态调整
    ease_factor = Column(Float, default=2.5)

    # interval_days: 当前复习间隔（天）
    #   表示"上次复习后隔多少天再复习"
    interval_days = Column(Integer, default=0)

    # repetitions: 连续正确回忆的次数
    #   forgot 会重置为 0，其他评分 +1
    repetitions = Column(Integer, default=0)

    # === 时间字段 ===
    # 注意：default=utc_now 是函数引用（每行创建时调用），
    #       不是 default=utc_now()（只在模块加载时调用一次）
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True, default=None)
    next_review_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # === 关联 ===
    # relationship 定义 Python 层面的关联，让你可以通过 term.review_logs 访问复习记录
    # cascade="all, delete-orphan"：删除 term 时自动删除所有关联的 review_logs
    review_logs = relationship(
        "ReviewLog",
        back_populates="term",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ReviewLog(Base):
    """
    复习记录表。

    每次用户复习一个词条并给出评分，就插入一条记录。
    用途：
    1. 查看某个词的复习历史
    2. 分析哪些词经常忘
    3. 验证调度算法是否合理
    """

    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 关联的词条 ID
    # ondelete="CASCADE"：数据库层面的级联删除（配合 SQLAlchemy 的 relationship cascade）
    term_id = Column(
        Integer,
        ForeignKey("terms.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 用户评分：forgot / hard / good / easy
    rating = Column(String, nullable=False)

    # 复习时间
    reviewed_at = Column(DateTime(timezone=True), default=utc_now)

    # 复习前该词的 next_review_at（第一次复习时为 NULL，因为新词的 next_review_at 是 NULL）
    previous_next_review_at = Column(DateTime(timezone=True), nullable=True)

    # scheduler 计算出的新 next_review_at
    new_next_review_at = Column(DateTime(timezone=True), nullable=False)

    # 复习后的新间隔天数
    interval_days_after = Column(Integer, nullable=False)

    # === 关联 ===
    term = relationship("Term", back_populates="review_logs")
