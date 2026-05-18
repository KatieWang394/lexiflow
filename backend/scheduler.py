"""
复习调度模块
============
纯函数模块：只做计算，不访问数据库，不导入 FastAPI。
这样调度算法可以独立测试，未来升级到 SM-2 只需改这里。

v0.1 简单映射（不是完整 SM-2）：
  forgot = 1 天后复习
  hard   = 3 天后复习
  good   = 7 天后复习
  easy   = 14 天后复习

ease_factor 在 v0.1 保持不变（固定 2.5）。
"""

from datetime import datetime, timedelta

from backend.schemas import ReviewRating, ReviewScheduleResult, TermStatus
from backend.utils.time import utc_now

# v0.1 固定间隔映射
_INTERVAL_DAYS: dict[ReviewRating, int] = {
    "forgot": 1,
    "hard": 3,
    "good": 7,
    "easy": 14,
}


def calculate_next_review(
    rating: ReviewRating,
    current_interval_days: int,
    ease_factor: float,
    repetitions: int,
    now: datetime | None = None,
) -> ReviewScheduleResult:
    """
    根据本次评分计算下次复习时间和状态。

    参数说明：
      rating               - 用户对本次复习的评分
      current_interval_days - 当前间隔天数（v0.1 不使用，但保留供 SM-2 升级）
      ease_factor          - 当前难度系数（v0.1 不修改）
      repetitions          - 当前连续成功复习次数
      now                  - 可注入的"当前时间"，方便测试；None 则取真实 UTC 时间

    返回 ReviewScheduleResult，由 crud.py 写入数据库。
    """
    now = now or utc_now()

    interval_days = _INTERVAL_DAYS[rating]
    next_review_at = now + timedelta(days=interval_days)

    # 状态转换规则（D14 / D15）
    new_status: TermStatus
    new_repetitions: int

    if rating == "forgot":
        # 忘记了：重置回 learning，重置连续次数
        new_status = "learning"
        new_repetitions = 0
    elif rating == "hard":
        # 困难：保持 learning，次数+1
        new_status = "learning"
        new_repetitions = repetitions + 1
    elif rating == "good":
        # 良好：连续 ≥ 3 次升为 mastered，否则继续 learning
        new_repetitions = repetitions + 1
        new_status = "mastered" if repetitions >= 3 else "learning"
    else:  # "easy"
        # 简单：连续 ≥ 2 次升为 mastered，否则继续 learning
        new_repetitions = repetitions + 1
        new_status = "mastered" if repetitions >= 2 else "learning"

    return ReviewScheduleResult(
        next_review_at=next_review_at,
        interval_days=interval_days,
        ease_factor=ease_factor,  # v0.1 不修改 ease_factor
        repetitions=new_repetitions,
        status=new_status,
    )
