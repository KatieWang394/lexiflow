"""
Reviews API 集成测试
====================
覆盖三个端点的完整行为：
  GET  /reviews/today
  POST /terms/{term_id}/reviews
  GET  /terms/{term_id}/reviews

需要直接操作数据库时（时间操控），使用 conftest 的 db fixture。
StaticPool 保证 client 与 db session 共享同一条 SQLite 连接。
"""

from datetime import timedelta

import pytest

from backend.models import Term
from backend.utils.time import utc_now


# ============================================================
# 辅助
# ============================================================

def _make_term(client, term="test", **kwargs):
    """创建词条，返回完整响应体"""
    return client.post("/terms", json={"term": term, **kwargs}).json()


def _review(client, term_id, rating):
    """提交复习，返回完整响应体"""
    return client.post(f"/terms/{term_id}/reviews", json={"rating": rating}).json()


# ============================================================
# GET /reviews/today
# ============================================================

def test_today_empty_db(client):
    resp = client.get("/reviews/today")
    assert resp.status_code == 200
    assert resp.json() == {"due_reviews": [], "new_terms": []}


def test_today_new_terms_appear(client):
    """新词（status=new）出现在 new_terms，不在 due_reviews"""
    _make_term(client, "alpha")
    _make_term(client, "beta")
    data = client.get("/reviews/today").json()
    assert len(data["new_terms"]) == 2
    assert data["due_reviews"] == []


def test_today_new_limit_default_is_10(client):
    for i in range(15):
        _make_term(client, f"word{i}")
    data = client.get("/reviews/today").json()
    assert len(data["new_terms"]) == 10


def test_today_new_limit_custom(client):
    for i in range(8):
        _make_term(client, f"word{i}")
    data = client.get("/reviews/today?new_limit=5").json()
    assert len(data["new_terms"]) == 5


def test_today_new_limit_zero(client):
    _make_term(client, "alpha")
    data = client.get("/reviews/today?new_limit=0").json()
    assert data["new_terms"] == []


def test_today_new_limit_too_large_returns_422(client):
    resp = client.get("/reviews/today?new_limit=51")
    assert resp.status_code == 422


def test_today_new_limit_negative_returns_422(client):
    resp = client.get("/reviews/today?new_limit=-1")
    assert resp.status_code == 422


def test_today_new_terms_ordered_by_created_at(client):
    """new_terms 按 created_at 升序，先加入的先学"""
    _make_term(client, "first")
    _make_term(client, "second")
    _make_term(client, "third")
    terms = client.get("/reviews/today").json()["new_terms"]
    assert [t["term"] for t in terms] == ["first", "second", "third"]


def test_today_due_reviews_appear(client, db):
    """复习后把 next_review_at 拨到过去，词条应出现在 due_reviews"""
    t = _make_term(client, "overdue")
    _review(client, t["id"], "good")

    # 模拟 7 天已过：直接写数据库
    term = db.query(Term).filter(Term.id == t["id"]).first()
    term.next_review_at = utc_now() - timedelta(days=1)
    db.commit()

    data = client.get("/reviews/today").json()
    assert len(data["due_reviews"]) == 1
    assert data["due_reviews"][0]["id"] == t["id"]
    assert data["new_terms"] == []


def test_today_not_yet_due_appears_in_neither(client):
    """刚复习完：status != new，但 next_review_at 在未来 → 两个列表都不出现"""
    t = _make_term(client, "fresh")
    _review(client, t["id"], "good")
    data = client.get("/reviews/today").json()
    assert data["due_reviews"] == []
    assert data["new_terms"] == []


def test_today_no_overlap_between_lists(client, db):
    """新词在 new_terms，逾期词在 due_reviews，两个列表不重叠"""
    new = _make_term(client, "new_word")
    due = _make_term(client, "due_word")

    _review(client, due["id"], "hard")
    term = db.query(Term).filter(Term.id == due["id"]).first()
    term.next_review_at = utc_now() - timedelta(hours=1)
    db.commit()

    data = client.get("/reviews/today").json()
    new_ids = {t["id"] for t in data["new_terms"]}
    due_ids = {t["id"] for t in data["due_reviews"]}

    assert new["id"] in new_ids
    assert due["id"] in due_ids
    assert new_ids.isdisjoint(due_ids)


