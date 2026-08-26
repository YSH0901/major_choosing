import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadSourceCatalog,
  projectRoot,
  serializeCatalogBundle,
  validateCatalog,
} from "./catalog-tools.mjs";

const checkOnly = process.argv.includes("--check-only");
const catalog = await loadSourceCatalog();
const { errors, warnings } = validateCatalog(catalog);

for (const warning of warnings) console.warn(`주의: ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`오류: ${error}`);
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(
    `데이터 검증 완료: 과목 ${catalog.subjects.length}개, 학과 ${catalog.departments.length}개`,
  );
} else {
  const outputDirectory = path.join(projectRoot, "assets", "js");
  const outputPath = path.join(outputDirectory, "catalog.bundle.js");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, serializeCatalogBundle(catalog), "utf8");
  console.log(
    `데이터 빌드 완료: 과목 ${catalog.subjects.length}개, 학과 ${catalog.departments.length}개 → ${path.relative(projectRoot, outputPath)}`,
  );
}
