#!/usr/bin/env node
/**
 * gen-traces.js — 用 web/ 同一套算法批量生成实验轨迹与对照数据
 *
 * 输出：
 *   experiments/traces/<case>-<ff|bf>.jsonl     逐步轨迹（JSONL，一行一步）
 *   experiments/traces/summary.json             各案例两策略汇总与差异步
 *   experiments/traces/illegal-ops.json         非法操作测试记录
 *   experiments/traces/merge-onoff.json         合并开/关对照（假设 C1）
 *
 * 用法：node tools/gen-traces.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const Core = require('../web/core.js');
const St = require('../web/strategy.js');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'experiments', 'inputs');
const TRACE_DIR = path.join(ROOT, 'experiments', 'traces');

function layoutText(snap) {
  const segs = [];
  Object.keys(snap.allocs).forEach((id) => {
    const a = snap.allocs[id];
    segs.push({ start: a.start, end: a.start + a.len, label: id });
  });
  snap.free.forEach((b) => segs.push({ start: b.start, end: b.start + b.len, label: '空闲' }));
  segs.sort((x, y) => x.start - y.start);
  return segs.map((s) => `${s.label}[${s.start},${s.end})`).join(' ');
}

/** 跑一条序列，返回逐步记录 */
function run(total, ops, strategyKey, opts) {
  const pick = St.get(strategyKey).pick;
  const mem = new Core.Memory(total, opts);
  const steps = [];
  ops.forEach((op, i) => {
    const r = mem.apply(op, pick);
    const snap = mem.snapshot();
    steps.push({
      step: i + 1,
      op: op.op,
      id: op.id,
      size: op.op === 'alloc' ? op.size : undefined,
      result: r.ok ? 'ok' : 'fail',
      reason: r.ok ? undefined : r.reason,
      selected: r.ok && op.op === 'alloc' ? r.start : null,
      allocs: snap.allocs,
      free_blocks: snap.free,
      metrics: {
        free_total: snap.metrics.freeTotal,
        free_max: snap.metrics.freeMax,
        free_count: snap.metrics.freeCount
      },
      checks: snap.checks,
      layout: layoutText(snap)
    });
  });
  return { steps, final: mem.snapshot() };
}

function loadCases() {
  return fs.readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, f), 'utf8'));
      return { file: f, ...data };
    });
}

