/* =====================================================================
 * cases.js — 预置实验案例（与 experiments/inputs/*.json 一致）
 *   case1 两策略分歧 / case2 三种合并 / case2b 仅左合并 / case3 碎片失败
 * ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemAllocCases = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function a(id, size) { return { op: 'alloc', id: id, size: size }; }
  function f(id) { return { op: 'free', id: id }; }

  return [
    {
      id: 'case1-divergence',
      name: '案例 1：两策略分歧',
      note: 'TOTAL=100，7 步。第 5 步 FF 取低地址块、BF 取恰好等大的尾块；第 7 步合并类型随之不同。',
      total: 100,
      ops: [a('A', 30), a('B', 30), a('C', 30), f('A'), a('D', 10), f('B'), f('C')]
    },
    {
      id: 'case2-merge-all',
      name: '案例 2：三种合并 + 非法操作',
      note: 'TOTAL=100，12 步。覆盖仅右、双侧（三块合一）、仅左三种合并；第 11 步释放不存在的编号应报错。',
      total: 100,
      ops: [a('A', 20), a('B', 20), a('C', 20), a('D', 20),
            f('A'), f('C'), f('B'), a('E', 55), f('E'), a('F', 30), f('G'), f('F')]
    },
    {
      id: 'case2b-merge-left',
      name: '案例 2b：仅左合并专项',
      note: 'TOTAL=100，8 步。第 8 步释放 C 时左邻空闲、右邻已分配，只与左侧合并。',
      total: 100,
      ops: [a('A', 10), a('B', 10), a('C', 10), a('D', 10), f('A'), a('E', 10), f('B'), f('C')]
    },
    {
      id: 'case3-fragmentation',
      name: '案例 3：外部碎片导致失败',
      note: 'TOTAL=90，9 步。第 6 步申请 50 失败：空闲总量 60 够，最大空闲块只有 30。',
      total: 90,
      ops: [a('A', 30), a('B', 30), a('C', 30), f('A'), f('C'), a('D', 50), a('E', 20), f('B'), f('E')]
    },
    {
      id: 'case4-b2-counterexample',
      name: '案例 4：B2 反例（BF 更差）',
      note: '假设 B2 反例：最佳适应申请失败 2 次，首次适应 1 次（随机种子 20261127）',
      total: 100,
      ops: [a('A', 45), a('B', 20), f('A'), a('C', 25), a('D', 50), f('B'), a('E', 25), a('F', 50)]
    }
  ];
});
