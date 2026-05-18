"""
Terms API 集成测试
==================
通过 TestClient 测试所有 /terms 端点，覆盖：
- 创建（最小字段 / 全字段）
- 读取（单个 / 列表）
- 过滤（status / tag）
- 分页（skip / limit）
- 更新（部分字段 / tags 三种语义）
- 删除
- 错误路径（404 / 422）
"""


# ============================================================
# POST /terms
# ============================================================

def test_create_term_minimal(client):
    """只传 term，其余字段用默认值"""
    resp = client.post("/terms", json={"term": "ephemeral"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["term"] == "ephemeral"
    assert data["language"] == "en"
    assert data["definition"] == ""
    assert data["examples"] == ""
    assert data["usage_context"] == ""
    assert data["tags"] == []
    assert data["status"] == "new"
    assert data["ease_factor"] == 2.5
    assert data["interval_days"] == 0
    assert data["repetitions"] == 0
    assert data["last_reviewed_at"] is None
    assert data["next_review_at"] is None
    assert "id" in data
    assert data["created_at"] is not None
    assert data["updated_at"] is not None


def test_create_term_full(client):
    """传入所有可选字段"""
    payload = {
        "term": "ephemeral",
        "language": "en",
        "definition": "lasting for a very short time",
        "examples": "The ephemeral beauty of cherry blossoms.",
        "usage_context": "literary",
        "tags": ["GRE", "adjective"],
    }
    resp = client.post("/terms", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["definition"] == "lasting for a very short time"
    assert data["tags"] == ["GRE", "adjective"]
    assert data["language"] == "en"


def test_create_term_missing_term_returns_422(client):
    """term 是唯一必填字段"""
    resp = client.post("/terms", json={"definition": "no term provided"})
    assert resp.status_code == 422


def test_create_duplicate_terms_allowed(client):
    """相同 term 可以重复创建（D20）"""
    client.post("/terms", json={"term": "run"})
    client.post("/terms", json={"term": "run"})
    resp = client.get("/terms")
    assert len(resp.json()) == 2


# ============================================================
# GET /terms
# ============================================================

def test_list_terms_empty(client):
    resp = client.get("/terms")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_terms(client):
    client.post("/terms", json={"term": "alpha"})
    client.post("/terms", json={"term": "beta"})
    resp = client.get("/terms")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_terms_limit(client):
    for i in range(5):
        client.post("/terms", json={"term": f"word{i}"})
    resp = client.get("/terms?limit=3")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_list_terms_skip(client):
    for i in range(5):
        client.post("/terms", json={"term": f"word{i}"})
    resp = client.get("/terms?skip=3")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_terms_skip_negative_returns_422(client):
    """skip=-1 低于下界 ge=0 → 422"""
    resp = client.get("/terms?skip=-1")
    assert resp.status_code == 422


def test_list_terms_limit_max_boundary(client):
    """limit=100 是合法上界，应返回 200"""
    resp = client.get("/terms?limit=100")
    assert resp.status_code == 200


def test_list_terms_limit_max_is_100(client):
    """limit 超过 100 → 422"""
    resp = client.get("/terms?limit=101")
    assert resp.status_code == 422


def test_list_terms_limit_min_is_1(client):
    """limit=0 → 422"""
    resp = client.get("/terms?limit=0")
    assert resp.status_code == 422


def test_filter_by_status_new(client):
    client.post("/terms", json={"term": "alpha"})
    client.post("/terms", json={"term": "beta"})
    resp = client.get("/terms?status=new")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 2
    assert all(t["status"] == "new" for t in results)


def test_filter_by_invalid_status_returns_422(client):
    resp = client.get("/terms?status=unknown")
    assert resp.status_code == 422


def test_filter_by_tag(client):
    client.post("/terms", json={"term": "gradient descent", "tags": ["ML", "math"]})
    client.post("/terms", json={"term": "backprop", "tags": ["ML"]})
    client.post("/terms", json={"term": "serendipity", "tags": ["GRE"]})
    resp = client.get("/terms?tag=GRE")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["term"] == "serendipity"


def test_filter_by_tag_no_match(client):
    client.post("/terms", json={"term": "alpha", "tags": ["GRE"]})
    resp = client.get("/terms?tag=CS")
    assert resp.json() == []


# ============================================================
# GET /terms/{term_id}
# ============================================================

def test_get_term(client):
    created = client.post("/terms", json={"term": "serendipity"}).json()
    resp = client.get(f"/terms/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["term"] == "serendipity"
    assert resp.json()["id"] == created["id"]


def test_get_term_not_found(client):
    resp = client.get("/terms/9999")
    assert resp.status_code == 404
    assert "detail" in resp.json()


# ============================================================
# PUT /terms/{term_id}
# ============================================================

def test_update_term_single_field(client):
    """只更新一个字段，其余不变"""
    created = client.post("/terms", json={"term": "test", "language": "zh"}).json()
    resp = client.put(f"/terms/{created['id']}", json={"definition": "a procedure"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["definition"] == "a procedure"
    assert data["term"] == "test"      # 未传，不变
    assert data["language"] == "zh"    # 未传，不变


def test_update_term_multiple_fields(client):
    created = client.post("/terms", json={"term": "run"}).json()
    resp = client.put(
        f"/terms/{created['id']}",
        json={"term": "sprint", "definition": "run fast"},
    )
    assert resp.json()["term"] == "sprint"
    assert resp.json()["definition"] == "run fast"


def test_update_term_tags_omitted_keeps_tags(client):
    """不传 tags → 保留原有 tags（D08）"""
    created = client.post("/terms", json={"term": "test", "tags": ["GRE"]}).json()
    resp = client.put(f"/terms/{created['id']}", json={"definition": "updated"})
    assert resp.json()["tags"] == ["GRE"]


def test_update_term_tags_null_same_as_omitted(client):
    """{"tags": null} 与不传 tags 语义相同：Pydantic 解析为 None，
    update_term 的 `if data.tags is not None` 分支不触发，原值保留（D08）"""
    created = client.post("/terms", json={"term": "test", "tags": ["GRE"]}).json()
    resp = client.put(f"/terms/{created['id']}", json={"tags": None})
    assert resp.status_code == 200
    assert resp.json()["tags"] == ["GRE"]


def test_update_term_tags_empty_list_clears_tags(client):
    """传 tags=[] → 清空 tags（D08）"""
    created = client.post("/terms", json={"term": "test", "tags": ["GRE"]}).json()
    resp = client.put(f"/terms/{created['id']}", json={"tags": []})
    assert resp.json()["tags"] == []


def test_update_term_tags_replace(client):
    """传新列表 → 替换"""
    created = client.post("/terms", json={"term": "test", "tags": ["GRE"]}).json()
    resp = client.put(f"/terms/{created['id']}", json={"tags": ["vocab", "CS"]})
    assert resp.json()["tags"] == ["vocab", "CS"]


def test_update_term_not_found(client):
    resp = client.put("/terms/9999", json={"definition": "x"})
    assert resp.status_code == 404


# ============================================================
# DELETE /terms/{term_id}
# ============================================================

def test_delete_term(client):
    created = client.post("/terms", json={"term": "temp"}).json()
    resp = client.delete(f"/terms/{created['id']}")
    assert resp.status_code == 200
    assert resp.json() == {"detail": "Term deleted"}


def test_delete_term_removes_it(client):
    """删除后再 GET 应该 404"""
    created = client.post("/terms", json={"term": "temp"}).json()
    client.delete(f"/terms/{created['id']}")
    assert client.get(f"/terms/{created['id']}").status_code == 404


def test_delete_term_not_found(client):
    resp = client.delete("/terms/9999")
    assert resp.status_code == 404


# ============================================================
# GET /health（smoke test）
# ============================================================

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
