(function (global) {
  "use strict";

  const namespace = (global.Explorer = global.Explorer || {});

  function node(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function button(className, text, onClick) {
    const element = node("button", className, text);
    element.type = "button";
    element.addEventListener("click", onClick);
    return element;
  }

  function appendChildren(parent, children) {
    for (const child of children) {
      if (child) parent.append(child);
    }
    return parent;
  }

  function textList(items, className = "stack-list") {
    const list = node("ul", className);
    for (const item of items) list.append(node("li", "", item));
    return list;
  }

  function tagList(items, createItem) {
    const list = node("div", "tag-list");
    items.forEach((item) => list.append(createItem(item)));
    return list;
  }

  function plainTag(text, muted = false) {
    return node("span", `tag${muted ? " tag--muted" : ""}`, text);
  }

  function panel(title, content, wide = false) {
    const section = node("section", `detail-panel${wide ? " detail-panel--wide" : ""}`);
    section.append(node("h3", "", title), content);
    return section;
  }

  function createView(catalog, actions) {
    const elements = {
      datasetSummary: document.getElementById("datasetSummary"),
      curriculumLabel: document.getElementById("curriculumLabel"),
      pageDescription: document.getElementById("pageDescription"),
      tabs: [...document.querySelectorAll("[data-mode]")],
      listView: document.getElementById("listView"),
      contentLayout: document.getElementById("contentLayout"),
      subjectOnly: [...document.querySelectorAll(".subject-only")],
      departmentOnly: [...document.querySelectorAll(".department-only")],
      searchInput: document.getElementById("searchInput"),
      autocomplete: document.getElementById("autocomplete"),
      typeFilter: document.getElementById("typeFilter"),
      groupFilter: document.getElementById("groupFilter"),
      departmentCategoryFilter: document.getElementById("departmentCategoryFilter"),
      resetButton: document.getElementById("resetButton"),
      groupButtons: document.getElementById("groupButtons"),
      originStats: document.getElementById("originStats"),
      favoriteStats: document.getElementById("favoriteStats"),
      resultCount: document.getElementById("resultCount"),
      resultHint: document.getElementById("resultHint"),
      cards: document.getElementById("cards"),
      detailView: document.getElementById("detailView"),
      detailContent: document.getElementById("detailContent"),
      backButton: document.getElementById("backButton"),
      footerText: document.getElementById("footerText"),
      errorPanel: document.getElementById("errorPanel"),
      errorMessage: document.getElementById("errorMessage"),
    };
    let suggestionItems = [];
    let activeSuggestion = -1;
    let listScrollPosition = 0;
    let lastDetailKey = "";
    let pendingFavoriteFocusId = null;
    let detailOpener = null;

    function openEntity(kind, id, rememberScroll = true) {
      if (rememberScroll) {
        listScrollPosition = global.scrollY;
        detailOpener = { kind, id };
      }
      hideAutocomplete();
      actions.openDetail(kind, id);
    }

    function addOption(select, value, label) {
      const option = node("option", "", label);
      option.value = value;
      select.append(option);
    }

    function initializeStaticContent() {
      document.title = catalog.site.title;
      elements.curriculumLabel.textContent = catalog.site.curriculumLabel;
      elements.pageDescription.textContent = catalog.site.description;
      elements.footerText.textContent = catalog.site.footer;
      elements.datasetSummary.textContent = `${catalog.subjects.length}개 과목 · ${catalog.departments.length}개 학과`;
      elements.originStats.textContent = `공식 ${catalog.originCounts.official} + 사용자 추가 ${catalog.originCounts.custom}`;

      catalog.types.forEach((type) => addOption(elements.typeFilter, type, catalog.typeLabel(type)));
      catalog.groups.forEach((group) => addOption(elements.groupFilter, group, group));
      catalog.departmentCategories.forEach((category) =>
        addOption(elements.departmentCategoryFilter, category, category),
      );

      const allGroupButton = button("group-button is-active", "", () => actions.setGroup("all"));
      allGroupButton.dataset.group = "all";
      appendChildren(allGroupButton, [
        node("span", "", "전체 교과"),
        node("span", "group-button__count", catalog.subjects.length),
      ]);
      elements.groupButtons.append(allGroupButton);

      for (const group of catalog.groups) {
        const count = catalog.subjects.filter((subject) => subject.group === group).length;
        const groupButton = button("group-button", "", () => actions.setGroup(group));
        groupButton.dataset.group = group;
        appendChildren(groupButton, [
          node("span", "", group),
          node("span", "group-button__count", count),
        ]);
        elements.groupButtons.append(groupButton);
      }
    }

    function hideAutocomplete() {
      suggestionItems = [];
      activeSuggestion = -1;
      elements.autocomplete.hidden = true;
      elements.searchInput.setAttribute("aria-expanded", "false");
      elements.searchInput.removeAttribute("aria-activedescendant");
    }

    function updateActiveSuggestion() {
      const buttons = [...elements.autocomplete.querySelectorAll(".autocomplete__item")];
      buttons.forEach((item, index) => {
        const isActive = index === activeSuggestion;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
        if (isActive) {
          elements.searchInput.setAttribute("aria-activedescendant", item.id);
          item.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function renderAutocomplete(query) {
      suggestionItems = catalog.suggestions(query);
      activeSuggestion = -1;
      elements.searchInput.removeAttribute("aria-activedescendant");
      elements.autocomplete.replaceChildren();

      if (suggestionItems.length === 0) {
        hideAutocomplete();
        return;
      }

      let previousKind = "";
      suggestionItems.forEach((item, index) => {
        if (item.kind !== previousKind) {
          elements.autocomplete.append(
            node("div", "autocomplete__group", item.kind === "subject" ? "선택과목" : "학과"),
          );
          previousKind = item.kind;
        }

        const itemButton = button("autocomplete__item", "", () => openEntity(item.kind, item.id));
        itemButton.id = `suggestion-${index}`;
        itemButton.tabIndex = -1;
        itemButton.setAttribute("role", "option");
        itemButton.setAttribute("aria-selected", "false");
        appendChildren(itemButton, [
          node("strong", "", item.name),
          node("span", "autocomplete__meta", item.meta),
        ]);
        elements.autocomplete.append(itemButton);
      });

      elements.autocomplete.hidden = false;
      elements.searchInput.setAttribute("aria-expanded", "true");
    }

    function bindEvents() {
      elements.tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          hideAutocomplete();
          actions.setMode(tab.dataset.mode);
        });
      });
      elements.tabs.forEach((tab, index) => {
        tab.addEventListener("keydown", (event) => {
          let nextIndex = null;
          if (event.key === "ArrowRight") nextIndex = (index + 1) % elements.tabs.length;
          else if (event.key === "ArrowLeft") nextIndex = (index - 1 + elements.tabs.length) % elements.tabs.length;
          else if (event.key === "Home") nextIndex = 0;
          else if (event.key === "End") nextIndex = elements.tabs.length - 1;
          if (nextIndex === null) return;
          event.preventDefault();
          elements.tabs[nextIndex].focus();
          elements.tabs[nextIndex].click();
        });
      });

      elements.searchInput.addEventListener("input", (event) => {
        actions.setQuery(event.target.value);
        renderAutocomplete(event.target.value);
      });
      elements.searchInput.addEventListener("focus", () => renderAutocomplete(elements.searchInput.value));
      elements.searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          hideAutocomplete();
          return;
        }
        if (elements.autocomplete.hidden || suggestionItems.length === 0) {
          if (event.key === "Escape") hideAutocomplete();
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          activeSuggestion = (activeSuggestion + 1) % suggestionItems.length;
          updateActiveSuggestion();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          activeSuggestion = (activeSuggestion - 1 + suggestionItems.length) % suggestionItems.length;
          updateActiveSuggestion();
        } else if (event.key === "Enter" && activeSuggestion >= 0) {
          event.preventDefault();
          const selected = suggestionItems[activeSuggestion];
          openEntity(selected.kind, selected.id);
        } else if (event.key === "Escape") {
          event.preventDefault();
          hideAutocomplete();
        }
      });
      elements.searchInput.closest(".search-field").addEventListener("focusout", (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hideAutocomplete();
      });

      elements.typeFilter.addEventListener("change", (event) => actions.setType(event.target.value));
      elements.groupFilter.addEventListener("change", (event) => actions.setGroup(event.target.value));
      elements.departmentCategoryFilter.addEventListener("change", (event) =>
        actions.setDepartmentCategory(event.target.value),
      );
      elements.resetButton.addEventListener("click", () => {
        hideAutocomplete();
        actions.resetFilters();
        elements.searchInput.focus();
      });
      elements.backButton.addEventListener("click", () => {
        actions.closeDetail();
        global.requestAnimationFrame(() => {
          global.scrollTo({ top: listScrollPosition, behavior: "auto" });
          const opener = [...elements.cards.querySelectorAll(".card__title-button")].find(
            (titleButton) =>
              titleButton.dataset.entityKind === detailOpener?.kind &&
              titleButton.dataset.entityId === detailOpener?.id,
          );
          (opener || elements.resultCount).focus({ preventScroll: true });
          detailOpener = null;
        });
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".search-field")) hideAutocomplete();
      });
    }

    function subjectCard(subject, favoriteIds) {
      const card = node("article", "card");
      const top = node("div", "card__top");
      const titleBlock = node("div");
      const titleButton = button("card__title-button", subject.name, () =>
        openEntity("subject", subject.id),
      );
      titleButton.dataset.entityKind = "subject";
      titleButton.dataset.entityId = subject.id;
      titleBlock.append(
        titleButton,
        node("p", "card__meta", `${subject.group} · ${catalog.typeLabel(subject.type)}`),
      );

      const isFavorite = favoriteIds.has(subject.id);
      const favoriteButton = button("favorite-button", isFavorite ? "★" : "☆", () =>
        {
          pendingFavoriteFocusId = subject.id;
          actions.toggleFavorite(subject.id);
        },
      );
      favoriteButton.dataset.favoriteId = subject.id;
      favoriteButton.classList.toggle("is-active", isFavorite);
      favoriteButton.setAttribute("aria-pressed", String(isFavorite));
      favoriteButton.setAttribute(
        "aria-label",
        `${subject.name} ${isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}`,
      );
      top.append(titleBlock, favoriteButton);

      const actionsRow = node("div", "card__actions");
      actionsRow.append(button("small-button", "상세 보기", () => openEntity("subject", subject.id)));
      if (!subject.details) actionsRow.append(node("span", "tag tag--muted", "기본 안내"));
      card.append(top, actionsRow);
      return card;
    }

    function departmentCard(department) {
      const card = node("article", "card");
      const titleBlock = node("div");
      const titleButton = button("card__title-button", department.name, () =>
        openEntity("department", department.id),
      );
      titleButton.dataset.entityKind = "department";
      titleButton.dataset.entityId = department.id;
      titleBlock.append(titleButton);
      const recommendationCount = new Set(
        department.electiveGroups.flatMap((group) => [
          ...group.subjectIds,
          ...(group.otherSubjects || []).map((name) => `other:${name}`),
        ]),
      ).size;
      titleBlock.append(
        node("p", "card__meta", `${department.category} · 추천 선택과목 ${recommendationCount}개`),
      );
      card.append(titleBlock, node("p", "card__description", department.description));
      const actionsRow = node("div", "card__actions");
      actionsRow.append(button("small-button", "학과 상세 보기", () => openEntity("department", department.id)));
      card.append(actionsRow);
      return card;
    }

    function emptyState(title, description) {
      const empty = node("div", "empty-state");
      empty.append(node("strong", "", title), node("span", "", description));
      return empty;
    }

    function renderList(snapshot) {
      const isDepartmentMode = snapshot.mode === "departments";
      elements.subjectOnly.forEach((element) => {
        element.hidden = isDepartmentMode;
      });
      elements.departmentOnly.forEach((element) => {
        element.hidden = !isDepartmentMode;
      });
      elements.contentLayout.classList.toggle("department-mode", isDepartmentMode);
      elements.favoriteStats.textContent = `즐겨찾기 ${snapshot.favoriteIds.size}`;

      let items;
      if (isDepartmentMode) {
        items = catalog.filterDepartments({
          query: snapshot.query,
          category: snapshot.departmentCategory,
        });
        elements.resultCount.textContent = `학과 ${items.length}개`;
        elements.resultHint.textContent = "카드를 선택하면 추천 과목과 진로 정보를 볼 수 있습니다.";
      } else {
        items = catalog.filterSubjects({
          query: snapshot.query,
          type: snapshot.type,
          group: snapshot.group,
          favoriteIds: snapshot.mode === "favorites" ? snapshot.favoriteIds : null,
        });
        elements.resultCount.textContent = `${snapshot.mode === "favorites" ? "즐겨찾기" : "선택과목"} ${items.length}개`;
        elements.resultHint.textContent = "별을 누르면 이 브라우저에 즐겨찾기가 저장됩니다.";
      }

      elements.cards.replaceChildren();
      if (items.length === 0) {
        const isEmptyFavorites = snapshot.mode === "favorites" && snapshot.favoriteIds.size === 0;
        elements.cards.append(
          emptyState(
            isEmptyFavorites ? "아직 즐겨찾기가 없습니다" : "조건에 맞는 결과가 없습니다",
            isEmptyFavorites
              ? "선택과목 카드의 별을 눌러 관심 과목을 모아 보세요."
              : "검색어나 필터를 바꾸거나 초기화해 보세요.",
          ),
        );
        if (pendingFavoriteFocusId) {
          elements.resultCount.focus({ preventScroll: true });
          pendingFavoriteFocusId = null;
        }
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach((item) =>
        fragment.append(
          isDepartmentMode ? departmentCard(item) : subjectCard(item, snapshot.favoriteIds),
        ),
      );
      elements.cards.append(fragment);

      if (pendingFavoriteFocusId) {
        const focusTarget = [...elements.cards.querySelectorAll(".favorite-button")].find(
          (favoriteButton) => favoriteButton.dataset.favoriteId === pendingFavoriteFocusId,
        );
        (focusTarget || elements.resultCount).focus({ preventScroll: true });
        pendingFavoriteFocusId = null;
      }
    }

    function clickableSubjectTag(item) {
      if (!item.id) return plainTag(item.name, true);
      return button("tag tag--button", item.name, () => openEntity("subject", item.id, false));
    }

    function relatedDepartmentTag(name) {
      const department = catalog.departmentByName.get(name);
      if (!department) return plainTag(name);
      return button("tag tag--button", name, () => openEntity("department", department.id, false));
    }

    function subjectDetail(subjectId) {
      const subject = catalog.subjectPresentation(subjectId);
      if (!subject) return null;

      const container = document.createDocumentFragment();
      const header = node("header", "detail-header");
      header.append(
        node("p", "detail-header__meta", `${subject.group} · ${catalog.typeLabel(subject.type)}`),
        node("h2", "", subject.name),
        node("p", "detail-header__lead", subject.description),
      );
      if (!subject.hasRecoveredDetails) {
        header.append(
          node(
            "p",
            "recovery-note",
            "원본 파일이 중간에서 잘려 이 과목은 복구 가능한 분류 정보와 안전한 기본 안내만 표시합니다.",
          ),
        );
      }

      const grade = node("p", "", `${subject.credits} · ${subject.assessment}`);
      const prerequisite = node("p", "", subject.prerequisite);
      const departmentTags = subject.relatedDepartmentNames.length
        ? tagList(subject.relatedDepartmentNames, relatedDepartmentTag)
        : node("p", "", "복구된 관련 학과 정보가 없습니다.");
      const relatedTags = subject.relatedSubjects.length
        ? tagList(subject.relatedSubjects, clickableSubjectTag)
        : node("p", "", "관련 과목 정보가 없습니다.");
      const faq = textList(subject.faq);

      const grid = node("div", "detail-grid");
      grid.append(
        panel("학점 / 평가", grade),
        panel("선수과목·위계", prerequisite),
        panel("관련 학과", departmentTags, true),
        panel("같이 살펴볼 과목", relatedTags, true),
        panel("자주 묻는 내용", faq, true),
      );

      if (subject.sourceUrl) {
        const link = node("a", "source-link", subject.sourceUrl);
        link.href = subject.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        grid.append(panel("원문", link, true));
      }

      container.append(header, grid);
      return container;
    }

    function departmentDetail(departmentId) {
      const department = catalog.departmentPresentation(departmentId);
      if (!department) return null;

      const container = document.createDocumentFragment();
      const header = node("header", "detail-header");
      header.append(
        node("p", "detail-header__meta", `${department.category} · 학과 정보`),
        node("h2", "", department.name),
        node("p", "detail-header__lead", department.description),
      );

      const electives = node("div");
      department.electiveGroups.forEach((group) => {
        const groupSection = node("section", "elective-group");
        groupSection.append(node("h4", "", group.type));
        const tags = node("div", "tag-list");
        group.subjects.forEach((subject) =>
          tags.append(
            button("tag tag--button", subject.name, () => openEntity("subject", subject.id, false)),
          ),
        );
        (group.otherSubjects || []).forEach((name) => tags.append(plainTag(`${name} (원문 표기)`, true)));
        if (!tags.childElementCount) tags.append(node("p", "", "등록된 추천 과목이 없습니다."));
        groupSection.append(tags);
        electives.append(groupSection);
      });

      const curriculumTable = node("table", "curriculum-table");
      const tableBody = node("tbody");
      [
        ["기초 과목", department.curriculum.basic],
        ["심화 과목", department.curriculum.advanced],
      ].forEach(([label, values]) => {
        const row = node("tr");
        row.append(node("th", "", label), node("td", "", values.join(", ")));
        tableBody.append(row);
      });
      curriculumTable.append(tableBody);

      const grid = node("div", "detail-grid");
      grid.append(
        panel("📚 학과 관련 선택과목", electives, true),
        panel("🎯 졸업 후 진출 분야", textList(department.careers)),
        panel("📖 학과 주요 교과목", curriculumTable),
        panel("🏅 취득 가능 자격증", tagList(department.certificates, (item) => plainTag(item))),
        panel("📗 추천 도서", tagList(department.books, (item) => plainTag(item))),
        panel("🏫 주요 개설 대학", tagList(department.universities, (item) => plainTag(item)), true),
        panel("💡 학교생활 TIPS", textList(department.tips), true),
      );

      container.append(header, grid);
      return container;
    }

    function renderDetail(detail) {
      const key = `${detail.kind}:${detail.id}`;
      const content =
        detail.kind === "subject" ? subjectDetail(detail.id) : departmentDetail(detail.id);
      elements.detailContent.replaceChildren();

      if (!content) {
        elements.detailContent.append(emptyState("상세 정보를 찾을 수 없습니다", "데이터 ID를 확인해 주세요."));
      } else {
        elements.detailContent.append(content);
      }

      if (key !== lastDetailKey) {
        lastDetailKey = key;
        global.scrollTo({ top: 0, behavior: "auto" });
        global.requestAnimationFrame(() => elements.backButton.focus({ preventScroll: true }));
      }
    }

    function render(snapshot) {
      elements.tabs.forEach((tab) => {
        const active = tab.dataset.mode === snapshot.mode;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });

      if (elements.searchInput.value !== snapshot.query) elements.searchInput.value = snapshot.query;
      elements.typeFilter.value = snapshot.type;
      elements.groupFilter.value = snapshot.group;
      elements.departmentCategoryFilter.value = snapshot.departmentCategory;
      [...elements.groupButtons.querySelectorAll(".group-button")].forEach((groupButton) => {
        const active = groupButton.dataset.group === snapshot.group;
        groupButton.classList.toggle("is-active", active);
        groupButton.setAttribute("aria-pressed", String(active));
      });

      const showingDetail = Boolean(snapshot.detail);
      elements.listView.hidden = showingDetail;
      elements.detailView.hidden = !showingDetail;
      if (showingDetail) renderDetail(snapshot.detail);
      else {
        lastDetailKey = "";
        renderList(snapshot);
      }
    }

    function showError(error) {
      elements.listView.hidden = true;
      elements.detailView.hidden = true;
      elements.errorPanel.hidden = false;
      elements.errorMessage.textContent = error instanceof Error ? error.message : String(error);
    }

    initializeStaticContent();
    bindEvents();

    return Object.freeze({ render, showError });
  }

  namespace.createView = createView;
})(window);
