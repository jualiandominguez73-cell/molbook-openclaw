# AGENTS.md - ko 문서 작업 가이드

## Read When

- `docs/ko/**`를 수정할 때
- 한국어 번역 용어/일관성을 맞출 때

## 현재 범위

- 초기 한국어 번역 부트스트랩 상태
- 우선 번역 문서:
  - `docs/ko/index.md`
  - `docs/ko/start/getting-started.md`
  - `docs/ko/start/hubs.md`

## 번역 파이프라인 자산

- 용어집: `docs/.i18n/glossary.ko.json`
- TM 파일: `docs/.i18n/ko.tm.jsonl`

## 스타일 가이드

- 핵심 제품명은 영문 유지: `OpenClaw`, `Control UI`, `Gateway`
- 코드/명령어는 원문 유지
- 문장 내 기술 용어는 한국어+영문 병기 가능
  - 예: `Gateway(게이트웨이)`, `pairing(페어링)`

## 기여 팁

- 한 PR에서 범위를 작게 유지하세요.
- 새 번역 문서를 추가했다면 `docs/docs.json`의 `ko` 섹션에 페이지를 연결하세요.
