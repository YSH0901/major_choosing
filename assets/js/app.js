(function (global) {
  "use strict";

  function boot() {
    const explorer = global.Explorer || {};

    try {
      const catalog = explorer.createCatalog(global.__EXPLORER_DATA__);
      const validSubjectIds = new Set(catalog.subjects.map((subject) => subject.id));
      const storage = explorer.createFavoriteStorage(
        catalog.site.favoriteStorageKey,
        validSubjectIds,
      );
      const state = explorer.createState(storage.load());

      const view = explorer.createView(catalog, {
        setMode: (mode) => state.setMode(mode),
        setQuery: (query) => state.setQuery(query),
        setType: (type) => state.setType(type),
        setGroup: (group) => state.setGroup(group),
        setDepartmentCategory: (category) => state.setDepartmentCategory(category),
        resetFilters: () => state.resetFilters(),
        toggleFavorite: (subjectId) => {
          if (!validSubjectIds.has(subjectId)) return;
          state.toggleFavorite(subjectId);
          storage.save(state.get().favoriteIds);
        },
        openDetail: (kind, id) => {
          const valid =
            (kind === "subject" && catalog.subjectById.has(id)) ||
            (kind === "department" && catalog.departmentById.has(id));
          if (valid) state.openDetail(kind, id);
        },
        closeDetail: () => state.closeDetail(),
      });

      state.subscribe((snapshot) => view.render(snapshot));
      view.render(state.get());
    } catch (error) {
      const errorPanel = document.getElementById("errorPanel");
      const errorMessage = document.getElementById("errorMessage");
      document.getElementById("listView").hidden = true;
      document.getElementById("detailView").hidden = true;
      errorMessage.textContent = error instanceof Error ? error.message : String(error);
      errorPanel.hidden = false;
      console.error(error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
