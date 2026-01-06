---
date: 2025-01-06
publish: true
tags:
  - book
title: Clean Architecture
aliases: clean_architecture
---

클린아키텍쳐 책은 **로버트 C 마틴**이 작성한 소프트웨어 개발 철학이다.

클린아키텍쳐의 책은 1장에서부터 ‘코드는 나중에 정리하면 돼! 우선은 시장에 출시하는 것이 먼저야!’라는 생각을 비판하는 입장을 취하고 있다. 클린아키텍쳐의 철학은 ‘빠르게 가는 유일한 방법은 올바르게 가는 것이다.’ 라는 입장이다. 오히려 깨끗한 코드를 유지하는 것이 더 코스트가 적다는 주장임.

---

### **PART I: INTRODUCTION (소개)**

### **Chapter 1: What Is Design and Architecture? (설계와 아키텍처란 무엇인가?)**

- 설계와 아키텍처의 구분을 명확히 정의하려는 시도 → 그러나 구분하지 마라
- **아키텍처**는 시스템의 고수준 구조, **설계**는 세부 구현이라는 오해가 많음.
- 실제로 설계와 아키텍처는 연속적인 과정이며, 둘을 분리할 수 없음.
- **목표**: 소프트웨어 아키텍처는 시스템 구축 및 유지 관리에 필요한 인적 자원을 최소화하는 것.
- 나쁜 설계의 부작용: 팀 생산성 하락, 유지 보수 비용 증가, 결함 확산.

### **Chapter 2: A Tale of Two Values (두 가지 가치의 이야기)**

- 소프트웨어는 **행동(Behavior)와 구조(Structure)**라는 두 가지 가치를 제공.
  - 행동: 디버깅 하는 행위 등을 뜻함
  - 구조: 소프트웨어를 얼마나 쉽게 변경하고 확장할 수 있는지.
- 구조적 품질이 낮은 시스템은 유지보수성이 떨어져 비효율적이며, 결국 비즈니스에도 악영향.
- **Eisenhower’s Matrix**를 활용해 아키텍처(중요하지만 긴급하지 않음)의 중요성을 강조.
- 개발자는 비즈니스 요구사항(기능)뿐 아니라 아키텍처(구조)를 적극적으로 관리해야 함.

---

### **PART II: STARTING WITH THE BRICKS: PROGRAMMING PARADIGMS (프로그래밍 패러다임의 시작)**

### **Chapter 3: Paradigm Overview (패러다임 개요)**

- 소프트웨어 설계는 **프로그래밍 패러다임**에서 시작.
- 특히나 프로그래밍 패러다임은 개발자의 자유를 제한함. 그로 인하여 패러다임이 생성됨
- 주요 패러다임:
  1. **Structured Programming (구조적 프로그래밍):** 제어 흐름에서 `goto`문 제거.
  2. **Object-Oriented Programming (객체지향 프로그래밍):** 캡슐화, 상속, 다형성을 통해 간접적인 제어 흐름 관리.
  3. **Functional Programming (함수형 프로그래밍):** 불변성과 상태 변화를 억제.
- 각 패러다임은 개발자의 자유를 제한하지만, 결과적으로 시스템의 복잡성을 줄이는 데 기여.
- 소프트웨어 아키텍처의 세 가지 큰 과제:
  - 기능적 구현 (Structured Programming)
  - 데이터 관리 (Functional Programming)
  - 컴포넌트 분리 (Object-Oriented Programming)

### **Chapter 4: Structured Programming (구조적 프로그래밍)**

- **Edsger Dijkstra**가 제안한 패러다임으로 `goto`문 사용 금지.
- 제어 흐름을 **if-else**, **while**, **for** 같은 구조로 제한.
- 복잡한 코드의 디버깅과 유지보수를 쉽게 만듦.
- 프로그래밍의 품질을 과학적으로 증명하려는 시도로 이어짐.

### **Chapter 5: Object-Oriented Programming (객체지향 프로그래밍)**

