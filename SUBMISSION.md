# 提交清单（任务书第 3 页对照）

> 组号：**第 12 组**　题目：**题目五 连续内存分配与碎片问题验证**
> 指导教师：吴俊豪
> 打包命名：`12_题目五_陈子俊-黄应辉-蔡旭迪-史一飞-梁赫铭-李志恒_实践项目.zip`

## 一、基本信息（提交前必须补齐）

| 项目 | 内容 |
|---|---|
| 题号 | 题目五：连续内存分配与碎片问题验证 |
| 组号 | 第 12 组 |
| 成员与分工 | 见文末分工表 |
| **演示网址** | `https://________________.pages.dev`（部署后填写） |
| **仓库网址** | https://github.com/MEO-wj/OS_Memory_Allocation |
| **对应 commit SHA** | `________________`（提交时用 `git rev-parse HEAD` 取完整 40 位，须与线上版本一致） |
| 运行方式 | 静态网页，无后端；本地直接打开 `web/index.html` |

## 二、材料对照表

| 任务书要求 | 本仓库位置 | 状态 |
|---|---|---|
| 源码与运行包、依赖说明、本地启动步骤、部署方法 | `web/`、`README.md`、`docs/00` | ✅ 已完成 |
| 小组报告（4–6 页） | `report/report-template.pdf`（正文 7 页） | ✅ 已完成 |
| 三组相同输入在两种策略下的结果，标出差异步骤 | `experiments/inputs/`、`experiments/traces/summary.json` | ✅ 已完成 |
| 碎片导致失败的状态图 | 报告图 1；`experiments/traces/case3-fragmentation-*.jsonl` 第 6 步 | ✅ 已完成 |
| 三种合并的记录 | `case2-merge-all-*.jsonl`、`case2b-merge-left-*.jsonl`、`merge-onoff.json` | ✅ 已完成 |
| 一组完整人工推演 | `experiments/hand-simulation/case3-人工推演.md` | ✅ 已完成 |
| 基本约束与非法输入检查结果 | `experiments/traces/illegal-ops.json`、`buggy-version.txt` | ✅ 已完成 |
| 对大模型推荐序列与判断的核验 | `model-interactions/`（4 段） | ⚠️ 模板已建，**需填真实问答原文** |
| 模型交互记录 3–5 段 | `model-interactions/` | ⚠️ 同上 |
| 每人个人分析（半页–一页） | `individual/个人分析-*.md`（6 份） | ⚠️ 骨架已建，**需本人补写** |
| 实验记录（案例编号/输入/假设/核对/结论） | `experiments/hypotheses/`（6 份）、各 `*.md` | ✅ 已完成 |

## 三、可复现命令

```bash
# 1. 生成全部轨迹与对照数据（需要 Node.js）
node tools/gen-traces.js
node tools/probe-criterion.js          # 判据探针（A1）
node tools/buggy-demo.js               # 错误版本对照（D1）
node tools/search-counterexample.js 20261127 16   # 反例搜索（B2，固定种子）

# 2. 编译报告（需要 XeLaTeX）
cd report && make

# 3. 本地查看演示
open web/index.html
```

全部脚本只依赖 Node.js 标准库；网页无任何第三方依赖。

## 四、待人工完成的三件事

1. **填模型问答原文**：`model-interactions/` 下 4 个文件中的"模型的关键回答"段落需要粘贴真实对话，
   并补写第 4–6 节（采纳/拒绝、核验结果、局限）。没有真实问答的材料不能作为证据。
2. **写个人分析**：`individual/` 下 6 份，重点是第三节"认识变化"要写自己的判断，不能照抄报告。
3. **部署并回填 SHA**：把 `web/` 部署到 Cloudflare Pages，把演示网址与 `git rev-parse HEAD` 填到本文第一节与报告封面。

## 五、分工表

| 成员 | 学号 | 假设 | 主要职责 |
|---|---|---|---|
| 陈子俊（组长） | 2024612033 | A1 | 内存模型与约定、报告整合 |
| 黄应辉 | 2024611031 | A2 | 首次适应实现、两策略失败比对 |
| 蔡旭迪 | 2024612028 | B2 | 最佳适应实现、同长规则、反例搜索 |
| 史一飞 | 2024612031 | C1 | 释放与合并实现、合并开/关对照 |
| 梁赫铭 | 2024612036 | B5 | 演示页面、三组输入、分歧步对照 |
| 李志恒 | 2024612066 | D1 | 三项检查、非法输入测试、错误版本对照 |
