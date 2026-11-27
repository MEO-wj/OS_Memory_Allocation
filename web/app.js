/* =====================================================================
 * app.js — 页面交互：输入解析、单步/运行、布局渲染、指标、轨迹导出
 * 依赖：core.js（MemAllocCore）、strategy.js（MemAllocStrategy）、cases.js
 * ===================================================================== */
(function () {
  'use strict';

  var Core = window.MemAllocCore;
  var St = window.MemAllocStrategy;
  var CASES = window.MemAllocCases || [];

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 状态 ---------------- */
  var S = {
    total: 90,
    strategy: 'ff',
    ops: [],
    pos: 0,
    mem: null,
    steps: [],       // 本策略的逐步记录
    otherSteps: [],  // 对照策略的逐步记录（用于标记差异步）
    last: null,      // 最近一步结果
    caseNote: ''
  };

  /* ---------------- 序列解析 ---------------- */
  function parseOps(text, total) {
    var ops = [], errors = [];
    text.split(/\r?\n/).forEach(function (line, i) {
      var s = line.trim();
      if (!s || s.charAt(0) === '#') return;
      var p = s.split(/[\s,，]+/);
      var kw = (p[0] || '').toLowerCase();
      if (kw === 'alloc' || kw === 'a') {
        if (p.length < 3) { errors.push('第 ' + (i + 1) + ' 行：alloc 需要编号和大小'); return; }
        var size = Number(p[2]);
        if (!isFinite(size) || Math.floor(size) !== size) { errors.push('第 ' + (i + 1) + ' 行：大小必须是整数'); return; }
        ops.push({ op: 'alloc', id: p[1], size: size });
      } else if (kw === 'free' || kw === 'f' || kw === 'release') {
        if (p.length < 2) { errors.push('第 ' + (i + 1) + ' 行：free 需要编号'); return; }
        ops.push({ op: 'free', id: p[1] });
      } else {
        errors.push('第 ' + (i + 1) + ' 行：无法识别的操作 "' + p[0] + '"');
      }
    });
    return { ops: ops, errors: errors };
  }

  function opsToText(ops) {
    return ops.map(function (o) {
      return o.op === 'alloc' ? 'alloc ' + o.id + ' ' + o.size : 'free ' + o.id;
    }).join('\n');
  }

  /* ---------------- 运行：一次算完某策略的逐步状态 ---------------- */
  function simulate(total, ops, strategyKey) {
    var pick = St.get(strategyKey).pick;
    var mem = new Core.Memory(total);
    var steps = [];
    ops.forEach(function (op, i) {
      var r = mem.apply(op, pick);
      var snap = mem.snapshot();
      steps.push({
        index: i + 1,
        op: op,
        result: r,
        snapshot: snap,
        layoutText: layoutText(snap)
      });
    });
    return { mem: mem, steps: steps };
  }

  function layoutText(snap) {
    var segs = [];
    var ids = Object.keys(snap.allocs);
    ids.forEach(function (id) {
      segs.push({ start: snap.allocs[id].start, end: snap.allocs[id].start + snap.allocs[id].len, label: id });
    });
    snap.free.forEach(function (b) {
      segs.push({ start: b.start, end: b.start + b.len, label: '空闲' });
    });
    segs.sort(function (a, b) { return a.start - b.start; });
    return segs.map(function (s) { return s.label + '[' + s.start + ',' + s.end + ')'; }).join('  ');
  }

  function sameState(s1, s2) {
    if (!s1 || !s2) return true;
    return layoutText(s1) === layoutText(s2);
  }

  /* ---------------- 初始化与重置 ---------------- */
  function currentText() {
    var t = $('ops').value.trim();
    return t || opsToText(CASES.length ? CASES[3].ops : []);
  }

  function reset(keepText) {
    S.total = Math.max(1, Math.floor(Number($('total').value) || 90));
    S.strategy = $('strategy').value;
    var parsed = parseOps(keepText === false ? opsToText(CASES[3].ops) : currentText(), S.total);
    S.ops = parsed.ops;
    S.pos = 0;
    S.mem = new Core.Memory(S.total);
    S.steps = [];
    S.otherSteps = [];
    S.last = null;

    // 预先算好两种策略，用于标记差异步
    var otherKey = S.strategy === 'ff' ? 'bf' : 'ff';
    S.otherSteps = simulate(S.total, S.ops, otherKey).steps;

    render(parsed.errors);
  }

  /* ---------------- 单步 ---------------- */
  function step() {
    if (S.pos >= S.ops.length) {
      showMessage('已经执行到最后一步。', 'ok');
      return false;
    }
    var op = S.ops[S.pos];
    var pick = St.get(S.strategy).pick;
    var r = S.mem.apply(op, pick);
    var snap = S.mem.snapshot();
    S.steps.push({ index: S.pos + 1, op: op, result: r, snapshot: snap, layoutText: layoutText(snap) });
    S.pos++;
    S.last = { op: op, result: r };
    render([]);
    return true;
  }

  function runAll() {
    var guard = 0;
    while (S.pos < S.ops.length && guard < 500) {
      var op = S.ops[S.pos];
      var pick = St.get(S.strategy).pick;
      var r = S.mem.apply(op, pick);
      S.steps.push({
        index: S.pos + 1, op: op, result: r,
        snapshot: S.mem.snapshot(),
        layoutText: layoutText(S.mem.snapshot())
      });
      S.pos++;
      S.last = { op: op, result: r };
      guard++;
    }
    render([]);
  }

  /* ---------------- 渲染 ---------------- */
  function render(parseErrors) {
    var snap = S.mem.snapshot();
    renderBar(snap);
    renderMetrics(snap);
    renderChecks(snap);
    renderLog();
    renderMessage(parseErrors);
    $('progress').textContent = '第 ' + S.pos + ' 步 / 共 ' + S.ops.length + ' 步' +
      '（策略：' + St.get(S.strategy).name + '）';
  }

  function renderBar(snap) {
    var bar = $('bar'), ticks = $('ticks');
    bar.innerHTML = '';
    ticks.innerHTML = '';
    var segs = [];
    Object.keys(snap.allocs).forEach(function (id) {
      var a = snap.allocs[id];
      segs.push({ type: 'alloc', id: id, start: a.start, len: a.len });
    });
    snap.free.forEach(function (b) {
      segs.push({ type: 'free', id: '空闲', start: b.start, len: b.len });
    });
    segs.sort(function (a, b) { return a.start - b.start; });

    segs.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'blk ' + s.type;
      d.style.flex = s.len + ' 0 0';
      d.style.width = (100 * s.len / snap.total) + '%';
      d.title = s.id + ' [' + s.start + ',' + (s.start + s.len) + ')  长度 ' + s.len;
      d.innerHTML = '<span class="id">' + s.id + '</span><span class="len">' + s.len + '</span>';
      bar.appendChild(d);
    });

    // 地址刻度：每个块的起点 + 末尾
    var marks = [];
    segs.forEach(function (s) { marks.push(s.start); });
    marks.push(snap.total);
    marks.forEach(function (m, i) {
      var t = document.createElement('span');
      t.textContent = m;
      t.style.left = (100 * m / snap.total) + '%';
      t.style.transform = i === 0 ? 'translateX(0)' : (i === marks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)');
      ticks.appendChild(t);
    });

    $('layout-text').textContent = layoutText(snap);
  }

  function renderMetrics(snap) {
    var m = snap.metrics;
    $('m-free-total').textContent = m.freeTotal;
    $('m-free-max').textContent = m.freeMax;
    $('m-free-count').textContent = m.freeCount;

    var el = $('m-result');
    if (!S.last) { el.textContent = '–'; el.className = 'v'; return; }
    var r = S.last.result;
    if (r.ok) {
      el.textContent = S.last.op.op === 'alloc' ? ('成功@' + r.start) : ('已释放@' + r.start);
      el.className = 'v';
    } else {
      el.textContent = '失败';
      el.className = 'v bad';
    }
  }

  function renderChecks(snap) {
    var c = snap.checks;
    var parts = [
      '<span class="' + (c.noOverlap ? 'ok' : 'bad') + '">不重叠 ' + (c.noOverlap ? '✓' : '✗') + '</span>',
      '<span class="' + (c.conservation ? 'ok' : 'bad') + '">守恒 ' + (c.conservation ? '✓' : '✗') + '</span>',
      '<span class="' + (c.merged ? 'ok' : 'bad') + '">合并完整 ' + (c.merged ? '✓' : '✗') + '</span>'
    ];
    $('checks').innerHTML = '约束检查：' + parts.join('　');
  }

  function renderLog() {
    var tb = $('log').querySelector('tbody');
    tb.innerHTML = '';
    S.steps.forEach(function (st) {
      var other = S.otherSteps[st.index - 1];
      var diff = !sameState(st.snapshot, other && other.snapshot);
      var tr = document.createElement('tr');
      if (diff) tr.className += ' diff';
      if (!st.result.ok) tr.className += ' fail';

      var sel = st.result.ok && st.op.op === 'alloc' ? ('@' + st.result.start) : '—';
      var res = st.result.ok ? '成功' : ('失败：' + st.result.reason);

      tr.innerHTML =
        '<td>' + st.index + (diff ? ' ★' : '') + '</td>' +
        '<td class="mono">' + (st.op.op === 'alloc' ? ('alloc ' + st.op.id + ' ' + st.op.size) : ('free ' + st.op.id)) + '</td>' +
        '<td class="mono">' + sel + '</td>' +
        '<td class="mono">' + st.layoutText + '</td>' +
        '<td>' + st.snapshot.metrics.freeTotal + '</td>' +
        '<td>' + st.snapshot.metrics.freeMax + '</td>' +
        '<td>' + st.snapshot.metrics.freeCount + '</td>' +
        '<td>' + res + '</td>';
      tb.appendChild(tr);
    });
    var wrap = document.querySelector('.table-wrap');
    wrap.scrollTop = wrap.scrollHeight;
  }

  function renderMessage(parseErrors) {
    var box = $('message');
    if (parseErrors && parseErrors.length) {
      box.className = 'message show err';
      box.textContent = '序列解析有问题：' + parseErrors.join('；');
      return;
    }
    if (!S.last) { box.className = 'message'; box.textContent = ''; return; }
    var r = S.last.result;
    if (!r.ok) {
      box.className = 'message show err';
      box.textContent = '第 ' + S.pos + ' 步失败：' + r.reason +
        '（失败不改变状态，四项指标与操作前一致）';
    } else if (S.pos >= S.ops.length && S.mem.checks().ok) {
      box.className = 'message show ok';
      box.textContent = '已执行完毕，三项约束检查全部通过。可切换策略后重置，用同一序列对照。';
    } else {
      box.className = 'message';
      box.textContent = '';
    }
  }

  function showMessage(text, kind) {
    var box = $('message');
    box.className = 'message show ' + (kind || 'ok');
    box.textContent = text;
  }

  /* ---------------- 非法操作自检 ---------------- */
  function runIllegalTest(kind) {
    var mem = new Core.Memory(S.total);
    var pick = St.get(S.strategy).pick;
    var before, after, r, desc;

    // 先搭一个基础状态：A=10 已分配
    mem.alloc('A', 10, pick);
    before = JSON.stringify(mem.snapshot().allocs);

    if (kind === 'dup-alloc') {
      r = mem.alloc('A', 5, pick); desc = '重复申请编号 A';
    } else if (kind === 'dup-free') {
      mem.free('A'); before = JSON.stringify(mem.snapshot().allocs);
      r = mem.free('A'); desc = '重复释放 A';
    } else if (kind === 'bad-size') {
      r = mem.alloc('Z', 0, pick); desc = '申请量为 0';
    } else {
      r = mem.alloc('Z', S.total + 1, pick); desc = '申请量超过总内存';
    }
    after = JSON.stringify(mem.snapshot().allocs);

    var box = $('message');
    box.className = 'message show err';
    box.textContent = '非法操作测试（' + desc + '）：' + r.reason +
      '；报错后状态' + (before === after ? '保持不变 ✓' : '被改动 ✗');
  }

  /* ---------------- 导出轨迹 ---------------- */
  function exportTrace() {
    if (!S.steps.length) { showMessage('还没有执行任何步骤，无法导出。', 'err'); return; }
    var lines = S.steps.map(function (st) {
      var snap = st.snapshot;
      var rec = {
        step: st.index,
        op: st.op.op,
        id: st.op.id,
        size: st.op.op === 'alloc' ? st.op.size : undefined,
        result: st.result.ok ? 'ok' : 'fail',
        reason: st.result.ok ? undefined : st.result.reason,
        selected: st.result.ok && st.op.op === 'alloc' ? st.result.start : null,
        allocs: snap.allocs,
        free_blocks: snap.free,
        metrics: {
          free_total: snap.metrics.freeTotal,
          free_max: snap.metrics.freeMax,
          free_count: snap.metrics.freeCount
        },
        checks: snap.checks,
        diff: !sameState(snap, S.otherSteps[st.index - 1] && S.otherSteps[st.index - 1].snapshot)
      };
      return JSON.stringify(rec);
    });
    var last = S.steps[S.steps.length - 1];
    lines.push(JSON.stringify({
      summary: true,
      case_total: S.total,
      strategy: S.strategy,
      steps: S.steps.length,
      failCount: S.steps.filter(function (s) { return !s.result.ok; }).length,
      checks: last.snapshot.checks
    }));

    var blob = new Blob([lines.join('\n') + '\n'], { type: 'application/jsonl' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trace-' + S.total + '-' + S.strategy + '.jsonl';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------------- 预置案例 ---------------- */
  function renderPresets() {
    var box = $('presets');
    box.innerHTML = '';
    CASES.forEach(function (c, i) {
      var b = document.createElement('button');
      b.textContent = c.name;
      b.addEventListener('click', function () {
        $('total').value = c.total;
        $('ops').value = opsToText(c.ops);
        $('case-note').textContent = c.note;
        reset();
      });
      box.appendChild(b);
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('btn-step').addEventListener('click', function () { step(); });
    $('btn-run').addEventListener('click', function () { runAll(); });
    $('btn-reset').addEventListener('click', function () { reset(); });
    $('btn-export').addEventListener('click', exportTrace);
    $('strategy').addEventListener('change', function () { reset(); });
    $('total').addEventListener('change', function () { reset(); });
    $('ops').addEventListener('change', function () { reset(); });

    document.querySelectorAll('[data-test]').forEach(function (b) {
      b.addEventListener('click', function () { runIllegalTest(b.getAttribute('data-test')); });
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderPresets();
    bind();
    // 默认载入案例 3
    var c = CASES[3] || CASES[0];
    if (c) {
      $('total').value = c.total;
      $('ops').value = opsToText(c.ops);
      $('case-note').textContent = c.note;
    }
    reset();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