- **캡슐화, 상속, 다형성**의 세 가지 핵심 원칙.
  - 캡슐화: 데이터를 보호하고, 외부와의 상호작용을 제한.
  - 상속: 재사용 가능성을 높이고 코드 중복을 줄임.
  - 다형성: 서로 다른 객체를 동일한 방식으로 사용할 수 있게 함.
- **OO에서의 다형성은 소스코드의 흐름과 의존관계를 완전히 역전시킬 수 있다. 소스코드 의존성의 방향을 결정할 수 있다면 저수준의 세부사항에 독립시킬 수 있음.**
- 객체지향 패러다임의 오용은 유지보수성을 오히려 저하시킬 수 있음.
- 효과적인 객체 설계는 의존성을 최소화하고 인터페이스를 명확히 해야 함.

### **Chapter 6: Functional Programming (함수형 프로그래밍)**

- \*불변성(Immutability)**과 **순수 함수(Pure Function)\*\*를 핵심으로 함.
- Race condition, Deadlock, 동시 업데이트 문제는 모두, 변수가 가변적이기 때문에 생기는 문제. → State가 있다.
- Functional Programming에서는 가변 컴포넌트에서 불변 컴포넌트를 잘 빼내야함.
- 상태 변화가 없는 함수 설계는 테스트와 디버깅을 용이하게 함.
- **Event Sourcing**과 같은 기법은 함수형 패러다임의 실질적 활용 사례.

---

### **PART III: DESIGN PRINCIPLES (설계 원칙)**

### **Chapter 7: SRP: The Single Responsibility Principle (단일 책임 원칙)**

- 한 클래스는 하나의 책임만 가져야 함.
- SRP는 "하나의 변경 이유만 가져야 한다"는 원칙으로 종종 설명됨. 그러나 이 정의는 부족한 정의이므로, “하나의 모듈은 오직 하나의 액터에 대해서만 책임져야한다.”로 정정함. **Actor**는 시스템에서 변화의 주체가 되는 사용자나 이해관계자(Stakeholder) 그룹을 나타남.
- 예를 들어, `Employee` 클래스의 세 가지 메서드(`calculatePay()`, `reportHours()`, `save()`)는 서로 다른 Actor에게 의존함:
  1. `calculatePay()`: CFO가 속한 회계 부서.
  2. `reportHours()`: COO가 속한 HR 부서.
  3. `save()`: CTO가 속한 데이터베이스 관리자(DBA).따라서 이 클래스는 SRP를 위반하고 있습니다. Actor별로 코드를 분리하여 각각의 변경이 서로 영향을 미치지 않도록 설계해야 합니다​​.

### **Chapter 8: OCP: The Open-Closed Principle (개방-폐쇄 원칙)**

- 시스템은 **확장에는 열려 있고, 수정에는 닫혀 있어야 함.**
- 새로운 기능 추가 시 기존 코드를 수정하지 않고도 동작하도록 설계.
- **예:** 플러그인 아키텍처, 인터페이스 기반 설계.

### **Chapter 9: LSP: The Liskov Substitution Principle (리스코프 치환 원칙)**

- 상위 타입은 하위 타입으로 대체 가능해야 함.
- 잘못된 상속 구조로 인해 발생하는 문제 방지.
- 예: 직사각형(Rectangle)과 정사각형(Square)의 상속 구조 문제.

### **Chapter 10: ISP: The Interface Segregation Principle (인터페이스 분리 원칙)**

- 클라이언트는 자신이 사용하지 않는 메서드에 의존하면 안 됨.
- 큰 인터페이스를 작은 단위로 분리하여 유연성을 강화.

### **Chapter 11: DIP: The Dependency Inversion Principle (의존성 역전 원칙)**

- **상위 모듈이 하위 모듈에 의존하지 않고, 둘 다 추상화에 의존.**
  - **기본적 호출**: 낮은 수준의 클라이언트가 높은 수준의 서비스를 호출할 때, **실행 흐름과 의존 흐름**이 같은 방향으로 흐름.
  - **DIP 적용 후**: 높은 수준의 클라이언트가 낮은 수준의 서비스를 인터페이스를 통해 호출할 때, 실행 흐름과 의존 흐름이 반대 방향으로 설정됨. 이를 통해 의존성을 효과적으로 역전(invert)할 수 있음
