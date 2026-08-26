(function (global) {
  "use strict";

  const namespace = (global.Explorer = global.Explorer || {});
  const modes = new Set(["subjects", "departments", "favorites"]);

  function createState(initialFavorites) {
    let snapshot = {
      mode: "subjects",
      query: "",
      type: "all",
      group: "all",
      departmentCategory: "all",
      favoriteIds: new Set(initialFavorites),
      detail: null,
    };
    const listeners = new Set();

    function emit() {
      listeners.forEach((listener) => listener(snapshot));
    }

    function update(patch) {
      snapshot = { ...snapshot, ...patch };
      emit();
    }

    return Object.freeze({
      get() {
        return snapshot;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setMode(mode) {
        if (modes.has(mode)) update({ mode, detail: null });
      },
      setQuery(query) {
        update({ query });
      },
      setType(type) {
        update({ type });
      },
      setGroup(group) {
        update({ group });
      },
      setDepartmentCategory(departmentCategory) {
        update({ departmentCategory });
      },
      resetFilters() {
        update({ query: "", type: "all", group: "all", departmentCategory: "all" });
      },
      toggleFavorite(subjectId) {
        const favoriteIds = new Set(snapshot.favoriteIds);
        if (favoriteIds.has(subjectId)) favoriteIds.delete(subjectId);
        else favoriteIds.add(subjectId);
        update({ favoriteIds });
      },
      openDetail(kind, id) {
        update({ detail: { kind, id } });
      },
      closeDetail() {
        update({ detail: null });
      },
    });
  }

  namespace.createState = createState;
})(window);
