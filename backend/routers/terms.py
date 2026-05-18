"""
词条（Terms）路由
=================
处理所有 /terms 相关的 HTTP 请求。
只负责 HTTP 关注点：解析参数、调用 crud、返回响应或 404。
不写 SQLAlchemy 查询，不做 tags 转换。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend import crud
from backend.database import get_db
from backend.schemas import TermCreate, TermResponse, TermStatus, TermUpdate

router = APIRouter(prefix="/terms", tags=["terms"])


@router.post("", response_model=TermResponse, status_code=201)
def create_term(data: TermCreate, db: Session = Depends(get_db)):
    return crud.create_term(db, data)


@router.get("", response_model=list[TermResponse])
def list_terms(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: TermStatus | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
):
    return crud.list_terms(db, skip=skip, limit=limit, status=status, tag=tag)


@router.get("/{term_id}", response_model=TermResponse)
def get_term(term_id: int, db: Session = Depends(get_db)):
    term = crud.get_term(db, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    return term


@router.put("/{term_id}", response_model=TermResponse)
def update_term(term_id: int, data: TermUpdate, db: Session = Depends(get_db)):
    term = crud.update_term(db, term_id, data)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    return term


@router.delete("/{term_id}")
def delete_term(term_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_term(db, term_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Term not found")
    return {"detail": "Term deleted"}
