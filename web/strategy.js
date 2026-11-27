/* =====================================================================
 * strategy.js — 两种选块策略
 *   首次适应 firstFit：按地址递增，取第一个能装下的块
 *   最佳适应 bestFit ：取长度最小的能装下块；同长取低地址
 * 说明：freeList 始终按 start 升序，因此"同长取低地址"等价于首次出现即保留。
 * ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemAllocStrategy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function firstFit(freeList, size) {
    for (var i = 0; i < freeList.length; i++) {
      if (freeList[i].len >= size) return i;   // 地址升序 → 第一个可用即地址最低
    }
    return -1;
  }

  function bestFit(freeList, size) {
    var best = -1;
    for (var i = 0; i < freeList.length; i++) {
      if (freeList[i].len < size) continue;
      if (best < 0 || freeList[i].len < freeList[best].len) best = i;  // 严格小于 → 同长保留低地址
    }
    return best;
  }

  var STRATEGIES = {
    ff: { key: 'ff', name: '首次适应', pick: firstFit },
    bf: { key: 'bf', name: '最佳适应', pick: bestFit }
  };

  return {
    firstFit: firstFit,
    bestFit: bestFit,
    STRATEGIES: STRATEGIES,
    get: function (key) { return STRATEGIES[key]; }
  };
});