def test_today_due_reviews_ordered_by_next_review_at(client, db):
    """due_reviews 按 next_review_at 升序（最久未复习的排最前）"""
    a = _make_term(client, "a")
    b = _make_term(client, "b")
    _review(client, a["id"], "easy")
    _review(client, b["id"], "easy")

    now = utc_now()
    ta = db.query(Term).filter(Term.id == a["id"]).first()
    tb = db.query(Term).filter(Term.id == b["id"]).first()
    ta.next_review_at = now - timedelta(days=3)  # a 更早到期
    tb.next_review_at = now - timedelta(days=1)
    db.commit()

    ids = [t["id"] for t in client.get("/reviews/today").json()["due_reviews"]]
    assert ids == [a["id"], b["id"]]


def test_today_mastered_term_still_appears_in_due_when_overdue(client, db):
    """mastered 词也参与 due_reviews（只要 next_review_at <= now 且不是 new）"""
    t = _make_term(client, "mastered_word")
    for _ in range(3):  # 3 次 easy → mastered
        _review(client, t["id"], "easy")

    assert client.get(f"/terms/{t['id']}").json()["status"] == "mastered"

    term = db.query(Term).filter(Term.id == t["id"]).first()
    term.next_review_at = utc_now() - timedelta(days=1)
    db.commit()

    data = client.get("/reviews/today").json()
    assert any(x["id"] == t["id"] for x in data["due_reviews"])


# ============================================================
# POST /terms/{term_id}/reviews
# ============================================================

