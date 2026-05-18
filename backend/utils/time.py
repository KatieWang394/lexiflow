"""
时间工具模块
============
统一提供 UTC 时间。后端所有需要"当前时间"的地方都调用 utc_now()，
不要直接使用 datetime.now() 或 datetime.utcnow()。
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """返回当前 UTC 时间（带时区信息）"""
    return datetime.now(timezone.utc)
