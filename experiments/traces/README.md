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
