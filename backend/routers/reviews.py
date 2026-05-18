"""
复习（Reviews）路由
===================
处理所有复习相关的 HTTP 请求。
只负责 HTTP 关注点：解析参数、调用 crud、返回响应或 404。
不写 SQLAlchemy 查询，不调用 scheduler。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend import crud
from backend.database import get_db
from backend.schemas import ReviewCreate, ReviewLogResponse, TodayReviewsResponse

router = APIRouter(tags=["reviews"])


@router.get("/reviews/today", response_model=TodayReviewsResponse)
def get_today_reviews(
    new_limit: int = Query(10, ge=0, le=50),
    db: Session = Depends(get_db),
):
    return crud.get_today_reviews(db, new_limit=new_limit)


@router.post("/terms/{term_id}/reviews", response_model=ReviewLogResponse, status_code=201)
def create_review(
    term_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
):
    log = crud.create_review(db, term_id=term_id, data=data)
    if log is None:
        raise HTTPException(status_code=404, detail="Term not found")
    return log


@router.get("/terms/{term_id}/reviews", response_model=list[ReviewLogResponse])
def get_term_reviews(
    term_id: int,
    db: Session = Depends(get_db),
):
    logs = crud.get_term_reviews(db, term_id=term_id)
    if logs is None:
        raise HTTPException(status_code=404, detail="Term not found")
    return logs
