"""
数据库操作层（CRUD）
====================
所有 SQLAlchemy 查询都在这里。Router 只调用这些函数，不直接写查询。
标签转换（list ↔ 逗号字符串）由 utils/tags.py 提供，在这里调用。

返回值：Pydantic response 对象（已做 tags 转换），或 None（表示记录不存在）。
"""

from sqlalchemy.orm import Session

from backend.models import ReviewLog, Term
from backend.scheduler import calculate_next_review
from backend.schemas import (
    ReviewCreate,
    ReviewLogResponse,
    TermCreate,
    TermResponse,
    TermStatus,
    TermUpdate,
    TodayReviewsResponse,
)
from backend.utils.tags import string_to_tags, tags_to_string
from backend.utils.time import utc_now


# ============================================================
# 私有辅助函数
# ============================================================

def _to_review_log_response(log: ReviewLog) -> ReviewLogResponse:
    """ReviewLog ORM → Pydantic。字段名一一对应，无需额外转换。"""
    return ReviewLogResponse.model_validate(log)


def _to_term_response(term: Term) -> TermResponse:
    """将 ORM 对象转换为 API 响应 schema，同时把 tags 从字符串转为列表"""
    return TermResponse(
        id=term.id,
        term=term.term,
        language=term.language,
        definition=term.definition,
        examples=term.examples,
        usage_context=term.usage_context,
        tags=string_to_tags(term.tags),  # "GRE,CS" → ["GRE", "CS"]
        status=term.status,
        ease_factor=term.ease_factor,
        interval_days=term.interval_days,
        repetitions=term.repetitions,
        created_at=term.created_at,
        updated_at=term.updated_at,
        last_reviewed_at=term.last_reviewed_at,
        next_review_at=term.next_review_at,
    )


# ============================================================
# Terms CRUD
# ============================================================

