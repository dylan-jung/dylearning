---
name: resume-submit
description: 이력서 제출본 버저닝 워크플로우. 사용자가 "제출했어", "박제해줘", "태그 붙여줘", "제출본 목록", "제출본 복원" 이라고 하면 이 규칙을 따른다. 새 지원용 이력서를 만들 때의 경로 규칙도 여기 있다.
---

# 이력서 제출본 버저닝

이 레포의 이력서(`src/pages/resume/*.astro`, `src/content/cv/*.json`)는 지원 건마다 제출 시점을 git 태그로 박제한다. 제출본 파일을 나중에 수정해버려서 "내가 뭘 제출했는지" 잃어버리는 사고를 막기 위한 규칙이다 (2026-08 토스뱅크 제출본에서 실제로 발생).

## 규칙

1. **경로 = 지원 건.** 새 지원서는 새 경로로 만든다: `src/pages/resume/<회사>-<직무>.astro` (예: `tossbank-mlops.astro`). 기존 페이지를 복사해서 시작하고, 숫자 접미사(mlops2 같은 것)는 쓰지 않는다.
2. **제출 순간 태그.** 사용자가 제출했다고 하면 그 시점 커밋에 annotated 태그를 붙인다:
   ```bash
   git tag -a submit/<회사>-<직무>-<YYYYMMDD> <커밋> -m "<회사> <직무> 제출본 (/resume/<경로>)"
   git push origin submit/<회사>-<직무>-<YYYYMMDD>
   ```
   미커밋 변경이 있으면 먼저 커밋한 뒤 태그한다.
3. **제출 후 그 파일은 동결.** 사실 정정이든 뭐든 제출된 경로의 파일은 건드리지 않는다 (지원서에 URL이 들어갔을 수 있음). 이후 수정은 새 경로로 복사해서 진행한다. 전체 일괄 수정(예: 졸업 반영)에서도 동결된 제출본 파일은 제외한다.
4. **파일 상단 주석**에 제출 기록을 남긴다: `// YYYY-MM-DD <회사> <직무> 포지션에 이 버전으로 지원 제출.`

## 조회·복원

```bash
git tag -l "submit/*"                                  # 제출본 리스트
git show submit/<태그명>:src/pages/resume/<파일>       # 그 시점 파일 내용 보기
git checkout submit/<태그명> -- src/pages/resume/<파일> # 그 시점으로 파일 복원
```

## 현재 태그 현황 (2026-08-23 기준)

- `submit/tossbank-mlops-20260816` — 토스뱅크 ML Engineer(ML/LLM Ops), `/resume/mlops` (33fa516)
- `submit/lgai-mlops-20260823` — LG AI Platform&Infra MLOps Engineer, `/resume/mlops2` (실제 제출 표기는 8/19, 정정 반영 시점에 박제)

## 기존 경로 주의

`/resume/mlops`(토스뱅크)와 `/resume/mlops2`(LG)는 이미 지원서에 URL이 들어갔을 수 있으므로 **경로 변경·삭제 금지**. 새 규칙(1번)은 다음 지원부터 적용한다.
