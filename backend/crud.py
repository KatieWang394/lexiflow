"""
数据库操作层（CRUD）
====================
所有 SQLAlchemy 查询都在这里。Router 只调用这些函数，不直接写查询。
标签转换（list ↔ 逗号字符串）由 utils/tags.py 提供，在这里调用。

返回值：Pydantic response 对象（已做 tags 转换），或 None（表示记录不存在）。
"""

from sqlalchemy.orm import Session

from backend.models import Term
from backend.schemas import TermCreate, TermResponse, TermStatus, TermUpdate
from backend.utils.tags import string_to_tags, tags_to_string
from backend.utils.time import utc_now


# ============================================================
# 私有辅助函数
# ============================================================

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
