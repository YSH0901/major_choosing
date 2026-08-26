import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(projectRoot, filePath)}: ${error.message}`);
  }
}

async function jsonFiles(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export async function loadSourceCatalog() {
  const subjectDirectory = path.join(projectRoot, "data", "subjects");
  const departmentDirectory = path.join(projectRoot, "data", "departments", "entries");
  const site = await readJson(path.join(projectRoot, "data", "site.json"));
  const subjects = (await Promise.all((await jsonFiles(subjectDirectory)).map(readJson))).flat();
  const departments = await Promise.all((await jsonFiles(departmentDirectory)).map(readJson));

  return { site, subjects, departments };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, field, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${field}: 배열이어야 합니다.`);
    return;
  }

  if (!allowEmpty && value.length === 0) {
    errors.push(`${field}: 한 개 이상의 값이 필요합니다.`);
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) errors.push(`${field}[${index}]: 비어 있지 않은 문자열이어야 합니다.`);
  });

  if (new Set(value).size !== value.length) {
    errors.push(`${field}: 중복 값이 있습니다.`);
  }
}

function validateUrl(value, field, errors) {
  try {
    const url = new URL(value);
    if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("unsupported protocol");
  } catch {
    errors.push(`${field}: http/https URL이어야 합니다.`);
  }
}

