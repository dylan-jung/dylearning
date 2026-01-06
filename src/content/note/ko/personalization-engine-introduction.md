---
title: Elvon 개인화 엔진
timestamp: 2025-12-07
toc: true
tags:
  - learn/design
  - tech/backend
draft: true
---
> [!CAUTION]
> 해당 글은 오류가 많을 수 있습니다. 오류를 발견하면 알려주세요!

# Elvon 개인화 엔진

최근 실시간 개인화 엔진 프로젝트인 Elvon을 시작하면서, 기존에 익숙했던 JavaScript/TypeScript, Python 스택에서 벗어나 Rust와 Spring Boot를 선택했다. 이번 기회에 새로운 기술 스택들을 하나하나 배워보면서 트렌드와 실무적인 문제들을 해결하기 위한 결정이다.

이 글에서는 프로젝트 자체보다는 **왜 이런 기술을 선택했는지**, 그리고 **각 기술이 어떤 특성을 가지고 있는지**에 초점을 맞춰 이야기하려고 한다.

## 프로젝트 컨텍스트: 왜 이런 기술이 필요했나?

Elvon은 실시간 이벤트 기반 개인화 엔진이다. 사용자 행동 이벤트를 받아 Feature Store에 저장하고, 클라이언트가 "이 지면(slot)에 무엇을 보여줄까?"라고 물으면 밀리초 단위로 최적의 variant를 결정해주는 시스템이다.

핵심 요구사항은 명확했다:
- **초저지연 의사결정**: `/decide` API는 p99 10ms 이하를 목표로 한다
- **높은 처리량**: 수천 QPS를 감당해야 한다
- **실시간 이벤트 처리**: Kafka 기반으로 이벤트를 수집하고 피처를 업데이트한다
- **확장 가능한 아키텍처**: 향후 ML 모델 통합, 복잡한 비즈니스 로직 추가가 가능해야 한다

이런 요구사항을 만족시키기 위해 **폴리글랏 마이크로서비스** 아키텍처를 선택했다:
- **Rust (Axum)**: Decision 엔진 - 초저지연이 핵심
- **Spring Boot 4.0 (Spring Framework 7.0)**: Ingestion API, Admin API - 비즈니스 로직과 CRUD, 모듈화된 구성
- **Kafka**: 이벤트 스트리밍 백본
- **Redis**: Online Feature Store
- **PostgreSQL**: 설정 및 도메인 데이터

이제 각 기술 선택의 이유를 하나씩 살펴보자.

---

## 1. Rust: 초저지연을 위한 선택

### 1-1. 왜 Rust인가?

Decision 엔진은 이 시스템의 **핫 패스**(hot path)다. 모든 페이지 로드, 모든 사용자 인터랙션마다 호출되며, 응답 시간이 직접적으로 사용자 경험에 영향을 준다.

Rust를 선택한 이유는 크게 세 가지다:

**1) 예측 가능한 성능**
- Garbage Collection이 없어 GC pause가 없다. decide를 계속해서 안정적으로 처리할 수 있어야하는 프로젝트 입장에서 굉장히 중요한 특징이다
- 메모리 할당/해제가 명시적이고 예측 가능하다
- p99, p999 레이턴시가 안정적이다

**2) 메모리 안전성**
- 컴파일 타임에 메모리 안전성을 보장한다
- 데이터 레이스, null pointer 등의 런타임 에러가 원천적으로 차단된다
- 고성능을 추구하면서도 안정성을 포기하지 않는다

**3) Zero-cost Abstractions**
- 고수준 추상화를 사용해도 성능 오버헤드가 없다
- `async/await`, `trait`, `generic` 등을 자유롭게 사용할 수 있다

### 1-2. 실제로 얼마나 빠른가?

