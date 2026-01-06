---
title: Flyway?
timestamp: 2025-12-08
toc: true
tags:
  - learn/howto
  - tech/db
  - tech/backend
---

# Flyway?

서비스를 실제로 운영하기 위해서 데이터베이스의 데이터 모델(Schema)을 추적하고 관리하는 것은 매우 중요하다. 애플리케이션 코드는 Git으로 버전 관리가 되는데, 정작 그 코드가 의존하는 데이터베이스 스키마가 버전 관리되지 않는다면 어떤 일이 벌어질까?

## 왜 데이터베이스 형상 관리가 중요할까?

**"제 로컬에서는 잘 되는데요?"**

개발자라면 한 번쯤 겪어봤을 상황이다. 코드는 최신 버전으로 배포되었는데, 운영 DB에는 새로운 테이블이나 컬럼이 추가되지 않아 에러가 발생하는 경우다.

데이터베이스 형상 관리가 중요한 이유는 다음과 같다.

1.  **일관성 유지**: 개발, 테스트, 운영 환경의 데이터베이스 스키마를 항상 동일한 상태(또는 의도된 버전)로 유지할 수 있다.
2.  **이력 추적**: 언제, 누가, 어떤 목적으로 스키마를 변경했는지 Git 로그처럼 확인할 수 있다.
3.  **협업과 브랜치 전략**: 여러 개발자가 동시에 기능을 개발할 때, Flyway는 강력한 장점을 발휘한다.
    -   각자 로컬에서 서로 다른 마이그레이션 파일(`V3__feature_a.sql`, `V3__feature_b.sql`)을 생성하더라도, Git Merge 과정에서 파일명 충돌이나 버전 번호 중복을 통해 문제를 조기에 발견할 수 있다.
    -   CI 단계에서 마이그레이션을 테스트하며 서로 호환되지 않는 스키마 변경을 사전에 차단할 수 있다.
4.  **자동화**: 배포 파이프라인(CI/CD)에 마이그레이션 단계를 포함시켜, 수동으로 SQL을 실행할 때 발생하는 휴먼 에러를 방지할 수 있다.

## 다른 생태계에서는?

언어와 프레임워크마다 선호하는 방식은 조금씩 다르지만, 목표는 같다.

-   **JavaScript/TypeScript (Prisma)**: Prisma는 `schema.prisma`라는 파일에 모델을 정의하면, 이를 기반으로 마이그레이션 파일을 생성하고 관리한다. "선언적"인 성격이 강하며, 스키마 파일 자체가 진실의 원천(Source of Truth)이 된다.
-   **Python (SQLAlchemy/Alembic)**: Python 진영, 특히 SQLAlchemy를 사용할 때는 Alembic이라는 도구를 많이 사용한다. 파이썬 코드로 마이그레이션 스크립트(Upgrade/Downgrade 로직)를 작성하여 변경 사항을 추적한다.

그렇다면 **Spring Boot** 생태계에서는 무엇을 사용할까? 바로 **Flyway**다.

---

# 시나리오로 알아보는 Flyway 사용법

Flyway는 "데이터베이스를 위한 Git"이라고 불리기도 한다. 복잡한 설정 없이 SQL 파일만으로 버전을 관리할 수 있어 Spring Boot와 찰떡궁합을 자랑한다.

우리가 **"회원(Member) 서비스"**를 개발한다고 가정하고, 실제 개발 흐름을 따라가며 Flyway를 적용해보자.

## 0. 준비하기 (Dependencies)

가장 먼저 `build.gradle`에 의존성을 추가해야 한다. Spring Boot를 사용한다면 스타터 패키지 덕분에 매우 간단하다.

설정(`application.yml`)도 잊지 말자.

```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true # 기존 데이터가 있는 DB에 처음 적용할 때 필요하다
```

## Scenario 1: 서비스 런칭 (V1 - 최초 스키마)

회원 가입 기능을 위해 `member` 테이블이 필요하다.
Flyway의 기본 경로는 `src/main/resources/db/migration`이다. 여기에 첫 번째 마이그레이션 파일을 만든다.

**파일명**: `V1__init_member_table.sql`
> **주의**: `V` 다음에 오는 숫자(1)는 버전이다. 그리고 언더스코어(`_`)는 **반드시 두 개**여야 한다.

```sql
-- V1__init_member_table.sql
CREATE TABLE member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

이제 애플리케이션을 실행(`BootRun`)하면, Flyway가 `flyway_schema_history` 테이블을 확인하고 `V1` 스크립트를 실행해 테이블을 생성한다.

## Scenario 2: 요구사항 변경 (V2 - 컬럼 추가)

서비스를 운영하던 중, 기획 팀에서 **"회원 닉네임 기능이 필요해요!"** 라는 요청이 들어왔다.
기존 테이블을 `DROP`하고 다시 만들 수는 없다. 이미 가입한 회원 데이¡터가 있기 때문이다. 이럴 때 새로운 버전을 추가한다.

**파일명**: `V2__add_nickname_column.sql`

```sql
-- V2__add_nickname_column.sql
ALTER TABLE member ADD COLUMN nickname VARCHAR(50);
```

다시 애플리케이션을 실행하면, Flyway는 `V1`은 이미 실행되었음을 알고 건너뛰고, `V2`만 안전하게 실행한다.

## Scenario 3: 실수 수정하기 (V3 - 실패와 복구)

개발하다 보면 실수를 하기 마련이다. 만약 `V3` 스크립트에 오타가 있어서 실행 중 에러가 났다면?
Spring Boot 앱 실행 자체가 실패하며 중단된다. 이것이 Flyway의 가장 큰 장점이다. **"DB 마이그레이션이 실패하면 서버가 뜨지 않는다."** 즉, 불완전한 상태로 서비스가 배포되는 것을 원천 차단한다.

이 경우 로컬 환경이라면:
1.  `V3` 스크립트의 오타를 수정한다.
2.  `flyway_schema_history` 테이블에서 실패한 `V3` 기록을 삭제한다 (delete row).
3.  다시 실행한다.

> **Tip**: 운영 환경에서는 `Flyway Repair` 명령어를 사용하거나 좀 더 신중한 접근이 필요하다. 하지만 기본적으로 **"전진(Forward-only) 마이그레이션"** 원칙을 지키는 것이 좋다. 실수를 되돌리는(Undo) 스크립트보다는, 문제를 해결하는 새로운 버전(`V4__fix_typo...`)을 만드는 것이 이력 관리에 유리하다.