- 의존성 주입(Dependency Injection)과 같은 기법으로 구현.

---

### **PART IV: COMPONENT PRINCIPLES (컴포넌트 원칙)**

### **Chapter 12: Components (컴포넌트)**

- 소프트웨어는 **컴포넌트**라는 재사용 가능한 단위로 구성.
- 컴포넌트는 쉽게 교체 가능해야 하며, 독립적으로 배포할 수 있어야 함.

### **Chapter 13: Component Cohesion (컴포넌트 응집성)**

- **응집도 원칙**: 동일한 변경 이유를 가진 클래스는 같은 컴포넌트에 있어야 함.
- **공통 폐쇄 원칙**: 동일한 변경 이유를 공유하는 클래스는 동일한 컴포넌트에 포함.
- **공통 재사용 원칙**: 함께 사용되는 클래스는 함께 배포.

### **Chapter 14: Component Coupling (컴포넌트 결합도)**

- 의존성 관리 원칙:
  - **Acyclic Dependencies Principle (무순환 의존성 원칙):** 의존 관계는 DAG(Direct Acyclic Graph)여야함.
  - **Stable Dependencies Principle (안정된 의존성 원칙):** 안정된 컴포넌트는 불안정한 컴포넌트에 의존하지 않아야 함.

---

### **PART V: ARCHITECTURE (아키텍처)**

### **Chapter 15: What Is Architecture? (아키텍처란 무엇인가?)**

- 아키텍처는 시스템 설계의 큰 그림을 다룸.
- 개발, 배포, 유지보수를 위한 유연한 기반을 제공.

### **Chapter 16: Independence (독립성)**

- 각 계층과 모듈이 독립적으로 개발 및 배포 가능하도록 설계.
- **레이어 분리**와 **의존성 감소**가 핵심.

### **Chapter 22: The Clean Architecture**

![[clean_architecture.png]]

- **의존성 규칙 (Dependency Rule):**
  - 모든 의존성은 "안쪽"을 가리켜야 하며, 더 높은 수준의 정책(비즈니스 규칙)이 저수준 구현 세부사항에 영향을 받아서는 안 됨.
  - 이 규칙은 **Ports and Adapters (Hexagonal Architecture)**, **DCI**, **BCE**와 같은 아키텍처 패턴에도 공통적으로 존재함.
- **아키텍처의 계층구조:**
  - 소프트웨어는 다음과 같은 계층:
    1. **Entities**: 핵심 비즈니스 규칙과 객체.
    2. **Use Cases**: 특정 비즈니스 요구사항을 충족시키는 애플리케이션별 비즈니스 규칙.
    3. **Interface Adapters**: 데이터와 객체를 특정 포맷에서 다른 포맷으로 변환.
    4. **Frameworks and Drivers**: 외부와의 상호작용을 담당하는 계층.
- **독립성 보장:**
  - 시스템의 핵심 비즈니스 규칙은 데이터베이스, 웹 서버, UI와 같은 외부 요소와 독립적으로 설계되어야 함.
  - 이를 통해 UI를 교체하거나 데이터베이스를 변경해도 비즈니스 로직에 영향을 미치지 않게 됨.
- **구현 예시:**
  - `Controller`는 데이터를 수집하고, 이를 POJO(Plain Old Java Object)로 변환하여 **Input Boundary**를 통해 Use Case Interactor에 전달.
  - Use Case Interactor는 데이터를 처리하고, 비즈니스 규칙에 따라 **Entities**와 상호작용.
  - 처리된 데이터는 다시 **Output Boundary**를 통해 Presenter로 전달되며, Presenter는 데이터를 ViewModel로 변환해 UI에 전달.

---

클린 아키텍쳐 또한 개념들 중 하나다. 마스터키는 없고, 항상 철학을 이해하고 아키텍터의 판단이 중요함.
