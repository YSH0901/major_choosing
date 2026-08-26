import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  loadSourceCatalog,
  projectRoot,
  serializeCatalogBundle,
  validateCatalog,
} from "../scripts/catalog-tools.mjs";

test("복구·추가한 데이터 개수와 ID가 유효하다", async () => {
  const catalog = await loadSourceCatalog();
  const validation = validateCatalog(catalog);

  assert.deepEqual(validation.errors, []);
  assert.ok(catalog.subjects.length >= 183);
  assert.ok(catalog.departments.length >= 120);
  assert.ok(catalog.subjects.filter((subject) => subject.details).length >= 48);
  assert.equal(new Set(catalog.subjects.map((subject) => subject.id)).size, catalog.subjects.length);
  assert.equal(
    new Set(catalog.departments.map((department) => department.id)).size,
    catalog.departments.length,
  );
  assert.ok(catalog.subjects.some((subject) => subject.id === "korean-001"));
  assert.ok(catalog.departments.some((department) => department.id === "mechanical-engineering"));
  assert.ok(catalog.departments.some((department) => department.id === "philosophy"));
  assert.ok(catalog.departments.some((department) => department.id === "atmospheric-science"));
  assert.ok(catalog.departments.some((department) => department.id === "fine-arts"));
  assert.ok(catalog.departments.some((department) => department.id === "education"));
  assert.ok(catalog.departments.some((department) => department.id === "pre-korean-medicine"));
});

test("모든 학과의 과목 ID 참조가 실제 과목을 가리킨다", async () => {
  const catalog = await loadSourceCatalog();
  const subjectIds = new Set(catalog.subjects.map((subject) => subject.id));
  const references = catalog.departments.flatMap((department) =>
    department.electiveGroups.flatMap((group) => group.subjectIds),
  );

  assert.ok(references.length > 0);
  assert.deepEqual(
    references.filter((id) => !subjectIds.has(id)),
    [],
  );
});

test("모든 학과가 허용된 한 개의 계열에 속한다", async () => {
  const catalog = await loadSourceCatalog();
  const allowedCategories = new Set(catalog.site.departmentCategoryOrder);
  const categoryCounts = Object.fromEntries(
    catalog.site.departmentCategoryOrder.map((category) => [
      category,
      catalog.departments.filter((department) => department.category === category).length,
    ]),
  );

  assert.ok(catalog.departments.every((department) => allowedCategories.has(department.category)));
  assert.deepEqual(categoryCounts, {
    인문: 7,
    사회: 27,
    자연: 16,
    공학: 33,
    교육: 10,
    의약: 10,
    예체능: 17,
  });
});

test("누락되거나 허용되지 않은 학과 계열은 검증 오류가 된다", async () => {
  const missingCategory = structuredClone(await loadSourceCatalog());
  delete missingCategory.departments[0].category;
  assert.ok(
    validateCatalog(missingCategory).errors.some((error) =>
      error.includes("category: 비어 있지 않은 문자열이어야 합니다"),
    ),
  );

  const unknownCategory = structuredClone(await loadSourceCatalog());
  unknownCategory.departments[0].category = "미등록 계열";
  assert.ok(
    validateCatalog(unknownCategory).errors.some((error) =>
      error.includes("category: 허용되지 않은 값 '미등록 계열'"),
    ),
  );
});

test("복합 원문의 일반·진로 선택 경계를 보존한다", async () => {
  const catalog = await loadSourceCatalog();
  const department = catalog.departments.find(({ id }) => id === "atmospheric-science");
  const general = department.electiveGroups.find(({ type }) => type === "일반 선택");
  const career = department.electiveGroups.find(({ type }) => type === "진로 선택");

  assert.ok(general.subjectIds.includes("mathematics-003"));
  assert.ok(!general.subjectIds.includes("mathematics-006"));
  assert.ok(career.subjectIds.includes("mathematics-006"));
  assert.ok(!career.subjectIds.includes("mathematics-003"));
});

test("새 자료의 오타는 안전하게 연결하고 모호한 과목명은 원문으로 보존한다", async () => {
  const catalog = await loadSourceCatalog();
  const videoDesign = catalog.departments.find(({ id }) => id === "video-design");
  const emergencyMedicalServices = catalog.departments.find(
    ({ id }) => id === "emergency-medical-services",
  );
  const nursing = catalog.departments.find(({ id }) => id === "nursing");
  const broadcasting = catalog.departments.find(({ id }) => id === "broadcasting-entertainment");

  assert.ok(
    videoDesign.electiveGroups.some((group) => group.subjectIds.includes("informatics-002")),
  );
  assert.ok(
    emergencyMedicalServices.electiveGroups.some((group) =>
      group.subjectIds.includes("social-studies-012"),
    ),
  );
  assert.ok(
    nursing.electiveGroups.some((group) => group.otherSubjects?.includes("인간과 환경")),
  );
  assert.ok(broadcasting.curriculum.advanced.includes("엔터테인먼트비즈니스2"));
  assert.ok(!broadcasting.curriculum.advanced.includes("2"));
});

