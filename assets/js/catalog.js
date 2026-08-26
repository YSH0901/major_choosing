(function (global) {
  "use strict";

  const namespace = (global.Explorer = global.Explorer || {});

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFC")
      .toLocaleLowerCase("ko-KR")
      .replace(/\s+/g, " ")
      .trim();
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function validWebUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function createCatalog(rawData) {
    if (!rawData || !rawData.site || !Array.isArray(rawData.subjects) || !Array.isArray(rawData.departments)) {
      throw new Error("생성된 데이터 번들을 찾을 수 없습니다. npm run build:data를 실행해 주세요.");
    }

    const groupOrder = rawData.site.subjectGroupOrder || [];
    const groupRank = new Map(groupOrder.map((group, index) => [group, index]));
    const departmentCategoryOrder = rawData.site.departmentCategoryOrder || [];
    const departmentCategoryRank = new Map(
      departmentCategoryOrder.map((category, index) => [category, index]),
    );
    const subjects = [...rawData.subjects].sort((left, right) => {
      const groupDifference =
        (groupRank.get(left.group) ?? Number.MAX_SAFE_INTEGER) -
        (groupRank.get(right.group) ?? Number.MAX_SAFE_INTEGER);
      if (groupDifference !== 0) return groupDifference;
      return left.id.localeCompare(right.id, "en");
    });
    const departments = [...rawData.departments].sort((left, right) => {
      const categoryDifference =
        (departmentCategoryRank.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
        (departmentCategoryRank.get(right.category) ?? Number.MAX_SAFE_INTEGER);
      if (categoryDifference !== 0) return categoryDifference;
      return left.name.localeCompare(right.name, "ko");
    });
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const subjectByName = new Map(subjects.map((subject) => [subject.name, subject]));
    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const departmentByName = new Map(departments.map((department) => [department.name, department]));
    const groups = unique([...groupOrder, ...subjects.map((subject) => subject.group)]);
    const discoveredTypes = unique(subjects.map((subject) => subject.type));
    const types = unique([...(rawData.site.subjectTypeOrder || []), ...discoveredTypes]);
    const usedDepartmentCategories = new Set(departments.map((department) => department.category));
    const departmentCategories = unique([
      ...departmentCategoryOrder.filter((category) => usedDepartmentCategories.has(category)),
      ...departments.map((department) => department.category),
    ]);

    const departmentSearchText = new Map(
      departments.map((department) => {
        const recommendationNames = department.electiveGroups.flatMap((group) => [
          ...group.subjectIds.map((id) => subjectById.get(id)?.name),
          ...(group.otherSubjects || []),
        ]);
        return [
          department.id,
          normalizeText(
            [
              department.name,
              department.category,
              department.description,
              ...department.careers,
              ...department.certificates,
              ...recommendationNames,
            ].join(" "),
          ),
        ];
      }),
    );

    function typeLabel(type) {
      return type === "공통대체" ? "공통 대체" : `${type} 선택`;
    }

    function subjectMatches(subject, query) {
      if (!query) return true;
      return normalizeText([subject.name, subject.group, typeLabel(subject.type)].join(" ")).includes(query);
    }

    function filterSubjects({ query = "", type = "all", group = "all", favoriteIds = null } = {}) {
      const normalizedQuery = normalizeText(query);
      return subjects.filter(
        (subject) =>
          (favoriteIds === null || favoriteIds.has(subject.id)) &&
          (type === "all" || subject.type === type) &&
          (group === "all" || subject.group === group) &&
          subjectMatches(subject, normalizedQuery),
      );
    }

    function filterDepartments(options = {}) {
      const query = typeof options === "string" ? options : options.query ?? "";
      const category = typeof options === "string" ? "all" : options.category ?? "all";
      const normalizedQuery = normalizeText(query);
      return departments.filter(
        (department) =>
          (category === "all" || department.category === category) &&
          (!normalizedQuery || departmentSearchText.get(department.id).includes(normalizedQuery)),
      );
    }

    function suggestions(query, limit = 8) {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return [];

      const subjectResults = subjects
        .filter((subject) => subjectMatches(subject, normalizedQuery))
        .slice(0, Math.ceil(limit / 2))
        .map((subject) => ({
          kind: "subject",
          id: subject.id,
          name: subject.name,
          meta: `${subject.group} · ${typeLabel(subject.type)}`,
        }));
      const remaining = Math.max(0, limit - subjectResults.length);
      const departmentResults = departments
        .filter((department) => departmentSearchText.get(department.id).includes(normalizedQuery))
        .slice(0, remaining)
        .map((department) => ({
          kind: "department",
          id: department.id,
          name: department.name,
          meta: `${department.category} · 학과`,
        }));

      return [...subjectResults, ...departmentResults];
    }

    function reverseRelatedDepartments(subjectId) {
      return departments
        .filter((department) =>
          department.electiveGroups.some((group) => group.subjectIds.includes(subjectId)),
        )
        .map((department) => department.name);
    }

    function subjectPresentation(subjectId) {
      const subject = subjectById.get(subjectId);
      if (!subject) return null;

      const details = subject.details;
      const relatedDepartmentNames = unique([
        ...(details?.relatedDepartmentNames || []),
        ...reverseRelatedDepartments(subject.id),
      ]);
      const fallbackRelatedSubjects = subjects
        .filter((candidate) => candidate.group === subject.group && candidate.id !== subject.id)
        .slice(0, 10)
        .map((candidate) => candidate.name);
      const relatedSubjectNames = unique(
        details?.relatedSubjectNames?.length ? details.relatedSubjectNames : fallbackRelatedSubjects,
      );

      return {
        ...subject,
        hasRecoveredDetails: Boolean(details),
        credits: details?.credits || "학교별 편성 기준 확인",
        assessment: details?.assessment || "학교·학년도별 평가 방식 확인",
        description:
          details?.description ||
          "첨부 원본이 중간에서 끊겨 이 과목의 상세 설명은 복구되지 않았습니다. 과목명과 교과·선택 유형 정보는 정상적으로 보존되었습니다.",
        prerequisite:
          details?.prerequisite || "복구된 원본에 선수과목 정보가 없습니다. 실제 선택 전 학교 안내를 확인하세요.",
        relatedDepartmentNames,
        relatedSubjects: relatedSubjectNames.map((name) => ({
          name,
          id: subjectByName.get(name)?.id || null,
        })),
        sourceUrl: validWebUrl(details?.sourceUrl),
        faq:
          details?.faq?.length
            ? details.faq
            : [
                "학교와 학년도에 따라 학점·평가·개설 여부가 달라질 수 있습니다.",
                "첨부 원본에 이 과목의 상세 항목이 포함되지 않아 기본 안내를 표시하고 있습니다.",
              ],
      };
    }

    function departmentPresentation(departmentId) {
      const department = departmentById.get(departmentId);
      if (!department) return null;

      return {
        ...department,
        electiveGroups: department.electiveGroups.map((group) => ({
          ...group,
          subjects: group.subjectIds
            .map((id) => subjectById.get(id))
            .filter(Boolean),
        })),
      };
    }

    const originCounts = subjects.reduce(
      (counts, subject) => {
        counts[subject.origin] = (counts[subject.origin] || 0) + 1;
        return counts;
      },
      { official: 0, custom: 0 },
    );

    return Object.freeze({
      site: rawData.site,
      subjects,
      departments,
      groups,
      types,
      departmentCategories,
      subjectById,
      departmentById,
      departmentByName,
      originCounts,
      normalizeText,
      typeLabel,
      filterSubjects,
      filterDepartments,
      suggestions,
      subjectPresentation,
      departmentPresentation,
    });
  }

  namespace.createCatalog = createCatalog;
})(window);
