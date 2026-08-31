# 题目身份证台账

`question-id-registry.json` 保存已经发布题目的永久 `questionId`。重新导入 Excel 时，生成脚本会先查这份台账，因此调整行顺序不会改变旧题的 ID。

`manual-practice-questions.json` 用于登记不来自 Excel 的零散题。每道手工题都需要填写唯一的 `key`；脚本会为它分配一次永久 ID，并保存到台账中。

不要手动修改已发布题目的 ID。需要更正题面、答案或解析时，保留同一条台账记录即可。
