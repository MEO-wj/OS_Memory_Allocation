#!/usr/bin/env node
/**
 * search-counterexample.js — 假设 B2 的反例搜索
 *
 * 目标：找一条申请释放序列，使"最佳适应"的失败次数**多于**首次适应，
 *       从而推翻"最佳适应在所有负载下整体优于首次适应"。
 *
 * 做法：固定随机种子，随机生成序列（总内存 100，只做 alloc/free），
 *       两策略各跑一遍，记录第一个满足 BF.failCount > FF.failCount 的序列。
 *
 * 输出：experiments/inputs/case4-b2-counterexample.json 与 experiments/traces/ 对照
 * 用法：node tools/search-counterexample.js [seed] [maxOps]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../web/core.js');
const St = require('../web/strategy.js');

const ROOT = path.join(__dirname, '..');
const SEED = Number(process.argv[2] || 20261127);
const MAX_OPS = Number(process.argv[3] || 14);

/** 确定性伪随机（mulberry32），保证结果可复现 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runSeq(total, ops, key) {
  const pick = St.get(key).pick;
  const mem = new Core.Memory(total);
  let allocFails = 0, invalidFrees = 0;
  const rows = [];
  ops.forEach((op) => {
    const before = mem.metrics();
    const r = mem.apply(op, pick);
    if (!r.ok && op.op === 'alloc') allocFails++;
    if (!r.ok && op.op === 'free') invalidFrees++;   // 释放了不存在的编号
    rows.push({
      op, ok: r.ok, reason: r.reason, start: r.start,
      freeTotalBefore: before.freeTotal, freeMaxBefore: before.freeMax,
      free: mem.snapshot().free
    });
  });
  return {
    allocFails, invalidFrees, rows,
    finalFreeCount: mem.freeList.length, finalFreeMax: mem.metrics().freeMax
  };
}

function main() {
  const TOTAL = 100;
  const rnd = mulberry32(SEED);
  const SIZES = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  let found = null;
  let tried = 0;

  for (let attempt = 0; attempt < 200000 && !found; attempt++) {
    tried++;
    const ops = [];
    const live = [];
    let next = 0;
    const n = 6 + Math.floor(rnd() * (MAX_OPS - 6 + 1));
    for (let i = 0; i < n; i++) {
      const doAlloc = live.length === 0 || rnd() < 0.62;
      if (doAlloc) {
        const id = String.fromCharCode(65 + (next++ % 26));
        const size = SIZES[Math.floor(rnd() * SIZES.length)];
        ops.push({ op: 'alloc', id, size });
        live.push(id);
      } else {
        const idx = Math.floor(rnd() * live.length);
        ops.push({ op: 'free', id: live[idx] });
        live.splice(idx, 1);
      }
    }
    const ff = runSeq(TOTAL, ops, 'ff');
    const bf = runSeq(TOTAL, ops, 'bf');
    // 要求：两侧的释放都合法（不出现"释放不存在的编号"），只比较申请失败数
    if (bf.invalidFrees === 0 && ff.invalidFrees === 0 && bf.allocFails > ff.allocFails) {
      found = { total: TOTAL, ops, ff, bf };
    }
  }

  if (!found) {
    console.log(`未找到反例（尝试 ${tried} 条，seed=${SEED}）。可增大 maxOps 或换 seed。`);
    return;
  }

  // 写输入文件
  const inputFile = path.join(ROOT, 'experiments', 'inputs', 'case4-b2-counterexample.json');
  fs.writeFileSync(inputFile, JSON.stringify({
    case_id: 'case4-b2-counterexample',
    total_memory: found.total,
    note: `假设 B2 反例：最佳适应申请失败 ${found.bf.allocFails} 次，首次适应 ${found.ff.allocFails} 次（随机种子 ${SEED}）`,
    seed: SEED,
    ops: found.ops
  }, null, 2) + '\n');

  // 写对照记录
  const lines = [];
  lines.push(`假设 B2 反例搜索（种子 ${SEED}，共尝试 ${tried} 条序列）`);
  lines.push(`总内存 ${found.total}，${found.ops.length} 步`);
  lines.push('');
  lines.push('步  操作               FF 结果            BF 结果');
  found.ops.forEach((op, i) => {
    const f = found.ff.rows[i], b = found.bf.rows[i];
    const label = op.op === 'alloc' ? `alloc ${op.id} ${op.size}` : `free ${op.id}`;
    const fmtR = (r) => (r.ok ? (r.start === undefined ? '成功' : `成功@${r.start}`) : '失败');
    lines.push(
      String(i + 1).padEnd(3) + label.padEnd(17) + fmtR(f).padEnd(17) + fmtR(b)
    );
  });
  lines.push('');
  lines.push(`申请失败次数：FF = ${found.ff.allocFails}，BF = ${found.bf.allocFails}`);
  lines.push(`期末空闲块数：FF = ${found.ff.finalFreeCount}，BF = ${found.bf.finalFreeCount}`);
  lines.push(`期末最大空闲块：FF = ${found.ff.finalFreeMax}，BF = ${found.bf.finalFreeMax}`);
  lines.push('');
  lines.push('结论：BF 的申请失败次数多于 FF，且两侧释放都合法，');
  lines.push('故"最佳适应在所有负载下整体优于首次适应"被推翻（B2 不成立）。');

  fs.writeFileSync(path.join(ROOT, 'experiments', 'traces', 'case4-b2-counterexample.txt'),
    lines.join('\n') + '\n');

  console.log(lines.join('\n'));
}

main();
