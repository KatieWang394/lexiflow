"""
调度器单元测试
==============
测试 scheduler.py 中 calculate_next_review() 的所有评分 × 状态转换路径。

使用固定的 `now` 参数，确保时间断言不依赖真实时钟（D13）。
"""

from datetime import datetime, timedelta, timezone

import pytest

from backend.scheduler import calculate_next_review
from backend.utils.time import utc_now

# 固定基准时间，让所有断言确定性
FIXED_NOW = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


# ============================================================
# 辅助函数
# ============================================================

def run(rating, repetitions=0, ease_factor=2.5, current_interval_days=0):
    """简化调用，注入固定时间"""
    return calculate_next_review(
        rating=rating,
        current_interval_days=current_interval_days,
        ease_factor=ease_factor,
        repetitions=repetitions,
        now=FIXED_NOW,
    )


# ============================================================
# 间隔天数测试
# ============================================================

def test_forgot_interval():
    result = run("forgot")
    assert result.interval_days == 1
    assert result.next_review_at == FIXED_NOW + timedelta(days=1)


def test_hard_interval():
    result = run("hard")
    assert result.interval_days == 3
    assert result.next_review_at == FIXED_NOW + timedelta(days=3)


def test_good_interval():
    result = run("good")
    assert result.interval_days == 7
    assert result.next_review_at == FIXED_NOW + timedelta(days=7)


def test_easy_interval():
    result = run("easy")
    assert result.interval_days == 14
    assert result.next_review_at == FIXED_NOW + timedelta(days=14)


# ============================================================
# ease_factor 不变（v0.1）
# ============================================================

@pytest.mark.parametrize("rating", ["forgot", "hard", "good", "easy"])
def test_ease_factor_unchanged(rating):
    result = run(rating, ease_factor=2.5)
    assert result.ease_factor == 2.5


def test_ease_factor_preserved_when_nondefault():
    # 哪怕传入非默认值，v0.1 也原样返回
    result = run("good", ease_factor=1.8)
    assert result.ease_factor == 1.8


# ============================================================
# forgot：状态转换 + repetitions 重置
# ============================================================

def test_forgot_status_is_learning():
    result = run("forgot", repetitions=0)
    assert result.status == "learning"


def test_forgot_resets_repetitions():
    # 无论之前多少次，forgot 后重置为 0
    result = run("forgot", repetitions=5)
    assert result.repetitions == 0


# ============================================================
# hard：保持 learning，repetitions+1
# ============================================================

def test_hard_status_is_learning():
    result = run("hard", repetitions=0)
    assert result.status == "learning"


def test_hard_increments_repetitions():
    result = run("hard", repetitions=2)
    assert result.repetitions == 3


# ============================================================
# good：阈值测试（repetitions >= 3 → mastered）
# ============================================================

def test_good_below_threshold_is_learning():
    # rep=0,1,2 都不够
    for rep in range(3):
        result = run("good", repetitions=rep)
        assert result.status == "learning", f"repetitions={rep} should be learning"


def test_good_at_threshold_is_mastered():
    result = run("good", repetitions=3)
    assert result.status == "mastered"


def test_good_above_threshold_is_mastered():
    result = run("good", repetitions=10)
    assert result.status == "mastered"


def test_good_increments_repetitions():
    result = run("good", repetitions=2)
    assert result.repetitions == 3


# ============================================================
# easy：阈值测试（repetitions >= 2 → mastered）
# ============================================================

def test_easy_below_threshold_is_learning():
    for rep in range(2):
        result = run("easy", repetitions=rep)
        assert result.status == "learning", f"repetitions={rep} should be learning"


def test_easy_at_threshold_is_mastered():
    result = run("easy", repetitions=2)
    assert result.status == "mastered"


def test_easy_above_threshold_is_mastered():
    result = run("easy", repetitions=8)
    assert result.status == "mastered"


def test_easy_increments_repetitions():
    result = run("easy", repetitions=1)
    assert result.repetitions == 2


# ============================================================
# now 参数：默认不传时使用真实时钟（smoke test）
# ============================================================

def test_no_now_uses_real_clock():
    before = utc_now()
    result = calculate_next_review(
        rating="good",
        current_interval_days=0,
        ease_factor=2.5,
        repetitions=0,
        now=None,
    )
    after = utc_now()
    # next_review_at 应该在 now+7d 附近
    expected_low = before + timedelta(days=7)
    expected_high = after + timedelta(days=7)
    assert expected_low <= result.next_review_at <= expected_high


# ============================================================
# current_interval_days 在 v0.1 不影响结果（保留接口兼容性）
# ============================================================

def test_current_interval_days_has_no_effect_in_v01():
    result_zero = run("good", repetitions=0, current_interval_days=0)
    result_big = run("good", repetitions=0, current_interval_days=999)
    assert result_zero.interval_days == result_big.interval_days
    assert result_zero.next_review_at == result_big.next_review_at