export function validateCatalog(catalog) {
  const { site, subjects, departments } = catalog;
  const errors = [];
  const warnings = [];
  const allowedTypes = new Set(site.subjectTypeOrder ?? []);
  const allowedDepartmentCategories = new Set(site.departmentCategoryOrder ?? []);
  const subjectIds = new Set();
  const subjectNames = new Set();
  const departmentIds = new Set();
  const departmentNames = new Set();
  let unlinkedRecommendationCount = 0;

  if (!Number.isInteger(site.schemaVersion) || site.schemaVersion < 1) {
    errors.push("site.schemaVersion: 1 이상의 정수여야 합니다.");
  }

  for (const field of ["title", "curriculumLabel", "description", "footer", "favoriteStorageKey"]) {
    if (!isNonEmptyString(site[field])) errors.push(`site.${field}: 비어 있지 않은 문자열이어야 합니다.`);
  }
  validateStringArray(site.subjectTypeOrder, "site.subjectTypeOrder", errors, { allowEmpty: false });
  validateStringArray(site.subjectGroupOrder, "site.subjectGroupOrder", errors, { allowEmpty: false });
  validateStringArray(site.departmentCategoryOrder, "site.departmentCategoryOrder", errors, {
    allowEmpty: false,
  });

  subjects.forEach((subject, index) => {
    const field = `subjects[${index}]`;
    if (!isNonEmptyString(subject.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subject.id)) {
      errors.push(`${field}.id: 영문 소문자·숫자·하이픈으로 만든 ID가 필요합니다.`);
    } else if (subjectIds.has(subject.id)) {
      errors.push(`${field}.id: 중복 ID '${subject.id}'입니다.`);
    } else {
      subjectIds.add(subject.id);
    }

    if (!isNonEmptyString(subject.name)) {
      errors.push(`${field}.name: 비어 있지 않은 문자열이어야 합니다.`);
    } else if (subjectNames.has(subject.name)) {
      errors.push(`${field}.name: 중복 과목명 '${subject.name}'입니다.`);
    } else {
      subjectNames.add(subject.name);
    }

    if (!isNonEmptyString(subject.group)) errors.push(`${field}.group: 비어 있지 않은 문자열이어야 합니다.`);
    if (!allowedTypes.has(subject.type)) errors.push(`${field}.type: 허용되지 않은 값 '${subject.type}'입니다.`);
    if (!["official", "custom"].includes(subject.origin)) {
      errors.push(`${field}.origin: official 또는 custom이어야 합니다.`);
    }

    if (subject.details !== undefined) {
      const detail = subject.details;
      for (const detailField of ["credits", "assessment", "description", "prerequisite"]) {
        if (!isNonEmptyString(detail[detailField])) {
          errors.push(`${field}.details.${detailField}: 비어 있지 않은 문자열이어야 합니다.`);
        }
      }
      validateStringArray(detail.relatedDepartmentNames, `${field}.details.relatedDepartmentNames`, errors);
      validateStringArray(detail.relatedSubjectNames, `${field}.details.relatedSubjectNames`, errors);
      validateStringArray(detail.faq, `${field}.details.faq`, errors);
      validateUrl(detail.sourceUrl, `${field}.details.sourceUrl`, errors);
    }

    for (const textField of [subject.id, subject.name, subject.group]) {
      if (isNonEmptyString(textField) && textField !== textField.normalize("NFC")) {
        errors.push(`${field}: Unicode NFC 정규화가 필요합니다.`);
        break;
      }
    }
  });

  departments.forEach((department, index) => {
    const field = `departments[${index}]`;
    if (!isNonEmptyString(department.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(department.id)) {
      errors.push(`${field}.id: 영문 소문자·숫자·하이픈으로 만든 ID가 필요합니다.`);
    } else if (departmentIds.has(department.id)) {
      errors.push(`${field}.id: 중복 ID '${department.id}'입니다.`);
    } else {
      departmentIds.add(department.id);
    }

    if (!isNonEmptyString(department.name)) {
      errors.push(`${field}.name: 비어 있지 않은 문자열이어야 합니다.`);
    } else if (departmentNames.has(department.name)) {
      errors.push(`${field}.name: 중복 학과명 '${department.name}'입니다.`);
    } else {
      departmentNames.add(department.name);
    }

    if (!isNonEmptyString(department.description)) {
      errors.push(`${field}.description: 비어 있지 않은 문자열이어야 합니다.`);
    }

    if (!isNonEmptyString(department.category)) {
      errors.push(`${field}.category: 비어 있지 않은 문자열이어야 합니다.`);
    } else if (!allowedDepartmentCategories.has(department.category)) {
      errors.push(`${field}.category: 허용되지 않은 값 '${department.category}'입니다.`);
    }

    if (!Array.isArray(department.electiveGroups) || department.electiveGroups.length === 0) {
      errors.push(`${field}.electiveGroups: 한 개 이상의 선택과목 그룹이 필요합니다.`);
    } else {
      department.electiveGroups.forEach((group, groupIndex) => {
        const groupField = `${field}.electiveGroups[${groupIndex}]`;
        if (!group || typeof group !== "object" || Array.isArray(group)) {
          errors.push(`${groupField}: 객체여야 합니다.`);
          return;
        }
        if (!isNonEmptyString(group.type)) errors.push(`${groupField}.type: 비어 있지 않은 문자열이어야 합니다.`);
        validateStringArray(group.subjectIds, `${groupField}.subjectIds`, errors);
        if (Array.isArray(group.subjectIds)) {
          group.subjectIds.forEach((subjectId) => {
            if (!subjectIds.has(subjectId)) errors.push(`${groupField}.subjectIds: 없는 과목 ID '${subjectId}'입니다.`);
          });
        }
        if (group.otherSubjects !== undefined) {
          validateStringArray(group.otherSubjects, `${groupField}.otherSubjects`, errors);
          if (Array.isArray(group.otherSubjects)) {
            unlinkedRecommendationCount += group.otherSubjects.length;
          }
        }
      });
    }

    if (!department.curriculum || typeof department.curriculum !== "object") {
      errors.push(`${field}.curriculum: 객체가 필요합니다.`);
    } else {
      validateStringArray(department.curriculum.basic, `${field}.curriculum.basic`, errors);
      validateStringArray(department.curriculum.advanced, `${field}.curriculum.advanced`, errors);
    }

    for (const listField of ["books", "certificates", "tips", "careers", "universities"]) {
      validateStringArray(department[listField], `${field}.${listField}`, errors);
    }

    for (const textField of [department.id, department.name, department.category]) {
      if (isNonEmptyString(textField) && textField !== textField.normalize("NFC")) {
        errors.push(`${field}: Unicode NFC 정규화가 필요합니다.`);
        break;
      }
    }
  });

  const detailsCount = subjects.filter((subject) => subject.details).length;
  if (unlinkedRecommendationCount > 0) {
    warnings.push(
      `과목 ID로 연결할 수 없는 범주명·원문 추천 ${unlinkedRecommendationCount}건은 원문 표기로 보존됩니다.`,
    );
  }
  if (detailsCount < subjects.length) {
    warnings.push(`원본 절단으로 ${subjects.length - detailsCount}개 과목은 기본 상세 안내를 사용합니다.`);
  }

  return { errors, warnings };
}

export function serializeCatalogBundle(catalog) {
  const json = JSON.stringify(catalog, null, 2)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

  return `/* 자동 생성 파일입니다. data/ 아래 JSON을 수정한 뒤 npm run build:data를 실행하세요. */\n(function (global) {\n  "use strict";\n  global.__EXPLORER_DATA__ = ${json};\n})(window);\n`;
}
