"""Build the browser-readable question bank from the repaired Excel files.

Usage:
  python tools/build_practice_bank.py <xlsx> [<xlsx> ...]
  python tools/build_practice_bank.py --bootstrap-registry

The source workbooks are read only.  Re-run this script after adding the
repaired Java workbook so the static site receives all question banks.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "interview-bootstrap" / "src" / "main" / "resources" / "static" / "practice-bank.js"
REGISTRY = ROOT / "tools" / "question-id-registry.json"
MANUAL_QUESTIONS = ROOT / "tools" / "manual-practice-questions.json"
HEADERS = [
    "序号", "题型", "题目标题", "题目内容",
    "选项A", "选项B", "选项C", "选项D",
    "选项E", "选项F", "选项G", "选项H",
    "答案", "题目解析",
]
SOURCE_NAMES = {
    "后端开发": "后端开发",
    "数据库": "数据库",
    "Java": "Java",
    # 这份补漏题按 408 四门课程归档，不在网站上展示原文件中的机构名称。
    "科大讯飞笔试补漏选择题_40道": "408",
}
COURSE_KEYS = {
    "后端开发": "backend",
    "数据库": "database",
    "Java": "java",
    "408": "408",
}
CATEGORY_NAMES = {
    # 源表为了笼统命名使用“计算机基础”，网站按 408 标准课程名称展示。
    ("408", "计算机基础"): "计算机组成原理",
}


def clean(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() == "none" else text


def source_name(path: Path) -> str:
    stem = path.stem.replace("_修复版", "").replace("修复版", "").strip("_ -")
    return SOURCE_NAMES.get(stem, stem)


def safe_part(value: str) -> str:
    latin = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if latin:
        return latin
    # Chinese sheet names are valid names too. Keep a deterministic Unicode
    # representation so different Chinese categories never collapse to "bank".
    return "u" + "-".join(f"{ord(char):x}" for char in value)


def parse_answer_keys(answer: str) -> list[str]:
    normalized = answer.upper().strip()
    if not re.fullmatch(r"[A-H](?:[、,，/\\\s]*[A-H])*", normalized):
        return []
    return re.findall(r"[A-H]", normalized)


def registry_key(source: str, category: str, number: str) -> str:
    """The permanent business key for a question imported from a workbook."""
    return f"excel|{source}|{category}|{number}"


def read_registry() -> dict:
    if not REGISTRY.exists():
        raise SystemExit(
            "题目 ID 台账不存在。请先执行：python tools/build_practice_bank.py --bootstrap-registry"
        )
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if not isinstance(registry.get("ids"), dict):
        raise ValueError(f"{REGISTRY} 格式错误：缺少 ids 对照表")
    return registry


def save_registry(registry: dict) -> None:
    REGISTRY.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def reserve_id(registry: dict, key: str, suggested: str) -> str:
    """Reuse an old ID whenever possible; allocate a new one only once."""
    existing = registry["ids"].get(key)
    if existing:
        return existing

    used_ids = set(registry["ids"].values())
    candidate = suggested
    suffix = 2
    while candidate in used_ids:
        candidate = f"{suggested}-{suffix}"
        suffix += 1
    registry["ids"][key] = candidate
    return candidate


def read_existing_bank() -> dict:
    if not OUTPUT.exists():
        raise SystemExit(f"找不到现有题库：{OUTPUT}")
    raw = OUTPUT.read_text(encoding="utf-8")
    start = raw.find("window.PRACTICE_BANK")
    if start < 0:
        raise ValueError(f"{OUTPUT} 中没有 PRACTICE_BANK")
    payload = re.sub(r"^\s*window\.PRACTICE_BANK\s*=\s*", "", raw[start:])
    return json.loads(payload.rstrip().removesuffix(";"))


def bootstrap_registry() -> None:
    """Freeze all IDs already published in the current question bank."""
    bank = read_existing_bank()
    registry = {"version": 1, "ids": {}}
    for question in bank.get("questions", []):
        key = registry_key(question["source"], question["category"], str(question["number"]))
        if key in registry["ids"] and registry["ids"][key] != question["id"]:
            raise ValueError(f"无法冻结 ID：题目业务键重复 {key}")
        registry["ids"][key] = question["id"]
    save_registry(registry)
    print(f"已冻结 {len(registry['ids'])} 个题目 ID 到 {REGISTRY}。")


def read_workbook(path: Path, registry: dict) -> tuple[dict, list[dict]]:
    source = source_name(path)
    source_key = COURSE_KEYS.get(source, safe_part(source))
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    categories: list[dict] = []
    questions: list[dict] = []

    for sheet in workbook.worksheets:
        rows = sheet.iter_rows(values_only=True)
        header = [clean(value) for value in (next(rows, None) or [])]
        index = {name: position for position, name in enumerate(header)}
        missing = [name for name in HEADERS if name not in index]
        if missing:
            raise ValueError(f"{path.name} / {sheet.title} 缺少列：{', '.join(missing)}")

        category = CATEGORY_NAMES.get((source, clean(sheet.title)), clean(sheet.title))
        category_key = safe_part(category)
        count = 0
        for row in rows:
            if not any(value is not None and clean(value) for value in row):
                continue

            def cell(name: str) -> str:
                position = index[name]
                return clean(row[position]) if position < len(row) else ""

            original_number = cell("序号")
            count += 1
            question_type = cell("题型") or "未知题型"
            title = cell("题目标题")
            content = cell("题目内容") or title
            options = {
                letter: cell(f"选项{letter}")
                for letter in "ABCDEFGH"
                if cell(f"选项{letter}")
            }
            answer = cell("答案")
            answer_keys = parse_answer_keys(answer)
            question_number = original_number or str(count)
            question_id = reserve_id(
                registry,
                registry_key(source, category, question_number),
                f"{source_key}-{category_key}-n-{safe_part(question_number)}",
            )
            questions.append({
                "id": question_id,
                "source": source,
                "category": category,
                "number": question_number,
                "order": count,
                "type": question_type,
                "title": title or content,
                "content": content,
                "options": options,
                "answer": answer,
                "answerKeys": answer_keys,
                "analysis": cell("题目解析"),
            })
        categories.append({"name": category, "count": count})

    return {"name": source, "key": source_key, "categories": categories}, questions


def read_manual_questions(registry: dict, courses: list[dict], questions: list[dict]) -> None:
    """Merge hand-added questions that do not originate from an Excel workbook."""
    if not MANUAL_QUESTIONS.exists():
        return
    payload = json.loads(MANUAL_QUESTIONS.read_text(encoding="utf-8"))
    for item in payload.get("questions", []):
        manual_key = clean(item.get("key"))
        source = clean(item.get("source"))
        category = clean(item.get("category"))
        if not manual_key or not source or not category:
            raise ValueError("手工题必须包含 key、source 和 category")
        question_id = reserve_id(registry, f"manual|{manual_key}", f"manual-{safe_part(manual_key)}-v1")
        course = next((course for course in courses if course["name"] == source), None)
        if course is None:
            course = {"name": source, "key": COURSE_KEYS.get(source, safe_part(source)), "categories": []}
            courses.append(course)
        category_info = next((entry for entry in course["categories"] if entry["name"] == category), None)
        if category_info is None:
            category_info = {"name": category, "count": 0}
            course["categories"].append(category_info)
        siblings = [question for question in questions if question["source"] == source and question["category"] == category]
        order = max((int(question["order"]) for question in siblings), default=0) + 1
        question_number = clean(item.get("number")) or str(order)
        answer = clean(item.get("answer"))
        questions.append({
            "id": question_id,
            "source": source,
            "category": category,
            "number": question_number,
            "order": order,
            "type": clean(item.get("type")) or "算法题",
            "title": clean(item.get("title")) or clean(item.get("content")),
            "content": clean(item.get("content")),
            "options": item.get("options") or {},
            "answer": answer,
            "answerKeys": parse_answer_keys(answer),
            "analysis": clean(item.get("analysis")),
        })
        category_info["count"] += 1


def main() -> None:
    if sys.argv[1:] == ["--bootstrap-registry"]:
        bootstrap_registry()
        return
    if len(sys.argv) < 2:
        raise SystemExit("请传入至少一个修复后的 xlsx 文件")

    registry = read_registry()
    courses: list[dict] = []
    questions: list[dict] = []
    for argument in sys.argv[1:]:
        course, course_questions = read_workbook(Path(argument), registry)
        courses.append(course)
        questions.extend(course_questions)

    read_manual_questions(registry, courses, questions)
    save_registry(registry)

    bank = {
        "version": "2026-08-24",
        "courses": courses,
        "questions": questions,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # 固定使用 LF，避免在 Windows 生成的单行数据文件被 Git 误判为整行变更。
    OUTPUT.write_bytes(
        (
            "// 由 tools/build_practice_bank.py 从修复版 Excel 自动生成，请勿手动编辑。\n"
            "window.PRACTICE_BANK = "
            + json.dumps(bank, ensure_ascii=False, separators=(",", ":"))
            + ";\n"
        ).encode("utf-8")
    )
    print(f"已生成 {OUTPUT}，共 {len(questions)} 题。")


if __name__ == "__main__":
    main()