간단한 벤치마크를 찾아봤다. [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/#section=data-r23&test=json)의 20-Queries를 기준 기준으로 한다.

이 테스트는 각 요청에서 DB 쿼리 20번을 실행하므로 실제 SaaS/백엔드 시나리오와 가장 유사하며:
- DB connection pool 효율
- async runtime
- ORM/드라이버 효율
- 프레임워크 오버헤드
- 언어별 I/O 처리 성능
이 복합적으로 반영된다. 

| 프레임워크                        | RPS (Responses/sec) | 비고           |
| ---------------------------- | ------------------- | ------------ |
| **axum [postgresql]**        | **34,880**          | 전체 1위        |
| axum [postgresql - deadpool] | 29,830              | Rust         |
| **spring**                   | **15,763**          | Java(Spring) |
| **fastapi**                  | **12,406**          | Python       |
| **koa**                      | 8,600               | Node.js      |
| **nestjs-fastify-mongo**     | 7,630               | Node.js      |
| **express-postgres**         | 5,249               | Node.js      |
| nestjs-mysql                 | 4,437               | Node.js      |
| express-mysql                | 4,240               | Node.js      |

| 프레임워크                        | Avg Latency (ms) | σ (SD)      | Max Latency (ms) | 비고           |
| ---------------------------- | ---------------- | ----------- | ---------------- | ------------ |
| **axum [postgresql]**        | **14.5 ms**      | **3.2 ms**  | **32.5 ms**      | Rust, 전체 1위  |
| axum [postgresql - deadpool] | 16.9 ms          | 0.7 ms      | 18.5 ms          | Rust         |
| aspcore-ado-pg               | 19.2 ms          | 2.1 ms      | 45.2 ms          | .NET         |
| asp.net core [platform, my]  | 31.8 ms          | 7.5 ms      | 270.7 ms         | —            |
| **spring**                   | **31.9 ms**      | **7.7 ms**  | **239.9 ms**     | Java(Spring) |
| aspcore-vb-mw-ado-pg         | 35.7 ms          | 2.8 ms      | 85.0 ms          | .NET         |
| **fastapi**                  | **40.8 ms**      | **15.9 ms** | **197.2 ms**     | Python       |
| **koa**                      | **58.8 ms**      | **9.6 ms**  | **223.2 ms**     | Node.js      |
| nestjs-fastify-mongo         | 66.3 ms          | 13.2 ms     | 194.2 ms         | Node.js      |
| nestjs-mongo                 | 74.9 ms          | 14.1 ms     | 224.6 ms         | Node.js      |
| **express-postgres**         | **96.1 ms**      | 17.0 ms     | 266.1 ms         | Node.js      |
| koa-postgres                 | 97.6 ms          | 14.4 ms     | 202.8 ms         | Node.js      |
| **nestjs-fastify-mysql**     | **104.5 ms**     | 28.4 ms     | 299.1 ms         | Node.js      |
| **nestjs-mysql**             | **113.8 ms**     | 26.9 ms     | 331.5 ms         | Node.js      |

TechEmpower Round 23 벤치마크에서 Rust(Axum)는 20 DB queries 테스트에서 높은 순위를 차지했다.
- Avg latency: 14.5ms (Spring의 절반 이하, FastAPI의 1/3)
- Max latency: 32ms (Node·Python은 200~300ms까지 튐)
- RPS: 34,880 (Spring 대비 2.2배, FastAPI 대비 2.8배, Express 대비 6~7배)

이렇게 안정적이면서 높은 성능을 보여주는 Rust(Axum)를 선택했다.

### 1-2. Rust의 언어적 특성: 소유권과 생명주기

Rust를 처음 접하면 가장 어려운 부분이 **소유권(ownership)** 시스템이다. 하지만 이것이 바로 Rust의 핵심 강점이다.

**소유권 시스템의 핵심 규칙:**
1. 모든 값은 하나의 소유자(owner)를 가진다
2. 한 번에 하나의 소유자만 존재할 수 있다
3. 소유자가 스코프를 벗어나면 값은 자동으로 해제된다

예를 들어, Feature Store에서 사용자 피처를 조회하는 코드를 보자:

```rust
async fn get_user_features(
    redis: &RedisClient,
    user_id: &str,
) -> Result<UserFeatures, Error> {
    let key = format!("user:{}", user_id);
    let data: String = redis.get(&key).await?;
    
    // data는 이 함수가 끝나면 자동으로 해제된다
    // 명시적인 free()나 GC가 필요 없다
    serde_json::from_str(&data)
}
```

**borrowing**을 통해 소유권을 이전하지 않고도 데이터를 참조할 수 있다:

```rust
// 불변 참조: 여러 개 동시에 가능
fn calculate_score(features: &UserFeatures) -> f64 {
    features.page_view_7d as f64 * 0.3 + features.purchase_7d as f64 * 0.7
}

// 가변 참조: 단 하나만 가능
fn update_features(features: &mut UserFeatures, event: &Event) {
    features.page_view_7d += 1;
}
```

이 시스템 덕분에
- **데이터 레이스가 컴파일 타임에 방지된다**
- **메모리 누수가 거의 발생하지 않는다**
- **멀티스레드 프로그래밍이 안전해진다**

---

## 2. Spring Boot 4.0 & Java 25: 새로운 시대의 JVM

Ingestion API와 Admin API는 Spring Boot 4.0(Spring Framework 7.0 기반)으로 구현하려고 한다. **Java 25와 Spring Boot 4.0의 새로운 기능들**이 이 선택의 핵심이다.

### 2-1. Virtual Thread: 동시성의 패러다임 전환
Java 21에서 정식 도입된 Virtual Thread는 JVM의 게임 체인저다.

**기존 Platform Thread의 문제**
- OS 스레드와 1:1 매핑
- 스레드 생성 비용이 크다 (메모리 ~1MB, 생성 시간 ~1ms)
- 스레드 풀 크기가 제한적이다 (보통 수백 개)
- I/O 대기 시 스레드가 블로킹되어 낭비된다

**Virtual Thread의 해결책**
- JVM이 관리하는 경량 스레드
- 메모리 사용량 ~10KB
- 수백만 개를 동시에 생성 가능
- I/O 대기 시 자동으로 다른 작업으로 전환 (carrier thread에서 unmount)

특히 Kafka 전송, Redis 조회 같은 I/O 작업이 많은 워크로드에서 Virtual Thread의 효과가 극대화된다.

### 2-2. Project Leyden과 Spring AOT

Spring의 고질적인 문제 중 하나가 **느린 시작 시간**이다. 특히 마이크로서비스 환경에서 빠른 스케일링이 필요할 때 이는 큰 단점이었다.

Project Leyden은 OpenJDK 차원에서 **정적 이미지**(static image)의 개념을 도입하여 시작 시간을 획기적으로 줄이는 프로젝트다. Spring Framework 7.0은 이 Leyden의 **AOT (Ahead-of-Time) 최적화**와 **CDS (Class Data Sharing)** 기능을 프레임워크 수준에서 완벽하게 지원한다.

**기존 JIT (Just-In-Time) 방식:**
1. 애플리케이션 시작
2. 클래스 로딩
3. 바이트코드 해석
4. 핫스팟 감지
5. 네이티브 코드로 컴파일 (C2 Compiler)

이 과정이 매번 반복되며 긴 워밍업 시간을 유발한다.

**Spring Boot 4.0 + Leyden의 접근:**
1. **Spring AOT Processing**: 빌드 타임에 빈(Bean) 정의를 분석하고 초기화 코드를 미리 생성한다.
2. **CDS Archive (Leyden)**: 클래스 메타데이터와 힙 상태를 미리 저장해두고, 실행 시 메모리 매핑(mmap)으로 즉시 로드한다.
3. **Training Run**: 실제 애플리케이션을 한 번 실행(training run)하여 최적화된 상태를 캡처한다.

다음은 [spring.io](https://spring.io/blog/2024/08/29/spring-boot-cds-support-and-project-leyden-anticipation)에서 공개한 process startup time이다. 상당히 유의미한 결과를 내는 것을 알 수 있다.
![[Pasted image 20251207182134.png]]

### 2-3. 더 가볍고 안전한 Spring Boot

**1) Modular Auto-configuration**
Spring Boot 4.0부터는 자동 설정이 모듈화되었다. 이전에는 `spring-boot-starter-web`을 쓰면 안 쓰는 라이브러리까지 다 가져왔지만, 이제는 세분화된 모듈 덕분에 꼭 필요한 의존성만 로드한다. 이는 컨테이너 이미지 크기를 줄이고 보안 취약점을 줄이는 데 기여한다.

**2) Null-Safety (JSpecify)**
Spring Framework 7.0은 전체 코드베이스에 `JSpecify` 어노테이션을 적용했다. 이는 컴파일 타임에 Null 가능성을 엄격하게 체크해주어, Rust만큼은 아니지만 Java에서도 훨씬 안전한 코드를 작성할 수 있게 해준다. `NullPointerException`의 공포에서 어느 정도 해방될 수 있다.

