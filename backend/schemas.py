"""
Pydantic 数据模型
================
这个文件定义 API 的请求/响应格式，以及内部数据传输类型。
不要在这里放 SQLAlchemy 模型（那些在 models.py 里）。

概念解释：
- Pydantic BaseModel 做两件事：
  1. 验证输入数据（格式不对自动返回 422 错误）
  2. 序列化输出数据（把 Python 对象转成 JSON）
- ConfigDict(from_attributes=True) 让 Pydantic 可以直接读取
  SQLAlchemy ORM 对象的属性（而不是只能读字典）
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# 共用约束类型
# ============================================================
# 用 Literal 而不是裸 str，这样 Pydantic 会自动校验，
# 传入无效值（比如 rating="perfect"）直接返回 422

TermStatus = Literal["new", "learning", "mastered"]
ReviewRating = Literal["forgot", "hard", "good", "easy"]


# ============================================================
# Term 相关 schemas
# ============================================================

class TermCreate(BaseModel):
    """
    创建词条的请求体。

    只有 term 是必填的。用户可以先快速添加一个词，
    之后再补充释义、例句等内容。

    tags 在 API 层是 list[str]，crud.py 负责转成逗号字符串存数据库。
    """

    term: str  # 唯一的必填字段
    language: str = "en"
    definition: str = ""
    examples: str = ""
    usage_context: str = ""
    tags: list[str] = Field(default_factory=list)


class TermUpdate(BaseModel):
    """
    更新词条的请求体。

    所有字段都是 optional（None 表示"不更新这个字段"）。
    这样前端可以只传需要修改的字段，其余保持不变。

    特别注意 tags 的语义：
    - tags 未传（None）→ 保持原有 tags 不变
    - tags 传了空列表（[]）→ 清空 tags
    - tags 传了新列表 → 替换为新 tags
    """

    term: str | None = None
    language: str | None = None
    definition: str | None = None
    examples: str | None = None
    usage_context: str | None = None
    tags: list[str] | None = None  # None = 不更新，[] = 清空


class TermResponse(BaseModel):
    """
    返回给前端的词条对象。

    from_attributes=True 让 Pydantic 可以直接从 SQLAlchemy ORM 对象读取属性：
        term_obj = db.query(Term).first()
        return TermResponse.model_validate(term_obj)

    注意 tags 在这里是 list[str]，但数据库里存的是逗号字符串。
    crud.py 在返回之前会做转换。
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    term: str
    language: str
    definition: str
    examples: str
    usage_context: str
    tags: list[str]  # 从数据库的逗号字符串转换而来
    status: TermStatus
    ease_factor: float
    interval_days: int
    repetitions: int
    created_at: datetime
    updated_at: datetime
    last_reviewed_at: datetime | None
    next_review_at: datetime | None


# ============================================================
# Review 相关 schemas
# ============================================================

class ReviewCreate(BaseModel):
    """提交复习结果的请求体。只需要一个 rating。"""

    rating: ReviewRating


class ReviewLogResponse(BaseModel):
    """返回给前端的复习记录对象。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    term_id: int
    rating: ReviewRating
    reviewed_at: datetime
    previous_next_review_at: datetime | None
    new_next_review_at: datetime
    interval_days_after: int


class TodayReviewsResponse(BaseModel):
    """
    GET /reviews/today 的返回结构。

    分成两个列表：
    - due_reviews: 已到复习时间的旧词
    - new_terms: 还没学过的新词（限制数量）

    两个列表不会重叠，因为新词的 next_review_at 是 NULL。
    """

    due_reviews: list[TermResponse]
    new_terms: list[TermResponse]


# ============================================================
# Scheduler 内部类型
# ============================================================

class ReviewScheduleResult(BaseModel):
    """
    scheduler.py 的返回类型。

    scheduler 计算完成后返回这个对象，调用方（crud.py）
    根据它更新 term 的各个字段。

    这不是 API response，而是内部数据传输对象。
    放在 schemas.py 是为了让所有 Pydantic 类型集中管理。
    """

    next_review_at: datetime
    interval_days: int
    ease_factor: float
    repetitions: int
    status: TermStatus
