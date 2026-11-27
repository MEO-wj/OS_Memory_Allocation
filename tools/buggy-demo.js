#!/usr/bin/env node
/**
 * buggy-demo.js — 假设 D1 的反例实验
 *
 * 故意实现一个错误版本：申请失败时"也切块"（把申请量从最大空闲块里挖掉）。
 * 用它跑案例 3，观察三项检查中的"守恒"是否立即报警。
 *
 * 输出：experiments/traces/buggy-version.txt
 * 用法：node tools/buggy-demo.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const Core = require('../web/core.js');
const St = require('../web/strategy.js');

const ROOT = path.join(__dirname, '..');
const caseData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'experiments', 'inputs', 'case3-fragmentation.json'), 'utf8')
);

/** 正确版本：失败直接返回，不改状态 */
function runCorrect(total, ops, pick) {
  const mem = new Core.Memory(total);
  const rows = [];
  ops.forEach((op, i) => {
    const r = mem.apply(op, pick);
    const c = mem.checks();
    rows.push({ step: i + 1, op: op, result: r, checks: c, metrics: mem.metrics() });
  });
  return rows;
}

/** 错误版本：失败时把申请量从最大空闲块里挖掉（模拟"失败也切块"的实现缺陷） */
function runBuggy(total, ops, pick) {
  const mem = new Core.Memory(total);
  const rows = [];
  ops.forEach((op, i) => {
    let r;
    if (op.op === 'alloc') {
      r = mem.alloc(op.id, op.size, pick);
      if (!r.ok && r.code === 'nofit') {
        // 缺陷：认为"反正要占地方"，直接把最大空闲块挖掉 size，但不登记已分配区
        let bi = 0;
        for (let k = 0; k < mem.freeList.length; k++) {
          if (mem.freeList[k].len > mem.freeList[bi].len) bi = k;
        }
        const blk = mem.freeList[bi];
        blk.start += op.size;
        blk.len -= op.size;
        if (blk.len <= 0) mem.freeList.splice(bi, 1);
      }
    } else {
      r = mem.free(op.id);
    }
    const c = mem.checks();
    rows.push({ step: i + 1, op: op, result: r, checks: c, metrics: mem.metrics() });
  });
  return rows;
}

function fmt(rows) {
  const out = [];
  out.push('步  操作              结果      空闲总量  最大块  块数  不重叠  守恒  合并完整');
  rows.forEach((row) => {
    const op = row.op.op === 'alloc' ? `alloc ${row.op.id} ${row.op.size}` : `free ${row.op.id}`;
    const res = row.result.ok ? (row.op.op === 'alloc' ? `成功@${row.result.start}` : '成功') : '失败';
    const c = row.checks;
    out.push(
      String(row.step).padEnd(3) + ' ' + op.padEnd(17) + ' ' + res.padEnd(9) +
      String(row.metrics.freeTotal).padStart(8) +
      String(row.metrics.freeMax).padStart(8) +
      String(row.metrics.freeCount).padStart(6) +
      (c.noOverlap ? '     ✓' : '     ✗') +
      (c.conservation ? '      ✓' : '      ✗') +
      (c.merged ? '        ✓' : '        ✗')
    );
  });
  return out.join('\n');
}

const pick = St.get('ff').pick;
const correct = runCorrect(caseData.total_memory, caseData.ops, pick);
const buggy = runBuggy(caseData.total_memory, caseData.ops, pick);

const report = [
  '假设 D1 反例实验：失败申请若也切块，会破坏守恒式',
  '案例：' + caseData.case_id + '（总内存 ' + caseData.total_memory + '，' + caseData.ops.length + ' 步）',
  '策略：首次适应',
  '生成时间：' + new Date().toISOString(),
  '',
  '—— 正确版本 ——',
  fmt(correct),
  '',
  '—— 错误版本（失败申请也切块） ——',
  fmt(buggy),
  '',
  '—— 结论 ——'
];

const correctOk = correct.every((r) => r.checks.ok);
const firstBad = buggy.findIndex((r) => !r.checks.ok);
if (correctOk) {
  report.push('正确版本：每一步三项检查均通过，守恒式始终成立。');
} else {
  report.push('正确版本出现异常，需检查实现。');
}
if (firstBad >= 0) {
  report.push(
    '错误版本：第 ' + buggy[firstBad].step + ' 步（' + buggy[firstBad].op.op + ' ' +
    buggy[firstBad].op.id + '）后守恒检查即报错——' + buggy[firstBad].checks.messages.join('；')
  );
  report.push('说明：失败申请一旦改动状态，守恒式立即被破坏，后续指标全部失真。D1 成立。');
} else {
  report.push('错误版本未被检查发现，说明检查项有遗漏，D1 不成立。');
}

fs.writeFileSync(path.join(ROOT, 'experiments', 'traces', 'buggy-version.txt'),
  report.join('\n') + '\n');

console.log(report.join('\n'));