이 외에도 `Virtual Thread`가 Spring MVC의 기본 동시성 모델로 자리잡으면서, 기존의 복잡한 Reactive Stack (WebFlux) 없이도 높은 처리량을 달성할 수 있게 되었다.

---

## 3. Kafka KRaft: ZooKeeper 없는 오케스트레이션

Kafka 4.0.0부터 **KRaft**(Kafka Raft)가 기본이 되었다. 이는 Kafka 역사상 가장 큰 아키텍처 변화 중 하나다.

### 3-1. ZooKeeper의 문제점

기존 Kafka는 메타데이터 관리를 ZooKeeper에 의존했다
- 브로커 목록
- 토픽 설정
- 파티션 리더 정보
- ACL, 쿼터 등

이러한 구조에서는 여러가지 복잡성으로 인한 **문제점**이 나타났다.
1. **복잡한 운영**: Kafka + ZooKeeper 두 시스템을 관리해야 함
2. **성능 병목**: 메타데이터 변경이 ZooKeeper를 거쳐야 함
3. **확장성 제한**: ZooKeeper는 대규모 클러스터에서 성능 저하
4. **파티션 제한**: ZooKeeper의 znode 제한으로 수십만 파티션 운영이 어려움

### 3-2. KRaft의 해결책
KRaft는 **Raft 합의 알고리즘**을 사용해 Kafka 자체적으로 메타데이터를 관리한다.

