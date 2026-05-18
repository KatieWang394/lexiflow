"""
标签转换工具
============
API 层使用 list[str]，数据库层使用逗号分隔字符串。
所有转换逻辑集中在这里，crud.py 调用这些函数，routers 不直接做转换。
"""


def tags_to_string(tags: list[str]) -> str:
    """
    将标签列表转为逗号分隔的字符串，用于数据库存储。
    自动去除每个标签的首尾空白，并过滤掉空字符串。
    逗号是字段分隔符，tag 本身不允许包含逗号。

    示例：["GRE", " CS ", ""] → "GRE,CS"
    """
    cleaned = []
    for tag in tags:
        tag = tag.strip()
        if not tag:
            continue
        if "," in tag:
            raise ValueError(f"tag '{tag}' must not contain a comma")
        cleaned.append(tag)
    return ",".join(cleaned)


def string_to_tags(tags: str | None) -> list[str]:
    """
    将数据库中的逗号分隔字符串转为标签列表，用于 API 返回。
    处理 None 和空字符串的情况。

    示例："GRE,CS,academic" → ["GRE", "CS", "academic"]
    示例："" → []
    示例：None → []
    """
    if not tags:
        return []
    return [tag.strip() for tag in tags.split(",") if tag.strip()]
