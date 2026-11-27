# experiments/traces — 程序原始输出

存放程序运行产生的逐步轨迹（建议一行一步的 JSONL，UTF-8，可机读）。

## 命名约定

`<案例id>-<策略>.jsonl`，例如 `case3-fragmentation-ff.jsonl`、`case3-fragmentation-bf.jsonl`。

## 每行字段（建议）

```json
{"step":6,"op":"alloc","id":"D","size":50,"result":"fail",
 "reason":"总量60足够但最大空闲块30<50","ff_selected":null,
 "free_blocks":[{"start":0,"len":30},{"start":60,"len":30}],
 "allocs":{"B":{"start":30,"len":30}},
 "metrics":{"free_total":60,"free_max":30,"free_count":2}}
```

- 布局必须带地址区间；
- 两策略结果不同的步骤标记 `"diff":true`（★差异步），报告与 trace 要能对应；
- 每条 trace 末尾附一次约束检查结果：不重叠 / 守恒 / 无相邻空闲块。

## 实际产物（由 `node tools/gen-traces.js` 生成）

| 文件 | 内容 |
|------|------|
| `case1-divergence-{ff,bf}.jsonl` | 案例 1 两策略逐步轨迹（差异步 5、6、7） |
| `case2-merge-all-{ff,bf}.jsonl` | 案例 2 三种合并 + 非法释放（第 11 步报错） |
| `case2b-merge-left-{ff,bf}.jsonl` | 案例 2b 仅左合并专项 |
| `case3-fragmentation-{ff,bf}.jsonl` | 案例 3 碎片失败（第 6 步失败） |
| `case4-b2-counterexample-{ff,bf}.jsonl` | 案例 4 反例（FF 失败 1 次、BF 2 次） |
| `case4-b2-counterexample.txt` | 反例搜索过程与两策略逐步对照 |
| `summary.json` | 各案例两策略汇总、失败步、差异步明细、期末检查 |
| `illegal-ops.json` | 七项非法操作测试（全部报错且状态不变） |
| `merge-onoff.json` | 合并开/关对照（案例 3 第 9 步：1 块 vs 4 块） |
| `buggy-version.txt` | 错误版本（失败也切块）对照，第 6 步守恒报错 |
| `criterion-probes.json` | 判据探针五组（A1 的直接证据） |

重新生成：`node tools/gen-traces.js && node tools/probe-criterion.js && node tools/buggy-demo.js`
