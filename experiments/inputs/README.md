# experiments/inputs — 实验输入

存放操作序列 JSON 文件，格式约定见 `docs/02-实验设计与序列草案.md` 第一节。

## 计划文件清单

| 文件 | 内容 | 对应文档 |
|------|------|----------|
| `case1-divergence.json` | 基础行为 + FF/BF 分歧（TOTAL=100，7 步） | docs/02 案例 1 |
| `case2-merge-all.json` | 三种合并 + 非法释放（TOTAL=100，12 步） | docs/02 案例 2 |
| `case2b-merge-left.json` | 仅左侧合并专项（TOTAL=100，8 步） | docs/02 案例 2 附例 |
| `case3-fragmentation.json` | 外部碎片导致失败（TOTAL=90，9 步） | docs/02 案例 3 |
| `case4-b2-counterexample.json` | B2 反例：BF 失败次数多于 FF（TOTAL=100，8 步，种子 20261127） | 由 `tools/search-counterexample.js` 生成 |

## 硬性要求

- 两策略必须从相同初始状态运行**完全相同**的操作序列；
- 每组序列 ≤ 20 步；申请使用唯一编号；
- 序列一旦定稿**不要修改**（修改需记录版本，否则 trace 与报告无法对应）。
