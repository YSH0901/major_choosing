# 학과·선택과목 탐색기

첨부된 단일 HTML/TXT를 데이터·화면·동작·빌드 도구로 분리한 정적 웹 프로젝트입니다. 학과 이름이나 개수를 앱 코드에 넣지 않으므로, JSON 파일을 추가한 뒤 데이터 빌드만 하면 새 학과가 자동으로 반영됩니다.

## 바로 실행하기

가장 간단한 방법은 `index.html`을 더블클릭하는 것입니다. 편집용 JSON은 빌드된 `assets/js/catalog.bundle.js`에 포함되어 있어 `file://` 환경에서도 검색, 필터, 상세 보기, 즐겨찾기가 작동합니다.

로컬 서버로 확인하려면 다음 중 하나를 사용하세요.

- Windows: `실행.bat` 더블클릭
- 터미널: `npm start` 실행 후 <http://127.0.0.1:4173> 접속

외부 패키지는 사용하지 않으며 Node.js 18 이상만 있으면 됩니다.

## 새 학과 추가하기

1. `data/templates/department.example.json`을 복사합니다.
2. 복사본을 `data/departments/entries/새-id.json`으로 저장합니다.
3. `id`, `name`, `category`, 설명과 목록을 수정합니다. `category`는 기본적으로 `인문`, `사회`, `자연`, `공학` 중 하나를 사용합니다.
4. 추천 과목은 `data/subjects/`의 과목 `id`를 `subjectIds`에 넣습니다. 과목 ID로 연결할 수 없는 범주명이나 원문 표현은 `otherSubjects`에 넣을 수 있습니다.
5. `데이터_빌드.bat`를 더블클릭하거나 프로젝트 폴더에서 `npm run build:data`를 실행합니다.
6. `npm test`로 중복 ID와 누락 참조를 확인합니다.

학과 파일을 추가할 때 `index.html`, JavaScript 또는 별도 manifest를 수정할 필요가 없습니다. 빌드 도구가 `data/departments/entries/`의 JSON 파일을 자동 탐색합니다.

학과 계열의 표시 순서는 `data/site.json`의 `departmentCategoryOrder`에서 관리합니다. 새 계열을 만들 때는 이 배열에 이름을 추가하고 해당 학과 JSON의 `category`에 같은 값을 사용하세요. 화면의 계열 선택지는 데이터에서 자동 생성됩니다.

## 과목 데이터 수정하기

과목은 교과별로 `data/subjects/*.json`에 분리되어 있습니다. 각 과목은 안정적인 `id`를 가지며, 학과 추천 과목은 이 ID를 참조합니다. 과목 이름을 바꿔도 ID를 유지하면 학과 연결은 깨지지 않습니다.

상세정보가 있는 과목은 같은 레코드의 `details`에 학점, 평가, 설명, 선수과목, 관련 학과·과목, 출처, FAQ를 보관합니다. 수정 후에는 항상 아래 명령을 실행하세요.

```text
npm run build:data
npm test
```

`assets/js/catalog.bundle.js`는 자동 생성 파일이므로 직접 편집하지 마세요.

## 파일 구조

```text
major-subject-explorer/
├─ index.html
├─ 실행.bat
├─ 데이터_빌드.bat
├─ package.json
├─ assets/
│  ├─ css/app.css
│  └─ js/
│     ├─ catalog.bundle.js   # JSON에서 자동 생성
│     ├─ catalog.js          # 조회·검색·관계 해석
│     ├─ storage.js          # 즐겨찾기 저장
│     ├─ state.js            # 화면 상태
│     ├─ view.js             # 안전한 DOM 렌더링
│     └─ app.js              # 앱 시작 및 연결
├─ data/
│  ├─ site.json
│  ├─ subjects/              # 교과별 과목 JSON
│  ├─ departments/entries/   # 학과별 JSON
│  └─ templates/             # 새 학과 예시
├─ scripts/
│  ├─ build-data.mjs         # 자동 탐색·검증·번들 생성
│  ├─ catalog-tools.mjs
│  └─ serve.mjs
└─ tests/catalog.test.mjs
```

## 데이터 이관 범위

첨부 TXT는 `동아시아 역사 기행` 상세정보 문자열 중간에서 끝나고, 닫는 HTML 태그와 모든 동작 함수가 누락된 불완전한 파일이었습니다. 따라서 추측으로 유실 내용을 채우지 않고 다음 범위만 이관했습니다.

- 선택과목 183개: 모두 복구
- 최초 파일의 학과 7개: 모두 복구
- 이후 추가 자료의 신규 학과 113개: 모두 추가
- 현재 학과 합계: 120개
- 완전한 과목 상세 48개: 모두 복구
- 나머지 과목 상세 135개: 원본에 없음을 명시하는 기본 안내 표시

추가 자료에는 기존 학과와 이름이 같은 `화학공학과`, `신소재공학과`, `컴퓨터공학과`가 있었으나 내용이 서로 달라 자동 덮어쓰기하지 않고 기존 데이터를 유지했습니다. 학과 수는 이름과 ID를 기준으로 중복 없이 계산합니다.

화면의 과목·학과·공식/사용자 추가·즐겨찾기 개수와 교과·유형 필터는 데이터에서 자동 계산됩니다. 학과 추천 과목 중 로마 숫자·구두점·명백한 오탈자처럼 의미가 분명한 표기 차이(`미적분 I`/`미적분Ⅰ` 등)는 기존 과목 ID로 연결했습니다. 동일 과목이라고 단정하기 어려운 `영어 회화`, `세포와 생명`, `매체`와 목록에 없는 `프로그래밍`, `정보사회와 윤리` 등은 원문 그대로 `otherSubjects`에 보존했습니다.

동적 콘텐츠는 `innerHTML`이 아니라 DOM 노드와 `textContent`로 렌더링하며, 외부 링크는 HTTP/HTTPS만 허용합니다.