function main() {
  fs.mkdirSync(TRACE_DIR, { recursive: true });
  const cases = loadCases();
  const summary = [];

  cases.forEach((c) => {
    const out = {};
    ['ff', 'bf'].forEach((k) => {
      out[k] = run(c.total_memory, c.ops, k);
    });

    // 逐行对照，标记差异步
    const diffs = [];
    out.ff.steps.forEach((st, i) => {
      const other = out.bf.steps[i];
      st.diff = st.layout !== other.layout;
      other.diff = st.diff;
      if (st.diff) diffs.push({ step: st.step, op: `${st.op} ${st.id}`, ff: st.layout, bf: other.layout });
    });

    ['ff', 'bf'].forEach((k) => {
      const lines = out[k].steps.map((st) => JSON.stringify({
        step: st.step, op: st.op, id: st.id, size: st.size,
        result: st.result, reason: st.reason, selected: st.selected,
        allocs: st.allocs, free_blocks: st.free_blocks,
        metrics: st.metrics, checks: st.checks, diff: !!st.diff
      }));
      const fails = out[k].steps.filter((s) => s.result === 'fail');
      lines.push(JSON.stringify({
        summary: true,
        case_id: c.case_id,
        total_memory: c.total_memory,
        strategy: k,
        steps: out[k].steps.length,
        failCount: fails.length,
        failSteps: fails.map((s) => s.step),
        finalChecks: out[k].final.checks
      }));
      fs.writeFileSync(path.join(TRACE_DIR, `${c.case_id}-${k}.jsonl`), lines.join('\n') + '\n');
    });

    summary.push({
      case_id: c.case_id,
      total_memory: c.total_memory,
      steps: c.ops.length,
      ff: {
        failCount: out.ff.steps.filter((s) => s.result === 'fail').length,
        failSteps: out.ff.steps.filter((s) => s.result === 'fail').map((s) => s.step),
        finalFreeBlocks: out.ff.final.free.length,
        finalFreeMax: out.ff.final.metrics.freeMax,
        checks: out.ff.final.checks
      },
      bf: {
        failCount: out.bf.steps.filter((s) => s.result === 'fail').length,
        failSteps: out.bf.steps.filter((s) => s.result === 'fail').map((s) => s.step),
        finalFreeBlocks: out.bf.final.free.length,
        finalFreeMax: out.bf.final.metrics.freeMax,
        checks: out.bf.final.checks
      },
      diffSteps: diffs
    });
  });

  fs.writeFileSync(path.join(TRACE_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n');

  /* ---------- 非法操作测试 ---------- */
  const illegal = [];
  function t(name, fn, setup) {
    const mem = new Core.Memory(100);
    const pick = St.get('ff').pick;
    mem.alloc('A', 10, pick);
    if (setup) setup(mem, pick);          // 先做前置动作，再取基线
    const before = JSON.stringify(mem.snapshot());
    const r = fn(mem, pick);
    const after = JSON.stringify(mem.snapshot());
    illegal.push({
      test: name,
      ok: r.ok,
      code: r.code,
      reason: r.reason,
      stateUnchanged: before === after,
      checksAfter: mem.checks()
    });
  }
  t('重复申请同一编号 A', (m, p) => m.alloc('A', 5, p));
  t('释放不存在的编号 Z', (m) => m.free('Z'));
  t('申请量为 0', (m, p) => m.alloc('Z', 0, p));
  t('申请量为负', (m, p) => m.alloc('Z', -5, p));
  t('申请量超过总内存', (m, p) => m.alloc('Z', 101, p));
  t('申请量非整数', (m, p) => m.alloc('Z', 2.5, p));
  t('重复释放 A', (m) => m.free('A'), (m) => m.free('A'));

  fs.writeFileSync(path.join(TRACE_DIR, 'illegal-ops.json'),
    JSON.stringify(illegal, null, 2) + '\n');

  /* ---------- 合并开/关对照（假设 C1） ---------- */
  const c3 = cases.find((c) => c.case_id === 'case3-fragmentation') || cases[cases.length - 1];
  const mergeOn = run(c3.total_memory, c3.ops, 'ff', { mergeOn: true });
  const mergeOff = run(c3.total_memory, c3.ops, 'ff', { mergeOn: false });
  const onoff = {
    case_id: c3.case_id,
    merge_on: mergeOn.steps.map((s) => ({
      step: s.step, free_count: s.metrics.free_count, free_total: s.metrics.free_total,
      free_max: s.metrics.free_max, merged_check: s.checks.merged
    })),
    merge_off: mergeOff.steps.map((s) => ({
      step: s.step, free_count: s.metrics.free_count, free_total: s.metrics.free_total,
      free_max: s.metrics.free_max, merged_check: s.checks.merged
    }))
  };
  fs.writeFileSync(path.join(TRACE_DIR, 'merge-onoff.json'),
    JSON.stringify(onoff, null, 2) + '\n');

  /* ---------- 控制台汇总 ---------- */
  console.log('案例'.padEnd(24), '步数', 'FF失败', 'BF失败', '差异步', 'FF块数', 'BF块数');
  summary.forEach((s) => {
    console.log(
      s.case_id.padEnd(24),
      String(s.steps).padStart(3),
      String(s.ff.failCount).padStart(5),
      String(s.bf.failCount).padStart(5),
      String(s.diffSteps.length).padStart(5),
      String(s.ff.finalFreeBlocks).padStart(5),
      String(s.bf.finalFreeBlocks).padStart(5)
    );
  });
  console.log('\n差异步明细：');
  summary.forEach((s) => {
    s.diffSteps.forEach((d) => {
      console.log(`  ${s.case_id} 第 ${d.step} 步 ${d.op}`);
      console.log(`    FF: ${d.ff}`);
      console.log(`    BF: ${d.bf}`);
    });
  });
  console.log('\n非法操作测试：' + illegal.map((i) => `${i.test}=${i.stateUnchanged ? '状态不变' : '状态被改'}`).join('，'));
  console.log(`合并开关对照（${c3.case_id} 第 9 步）：开=块数 ${mergeOn.steps[8].metrics.free_count}，关=块数 ${mergeOff.steps[8].metrics.free_count}`);
  console.log('\n轨迹已写入 experiments/traces/');
}

main();
