/* =====================================================================
 * core.js — 连续内存分配模拟器核心
 * 浏览器与 Node 通用（挂到 window.MemAllocCore / module.exports）
 *
 * 模型约定（与报告第 1 节一致）：
 *   内存为 [0,T) 的整数地址连续空间，初始整块空闲；
 *   申请量为正整数，唯一编号；不计管理开销；不做紧缩；
 *   分配自选中空闲块的低地址端切出；释放后立即与相邻空闲区合并。
 * ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemAllocCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isPosInt(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n > 0;
  }

  /* ---------------- 构造 ---------------- */
  function Memory(total, opts) {
    if (!isPosInt(total)) throw new Error('总内存必须是正整数');
    this.total = total;
    this.mergeOn = !(opts && opts.mergeOn === false); // 关闭合并用于 C1 对照实验
    this.allocs = {};                                 // id -> {start,len}
    this.freeList = [{ start: 0, len: total }];       // 按 start 升序
  }

  /* ---------------- 指标 ---------------- */
  Memory.prototype.metrics = function () {
    var sum = 0, max = 0;
    for (var i = 0; i < this.freeList.length; i++) {
      sum += this.freeList[i].len;
      if (this.freeList[i].len > max) max = this.freeList[i].len;
    }
    return { freeTotal: sum, freeMax: max, freeCount: this.freeList.length };
  };

  /* ---------------- 布局（按地址输出片段） ---------------- */
  Memory.prototype.layout = function () {
    var segs = [], id;
    for (id in this.allocs) {
      if (Object.prototype.hasOwnProperty.call(this.allocs, id)) {
        segs.push({ type: 'alloc', id: id, start: this.allocs[id].start, len: this.allocs[id].len });
      }
    }
    for (var i = 0; i < this.freeList.length; i++) {
      segs.push({ type: 'free', id: '空闲', start: this.freeList[i].start, len: this.freeList[i].len });
    }
    segs.sort(function (a, b) { return a.start - b.start; });
    return segs;
  };

  /* ---------------- 三项检查 ---------------- */
  Memory.prototype.checks = function () {
    var msgs = [], id, i;

    // (a) 已分配区不重叠
    var ivs = [];
    for (id in this.allocs) {
      if (Object.prototype.hasOwnProperty.call(this.allocs, id)) {
        ivs.push({ start: this.allocs[id].start, len: this.allocs[id].len, id: id });
      }
    }
    ivs.sort(function (a, b) { return a.start - b.start; });
    var noOverlap = true;
    for (i = 1; i < ivs.length; i++) {
      if (ivs[i - 1].start + ivs[i - 1].len > ivs[i].start) {
        noOverlap = false;
        msgs.push('重叠：' + ivs[i - 1].id + ' 与 ' + ivs[i].id);
      }
    }

    // (b) 守恒：已分配 + 空闲 = 总内存
    var allocSum = 0, freeSum = 0;
    for (i = 0; i < ivs.length; i++) allocSum += ivs[i].len;
    for (i = 0; i < this.freeList.length; i++) freeSum += this.freeList[i].len;
    var conservation = (allocSum + freeSum === this.total);
    if (!conservation) msgs.push('守恒被破坏：' + allocSum + '+' + freeSum + '≠' + this.total);

    // (c) 合并完整：不存在相邻空闲块
    var merged = true;
    for (i = 1; i < this.freeList.length; i++) {
      if (this.freeList[i - 1].start + this.freeList[i - 1].len === this.freeList[i].start) {
        merged = false;
        msgs.push('存在未合并的相邻空闲区：' + this.freeList[i - 1].start + ' 处');
      }
    }

    return {
      noOverlap: noOverlap,
      conservation: conservation,
      merged: merged,
      ok: noOverlap && conservation && merged,
      messages: msgs
    };
  };

  /* ---------------- 释放后的相邻合并 ---------------- */
  Memory.prototype.mergeFree = function () {
    this.freeList.sort(function (a, b) { return a.start - b.start; });
    var out = [];
    for (var i = 0; i < this.freeList.length; i++) {
      var cur = this.freeList[i];
      if (out.length) {
        var prev = out[out.length - 1];
        // 关键：合并后继续与下一块比较，可处理三块连续
        if (prev.start + prev.len === cur.start) { prev.len += cur.len; continue; }
      }
      out.push({ start: cur.start, len: cur.len });
    }
    this.freeList = out;
  };

  /* ---------------- 申请合法性 ---------------- */
  Memory.prototype.validateAlloc = function (id, size) {
    if (typeof id !== 'string' || id.length === 0) return '编号不能为空';
    if (Object.prototype.hasOwnProperty.call(this.allocs, id)) return '编号 ' + id + ' 已存在，不能重复申请';
    if (typeof size !== 'number' || !isFinite(size) || Math.floor(size) !== size) return '申请量必须是整数';
    if (size <= 0) return '申请量必须大于 0';
    if (size > this.total) return '申请量 ' + size + ' 超过总内存 ' + this.total;
    return null;
  };

  /* ---------------- 申请 ---------------- */
  // pick：策略函数 (freeList, size) => 下标 或 -1
  Memory.prototype.alloc = function (id, size, pick) {
    var err = this.validateAlloc(id, size);
    if (err) {
      return { ok: false, code: 'invalid', reason: err, stateChanged: false, metrics: this.metrics() };
    }
    var idx = pick(this.freeList, size);
    if (idx < 0 || idx >= this.freeList.length) {
      var m = this.metrics();
      return {
        ok: false, code: 'nofit', stateChanged: false, metrics: m,
        reason: '空闲总量 ' + m.freeTotal + '，最大空闲块 ' + m.freeMax +
                '，没有一块能容纳 ' + size
      };
    }
    var blk = this.freeList[idx];
    var start = blk.start;
    this.allocs[id] = { start: start, len: size };
    if (blk.len === size) this.freeList.splice(idx, 1);
    else { blk.start += size; blk.len -= size; }
    return { ok: true, code: 'ok', start: start, metrics: this.metrics() };
  };

  /* ---------------- 释放 ---------------- */
  Memory.prototype.free = function (id) {
    if (!Object.prototype.hasOwnProperty.call(this.allocs, id)) {
      return {
        ok: false, code: 'invalid', stateChanged: false, metrics: this.metrics(),
        reason: '编号 ' + id + ' 不存在或已释放，不能重复释放'
      };
    }
    var a = this.allocs[id];
    delete this.allocs[id];
    this.freeList.push({ start: a.start, len: a.len });
    this.freeList.sort(function (x, y) { return x.start - y.start; });
    if (this.mergeOn) this.mergeFree();
    return { ok: true, code: 'ok', start: a.start, len: a.len, metrics: this.metrics() };
  };

  /* ---------------- 单步执行（供 UI 与轨迹生成共用） ---------------- */
  // op: {op:'alloc'|'free', id, size}；pick: 策略函数
  Memory.prototype.apply = function (op, pick) {
    if (op.op === 'alloc') return this.alloc(op.id, op.size, pick);
    if (op.op === 'free') return this.free(op.id);
    return { ok: false, code: 'invalid', reason: '未知操作：' + op.op, stateChanged: false, metrics: this.metrics() };
  };

  /* ---------------- 快照 ---------------- */
  Memory.prototype.snapshot = function () {
    var allocs = {}, id;
    for (id in this.allocs) {
      if (Object.prototype.hasOwnProperty.call(this.allocs, id)) {
        allocs[id] = { start: this.allocs[id].start, len: this.allocs[id].len };
      }
    }
    var free = this.freeList.map(function (b) { return { start: b.start, len: b.len }; });
    return { total: this.total, allocs: allocs, free: free, metrics: this.metrics(), checks: this.checks() };
  };

  return { Memory: Memory, isPosInt: isPosInt };
});