def create_term(db: Session, data: TermCreate) -> TermResponse:
    """
    创建新词条。

    只有 term 是必填的，其余字段都有默认值（D19）。
    term 允许重复，没有唯一约束（D20）。
    新词条的 next_review_at 为 NULL，等待第一次复习后才设置（D07）。
    """
    term = Term(
        term=data.term,
        language=data.language,
        definition=data.definition,
        examples=data.examples,
        usage_context=data.usage_context,
        tags=tags_to_string(data.tags),  # ["GRE", "CS"] → "GRE,CS"
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return _to_term_response(term)


def get_term(db: Session, term_id: int) -> TermResponse | None:
    """根据 ID 获取单个词条；不存在时返回 None（router 负责转成 404）"""
    term = db.query(Term).filter(Term.id == term_id).first()
    if term is None:
        return None
    return _to_term_response(term)


def list_terms(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    status: TermStatus | None = None,
    tag: str | None = None,
) -> list[TermResponse]:
    """
    获取词条列表，支持分页和过滤。

    tag 过滤用 SQL LIKE（即 String.contains），已知局限：
    "AI" 可能误匹配 "RAID"（D08，MVP 可接受，后续可升级）。
    """
    query = db.query(Term)
    if status is not None:
        query = query.filter(Term.status == status)
    if tag is not None:
        query = query.filter(Term.tags.contains(tag))
    terms = query.offset(skip).limit(limit).all()
    return [_to_term_response(t) for t in terms]


def update_term(db: Session, term_id: int, data: TermUpdate) -> TermResponse | None:
    """
    更新词条字段（部分更新）。

    None 表示"未传该字段，保持不变"。
    tags 的特殊语义（D08 / TermUpdate 注释）：
      - None → 保持原有 tags
      - [] → 清空 tags
      - [新列表] → 替换
    updated_at 始终更新（D09 时间戳规则）。
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if term is None:
        return None

    if data.term is not None:
        term.term = data.term
    if data.language is not None:
        term.language = data.language
    if data.definition is not None:
        term.definition = data.definition
    if data.examples is not None:
        term.examples = data.examples
    if data.usage_context is not None:
        term.usage_context = data.usage_context
    if data.tags is not None:
        term.tags = tags_to_string(data.tags)

    term.updated_at = utc_now()
    db.commit()
    db.refresh(term)
    return _to_term_response(term)


def delete_term(db: Session, term_id: int) -> bool:
    """
    删除词条及其所有复习记录（级联删除，D18）。
    返回 True 表示删除成功，False 表示记录不存在。
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if term is None:
        return False
    db.delete(term)
    db.commit()
    return True


# ============================================================
# Reviews CRUD
# ============================================================

def get_today_reviews(db: Session, new_limit: int = 10) -> TodayReviewsResponse:
    """
    返回今天需要处理的两个列表（D23）：

    due_reviews：status != "new" AND next_review_at IS NOT NULL AND next_review_at <= 现在
        → 已到复习时间的旧词，按 next_review_at 升序（最晚欠复习的排最前）

    new_terms：status == "new"，按 created_at 升序，最多 new_limit 条
        → 从未学过的词，先加入的先学

    两个列表永远不会重叠：新词的 next_review_at 是 NULL，
    因此不满足 due_reviews 的 IS NOT NULL 条件（D07）。
    """
    now = utc_now()

    due = (
        db.query(Term)
        .filter(
            Term.status != "new",
            Term.next_review_at.isnot(None),
            Term.next_review_at <= now,
        )
        .order_by(Term.next_review_at.asc())
        .all()
    )

    new = (
        db.query(Term)
        .filter(Term.status == "new")
        .order_by(Term.created_at.asc())
        .limit(new_limit)
        .all()
    )

    return TodayReviewsResponse(
        due_reviews=[_to_term_response(t) for t in due],
        new_terms=[_to_term_response(t) for t in new],
    )


def create_review(
    db: Session, term_id: int, data: ReviewCreate
) -> ReviewLogResponse | None:
    """
    提交一次复习结果，更新词条的调度字段，写入 review_log。

    流程：
    1. 确认词条存在（不存在 → None，router 转 404）
    2. 记录复习前的 next_review_at（存入 previous_next_review_at）
    3. 调用 scheduler 计算新的调度参数
    4. 写入 ReviewLog
    5. 更新 Term 的所有调度字段 + 时间戳（D timestamps 规则）
    6. 一次 commit，保证原子性
    """
    term = db.query(Term).filter(Term.id == term_id).first()
    if term is None:
        return None

    now = utc_now()
    previous_next_review_at = term.next_review_at  # 第一次复习时为 NULL

    result = calculate_next_review(
        rating=data.rating,
        current_interval_days=term.interval_days,
        ease_factor=term.ease_factor,
        repetitions=term.repetitions,
        now=now,
    )

    log = ReviewLog(
        term_id=term_id,
        rating=data.rating,
        reviewed_at=now,
        previous_next_review_at=previous_next_review_at,
        new_next_review_at=result.next_review_at,
        interval_days_after=result.interval_days,
    )
    db.add(log)

    # 用 scheduler 的结果更新词条调度字段
    term.status = result.status
    term.ease_factor = result.ease_factor
    term.interval_days = result.interval_days
    term.repetitions = result.repetitions
    term.next_review_at = result.next_review_at
    # 时间戳：last_reviewed_at 只在复习时更新（D17）；updated_at 每次写都更新
    term.last_reviewed_at = now
    term.updated_at = now

    db.commit()
    db.refresh(log)
    return _to_review_log_response(log)


def get_term_reviews(db: Session, term_id: int) -> list[ReviewLogResponse] | None:
    """
    获取某词条的所有复习记录，按时间倒序（最新的排最前）。
    词条不存在 → None（router 转 404）。
    """
    term_exists = db.query(Term.id).filter(Term.id == term_id).first()
    if term_exists is None:
        return None

    logs = (
        db.query(ReviewLog)
        .filter(ReviewLog.term_id == term_id)
        .order_by(ReviewLog.reviewed_at.desc())
        .all()
    )
    return [_to_review_log_response(log) for log in logs]