def test_create_review_returns_correct_fields(client):
    """返回完整的 ReviewLogResponse 结构"""
    t = _make_term(client, "vocab")
    resp = client.post(f"/terms/{t['id']}/reviews", json={"rating": "good"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["term_id"] == t["id"]
    assert data["rating"] == "good"
    assert data["interval_days_after"] == 7
    assert data["previous_next_review_at"] is None   # 第一次，之前是 NULL
    assert data["new_next_review_at"] is not None
    assert data["reviewed_at"] is not None
    assert "id" in data


def test_create_review_missing_term_returns_404(client):
    resp = client.post("/terms/9999/reviews", json={"rating": "good"})
    assert resp.status_code == 404


def test_create_review_invalid_rating_returns_422(client):
    t = _make_term(client)
    resp = client.post(f"/terms/{t['id']}/reviews", json={"rating": "perfect"})
    assert resp.status_code == 422


@pytest.mark.parametrize("rating,expected_days", [
    ("forgot", 1),
    ("hard",   3),
    ("good",   7),
    ("easy",  14),
])
def test_create_review_interval_days(client, rating, expected_days):
    t = _make_term(client)
    data = _review(client, t["id"], rating)
    assert data["interval_days_after"] == expected_days


def test_create_review_first_previous_is_null(client):
    """第一次复习：previous_next_review_at 为 NULL（新词创建时 next_review_at=NULL）"""
    t = _make_term(client)
    data = _review(client, t["id"], "easy")
    assert data["previous_next_review_at"] is None


def test_create_review_second_previous_equals_first_new(client):
    """第二次复习：previous = 上次的 new_next_review_at"""
    t = _make_term(client)
    first = _review(client, t["id"], "good")
    second = _review(client, t["id"], "good")
    assert second["previous_next_review_at"] == first["new_next_review_at"]


def test_create_review_updates_term_status(client):
    """复习后 term.status 从 new 变为 learning"""
    t = _make_term(client)
    assert t["status"] == "new"
    _review(client, t["id"], "good")
    updated = client.get(f"/terms/{t['id']}").json()
    assert updated["status"] == "learning"


def test_create_review_sets_next_review_at(client):
    """复习后 next_review_at 从 NULL 变为具体时间"""
    t = _make_term(client)
    assert t["next_review_at"] is None
    _review(client, t["id"], "good")
    assert client.get(f"/terms/{t['id']}").json()["next_review_at"] is not None


def test_create_review_sets_last_reviewed_at(client):
    """复习后 last_reviewed_at 从 NULL 变为具体时间"""
    t = _make_term(client)
    assert t["last_reviewed_at"] is None
    _review(client, t["id"], "good")
    assert client.get(f"/terms/{t['id']}").json()["last_reviewed_at"] is not None


def test_create_review_forgot_resets_repetitions(client):
    """forgot 把 repetitions 重置为 0，不管之前积累了多少"""
    t = _make_term(client)
    _review(client, t["id"], "good")
    _review(client, t["id"], "good")
    _review(client, t["id"], "forgot")
    updated = client.get(f"/terms/{t['id']}").json()
    assert updated["repetitions"] == 0
    assert updated["status"] == "learning"


def test_create_review_easy_x3_reaches_mastered(client):
    """easy 规则：rep >= 2 时升 mastered。第 3 次 easy 时 rep=2 → mastered"""
    t = _make_term(client)
    for _ in range(3):
        _review(client, t["id"], "easy")
    assert client.get(f"/terms/{t['id']}").json()["status"] == "mastered"


def test_create_review_easy_x2_still_learning(client):
    """第 2 次 easy 时 rep=1（< 2）→ 仍是 learning"""
    t = _make_term(client)
    _review(client, t["id"], "easy")
    _review(client, t["id"], "easy")
    assert client.get(f"/terms/{t['id']}").json()["status"] == "learning"


def test_create_review_good_x4_reaches_mastered(client):
    """good 规则：rep >= 3 时升 mastered。第 4 次 good 时 rep=3 → mastered"""
    t = _make_term(client)
    for _ in range(4):
        _review(client, t["id"], "good")
    assert client.get(f"/terms/{t['id']}").json()["status"] == "mastered"


def test_create_review_good_x3_still_learning(client):
    """第 3 次 good 时 rep=2（< 3）→ 仍是 learning"""
    t = _make_term(client)
    for _ in range(3):
        _review(client, t["id"], "good")
    assert client.get(f"/terms/{t['id']}").json()["status"] == "learning"


def test_create_review_forgot_after_mastered_demotes(client):
    """mastered 后 forgot → 回到 learning，repetitions 归零"""
    t = _make_term(client)
    for _ in range(3):
        _review(client, t["id"], "easy")
    assert client.get(f"/terms/{t['id']}").json()["status"] == "mastered"

    _review(client, t["id"], "forgot")
    updated = client.get(f"/terms/{t['id']}").json()
    assert updated["status"] == "learning"
    assert updated["repetitions"] == 0


def test_create_review_multiple_logs_accumulate(client):
    """多次复习 → 积累多条 log"""
    t = _make_term(client)
    _review(client, t["id"], "forgot")
    _review(client, t["id"], "hard")
    _review(client, t["id"], "good")
    logs = client.get(f"/terms/{t['id']}/reviews").json()
    assert len(logs) == 3


# ============================================================
# GET /terms/{term_id}/reviews
# ============================================================

def test_get_reviews_new_term_empty_list(client):
    """新词没有任何复习记录 → 返回空列表（不是 404）"""
    t = _make_term(client)
    resp = client.get(f"/terms/{t['id']}/reviews")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_reviews_returns_all_logs(client):
    """所有复习记录都返回，包含正确的 term_id"""
    t = _make_term(client)
    _review(client, t["id"], "good")
    _review(client, t["id"], "easy")
    logs = client.get(f"/terms/{t['id']}/reviews").json()
    assert len(logs) == 2
    assert all(log["term_id"] == t["id"] for log in logs)


def test_get_reviews_missing_term_returns_404(client):
    resp = client.get("/terms/9999/reviews")
    assert resp.status_code == 404


def test_get_reviews_ordered_newest_first(client):
    """按 reviewed_at 倒序：最新复习排最前"""
    t = _make_term(client)
    _review(client, t["id"], "forgot")
    _review(client, t["id"], "easy")
    logs = client.get(f"/terms/{t['id']}/reviews").json()
    assert logs[0]["rating"] == "easy"
    assert logs[1]["rating"] == "forgot"


def test_get_reviews_only_own_logs(client):
    """只返回指定词条自己的复习记录，不混入其他词条的"""
    a = _make_term(client, "word_a")
    b = _make_term(client, "word_b")
    _review(client, a["id"], "good")
    _review(client, b["id"], "easy")
    _review(client, b["id"], "hard")

    logs_a = client.get(f"/terms/{a['id']}/reviews").json()
    logs_b = client.get(f"/terms/{b['id']}/reviews").json()
    assert len(logs_a) == 1
    assert len(logs_b) == 2


def test_get_reviews_after_cascade_delete_returns_404(client):
    """删除词条后，review 记录也消失，GET 应返回 404（而非空列表）"""
    t = _make_term(client)
    _review(client, t["id"], "good")
    client.delete(f"/terms/{t['id']}")
    assert client.get(f"/terms/{t['id']}/reviews").status_code == 404
