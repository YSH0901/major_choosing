(function (global) {
  "use strict";

  const namespace = (global.Explorer = global.Explorer || {});

  function createFavoriteStorage(key, validIds) {
    function load() {
      try {
        const parsed = JSON.parse(global.localStorage.getItem(key) || "[]");
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id) => typeof id === "string" && validIds.has(id)));
      } catch {
        return new Set();
      }
    }

    function save(ids) {
      try {
        global.localStorage.setItem(key, JSON.stringify([...ids]));
      } catch {
        // file:// 또는 개인정보 보호 모드에서 저장소가 막혀도 현재 세션은 계속 동작합니다.
      }
    }

    return Object.freeze({ load, save });
  }

  namespace.createFavoriteStorage = createFavoriteStorage;
})(window);