test("새 학과 파일을 추가해도 검증과 테스트 기준이 확장된다", async () => {
  const catalog = structuredClone(await loadSourceCatalog());
  const originalDepartmentCount = catalog.departments.length;
  const addedDepartment = structuredClone(catalog.departments[0]);
  addedDepartment.id = "new-example-department";
  addedDepartment.name = "새 예시학과";
  catalog.departments.push(addedDepartment);

  assert.deepEqual(validateCatalog(catalog).errors, []);
  assert.equal(catalog.departments.length, originalDepartmentCount + 1);
});

test("잘못된 학과 배열 필드는 중단되지 않고 검증 오류로 안내한다", async () => {
  const catalog = structuredClone(await loadSourceCatalog());
  catalog.departments[0].electiveGroups[0].subjectIds = "mathematics-001";
  catalog.departments[0].electiveGroups[0].otherSubjects = null;

  const validation = validateCatalog(catalog);
  assert.ok(validation.errors.some((error) => error.includes("subjectIds: 배열이어야 합니다")));
  assert.ok(validation.errors.some((error) => error.includes("otherSubjects: 배열이어야 합니다")));
});

test("생성 번들은 최신 편집용 JSON과 정확히 일치한다", async () => {
  const bundle = await readFile(path.join(projectRoot, "assets", "js", "catalog.bundle.js"), "utf8");
  const sourceCatalog = await loadSourceCatalog();
  assert.equal(bundle, serializeCatalogBundle(sourceCatalog));

  const context = vm.createContext({ window: {} });
  vm.runInContext(bundle, context, { filename: "catalog.bundle.js" });

  assert.equal(context.window.__EXPLORER_DATA__.subjects.length, sourceCatalog.subjects.length);
  assert.equal(context.window.__EXPLORER_DATA__.departments.length, sourceCatalog.departments.length);
});

test("카탈로그 검색·필터·상세 기본값이 동작한다", async () => {
  const [bundle, catalogScript] = await Promise.all([
    readFile(path.join(projectRoot, "assets", "js", "catalog.bundle.js"), "utf8"),
    readFile(path.join(projectRoot, "assets", "js", "catalog.js"), "utf8"),
  ]);
  const context = vm.createContext({ URL, window: {} });
  vm.runInContext(bundle, context, { filename: "catalog.bundle.js" });
  vm.runInContext(catalogScript, context, { filename: "catalog.js" });

  const catalog = context.window.Explorer.createCatalog(context.window.__EXPLORER_DATA__);
  assert.ok(catalog.filterSubjects({ query: "인공지능" }).length >= 2);
  assert.equal(catalog.filterSubjects({ type: "공통대체" }).length, 2);
  assert.ok(catalog.filterDepartments("반도체").length >= 2);
  assert.deepEqual(Array.from(catalog.departmentCategories), [
    "인문",
    "사회",
    "자연",
    "공학",
    "교육",
    "의약",
    "예체능",
  ]);
  assert.equal(catalog.filterDepartments({ category: "인문" }).length, 7);
  assert.equal(catalog.filterDepartments({ category: "교육" }).length, 10);
  assert.equal(catalog.filterDepartments({ category: "의약" }).length, 10);
  assert.equal(catalog.filterDepartments({ category: "예체능" }).length, 17);
  assert.equal(catalog.filterDepartments({ category: "all" }).length, 120);
  assert.equal(catalog.filterDepartments({ query: "국어국문학과", category: "인문" }).length, 1);
  assert.equal(catalog.filterDepartments({ query: "국어국문학과", category: "자연" }).length, 0);
  assert.equal(catalog.subjectPresentation("korean-003").hasRecoveredDetails, true);
  assert.equal(catalog.subjectPresentation("liberal-arts-010").hasRecoveredDetails, false);
  assert.equal(catalog.departmentPresentation("computer-engineering").name, "컴퓨터공학과");
  assert.equal(catalog.departmentPresentation("computer-engineering").category, "공학");
});

test("학과 계열 상태를 설정하고 초기화할 수 있다", async () => {
  const stateScript = await readFile(path.join(projectRoot, "assets", "js", "state.js"), "utf8");
  const context = vm.createContext({ window: {} });
  vm.runInContext(stateScript, context, { filename: "state.js" });
  const state = context.window.Explorer.createState([]);

  state.setDepartmentCategory("자연");
  assert.equal(state.get().departmentCategory, "자연");
  state.resetFilters();
  assert.equal(state.get().departmentCategory, "all");
});

test("HTML은 인라인 이벤트와 하드코딩된 데이터 개수를 사용하지 않는다", async () => {
  const [html, viewScript] = await Promise.all([
    readFile(path.join(projectRoot, "index.html"), "utf8"),
    readFile(path.join(projectRoot, "assets", "js", "view.js"), "utf8"),
  ]);
  assert.doesNotMatch(html, /\son(?:click|change|input|keydown)=/i);
  assert.doesNotMatch(html, /181개|183개|7개 학과/);
  assert.match(html, /assets\/js\/catalog\.bundle\.js/);
  assert.match(html, /assets\/css\/app\.css/);
  assert.match(html, /id="departmentCategoryFilter"/);
  assert.ok(!viewScript.includes(["상세", "복구됨"].join(" ")));
  assert.match(viewScript, /기본 안내/);
});
