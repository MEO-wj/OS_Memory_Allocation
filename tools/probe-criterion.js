#!/usr/bin/env node
/**
 * probe-criterion.js — 假设 A1 的判据探针
 *
 * 目的：说明"能不能分出去"取决于**最大空闲块**，而不是空闲总量。
 * 做法：构造若干内存状态，逐个申请，记录 总量 / 最大块 / 申请量 / 结果。
 *
 * 输出：experiments/traces/criterion-probes.json
 * 用法：node tools/probe-criterion.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../web/core.js');
const St = require('../web/strategy.js');

const ROOT = path.join(__dirname, '..');
const pick = St.get('ff').pick;

/** 用一串前置操作构造状态，然后发起一次申请 */
function probe(desc, total, setup, id, size) {
  const mem = new Core.Memory(total);
  setup.forEach((op) => mem.apply(op, pick));
  const before = mem.metrics();
  const r = mem.alloc(id, size, pick);
  return {
    desc,
    total_memory: total,
    free_total_before: before.freeTotal,
    free_max_before: before.freeMax,
    free_count_before: before.freeCount,
    request_size: size,
    result: r.ok ? 'ok' : 'fail',
    reason: r.reason,
    start: r.start,
    expectation: (before.freeMax >= size) ? '成功' : '失败',
    consistent: (before.freeMax >= size) === !!r.ok
  };
}

const a = (id, size) => ({ op: 'alloc', id, size });
const f = (id) => ({ op: 'free', id });

const probes = [
  // ① 案例 3 第 6 步的状态：总量 60，但最大块只有 30 → 申请 50 失败
  probe('总量 60、最大块 30，申请 50', 90,
    [a('A', 30), a('B', 30), a('C', 30), f('A'), f('C')], 'D', 50),
  // ② 总量同样 60，但连成一块 → 申请 50 成功
  probe('总量 60、最大块 60，申请 50', 90,
    [a('A', 30)], 'D', 50),
  // ③ 总量 50、最大块 25、申请 30 → 失败（总量 50 ≥ 30，但两块都不够连续）
  probe('总量 50、最大块 25，申请 30', 100,
    [a('A', 25), a('X', 10), a('B', 25), a('Y', 5), a('C', 20), a('Z', 10),
     f('A'), f('C')], 'D', 30),
  // ④ 总量恰好等于申请量 → 成功（最大块 = 申请量）
  probe('总量 40 = 申请 40，最大块 40', 100,
    [a('A', 60)], 'Z', 40),
  // ⑤ 最大块比申请量大 1 → 成功，且剩余 1
  probe('总量 41、最大块 41，申请 40', 100,
    [a('A', 59)], 'Z', 40)
];
const ok = probes.every((p) => p.consistent);
const out = { note: '判据探针：申请能否成功取决于最大空闲块，与空闲总量无关', allConsistent: ok, probes };
fs.writeFileSync(path.join(ROOT, 'experiments', 'traces', 'criterion-probes.json'),
  JSON.stringify(out, null, 2) + '\n');

probes.forEach((p) => {
  console.log(
    `${p.desc.padEnd(28)} 总量=${String(p.free_total_before).padStart(3)}` +
    ` 最大块=${String(p.free_max_before).padStart(3)} 申请=${String(p.request_size).padStart(3)}` +
    ` → ${p.result === 'ok' ? '成功' : '失败'}（预期${p.expectation}，${p.consistent ? '相符' : '不符'}）`
  );
});
console.log('\n判据一致性：' + (ok ? '全部相符' : '存在不符，需检查实现'));