**핵심 개념:**
1. **Controller Quorum**: 메타데이터를 관리하는 전용 컨트롤러 노드들
2. **Metadata Log**: 모든 메타데이터 변경을 이벤트 로그로 저장
3. **Raft Consensus**: 리더 선출과 복제를 Raft로 처리

### 3-3. KRaft의 내부 동작

**Raft 합의 알고리즘:**

1. **리더 선출**: 컨트롤러 중 하나가 리더가 된다
2. **로그 복제**: 리더가 메타데이터 변경을 로그에 기록
3. **팔로워 동기화**: 팔로워들이 로그를 복제
4. **커밋**: 과반수가 복제하면 커밋

**메타데이터 로그 구조:**

```
Offset | Event Type        | Data
-------|-------------------|---------------------------
0      | TopicRecord       | {name: "events", ...}
1      | PartitionRecord   | {topic: "events", id: 0}
2      | PartitionRecord   | {topic: "events", id: 1}
3      | ConfigRecord      | {resource: "events", ...}
...
```

브로커들은 이 로그를 **구독**해서 메타데이터 캐시를 업데이트한다.

---

## 4. 폴리글랏 아키텍처

Elvon은 단일 언어/프레임워크로 구현하지 않을 것이다. 각 컴포넌트의 특성에 맞는 최적의 도구를 선택하여 최대한의 성능을 뽑아내도록 노력해보려고 한다.

**Rust (Decision Engine):**
- 요구사항: 초저지연, 높은 처리량, 예측 가능한 성능
- 선택 이유: GC 없음, 메모리 안전성, Zero-cost abstractions
- 트레이드오프: 개발 속도, 러닝 커브

**Spring Boot 4.0 (Ingestion, Admin):**
- 요구사항: 빠른 개발, 복잡한 비즈니스 로직, CRUD
- 선택 이유: 풍부한 생태계, 생산성, Virtual Thread
- 트레이드오프: 메모리 사용량, 시작 시간 (Leyden으로 완화)

**동기 통신 (HTTP/gRPC):**
- Admin API → Decision Engine: 설정 업데이트
- 사용 케이스: 드물고, 지연 허용 가능

**비동기 통신 (Kafka):**
- Ingestion → Feature Updater → Redis
- Decision Engine → Kafka (결정 로그)
- 사용 케이스: 높은 처리량, 디커플링

**공유 데이터 저장소:**
- PostgreSQL: 설정, 도메인 데이터
- Redis: Feature Store (읽기 전용)

---
## 마치며

이 프로젝트를 제대로 시작하기도 전에 기술 공부를 하고 시작하게 되었다. 다른 언어의 생태계에서 와서 아직까진 많은 것에 대한 이해가 부족하지만 근본은 거의 비슷하니 빠르게 배우고 적응해나가면 될 것이다.

무엇보다 다양한 생태계의 최신 기술들 (Virtual Thread, KRaft, Leyden 등)을 공부하면서, 기술 생태계가 계속 발전하고 있다는 걸 체감했다. 이런 발전들이 모여 더 나은 소프트웨어를 만들 수 있게 해준다.

---

**참고 자료:**
- [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/#section=data-r23&test=json)
- [Project Leyden - OpenJDK](https://openjdk.org/projects/leyden/)
- [Spring Boot Leyden](https://spring.io/blog/2024/08/29/spring-boot-cds-support-and-project-leyden-anticipation)
- [Virtual Threads - JEP 444](https://openjdk.org/jeps/444)
- [KIP-500: Replace ZooKeeper with a Self-Managed Metadata Quorum](https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum)
- [The Rust Programming Language Book](https://doc.rust-lang.org/book/)
- [Axum Documentation](https://docs.rs/axum/latest/axum/)
