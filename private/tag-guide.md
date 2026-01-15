# 🗂 Obsidian Tag System Guide v3 e)

## 0. 이 시스템의 핵심 전제

### ✅ 1. 메인 태그는 쓰지 않는다

* `#learn`, `#series`, `#essay` **직접 사용하지 않음**
* 항상 **슬래시 하위 태그만 사용**

```
#learn/concept     ✅
#series/agent      ✅
#learn             ❌
```

---

### ✅ 2. 슬래시(`/`) 태그는 상위 의미를 자동 포함한다

| 사용 태그                 | 암묵적 의미 |
| --------------------- | ------ |
| `#learn/design`       | learn  |
| `#learn/breakbelieve` | learn  |
| `#series/xyz`         | series |
| `#tech/ai`            | tech   |
→ 상위 태그는 **개념적으로만 존재**

---

### ✅ 3. 태그는 “역할”이 다르다

* 같은 역할의 태그는 **하나만**
* 한 노트당 **2~4개**
* 태그 = 분류
  링크 = 사고의 흐름

---

## 1. Note Type (노트의 성격)

> **이 노트는 무엇인가?**
> 모든 노트는 여기서 **정확히 1개 선택**

```
#learn/*
#short/*
#essay/*
#retrospective/*
#book
```

---

### 1.1 Learn — 배운 것 정리

```
#learn/concept
#learn/howto
#learn/troubleshooting
#learn/design
#learn/performance
#learn/breakbelieve
```

#### 기본 정의

| 태그                       | 의미               |
| ------------------------ | ---------------- |
| `#learn/concept`         | 새로운 개념, 정의, 이론   |
| `#learn/howto`           | 방법, 절차           |
| `#learn/troubleshooting` | 문제 → 원인 → 해결     |
| `#learn/design`          | 구조, 설계, 판단       |
| `#learn/performance`     | 성능, 비용, 최적화      |
| `#learn/breakbelieve`    | 기존 사고방식에서 문제를 발견 |

---

### 1.2 Short — 아주 짧은 기록

```
#short/thought
#short/idea
#short/log
```

* 날것의 생각
* 빠른 캡처
* **도메인 태그 사용 ❌**

---

### 1.3 Essay — 깊은 사고 / 관점

```
#essay/thinking
#essay/career
#essay/product
#essay/learning
```

* 구조적 글
* 내 관점이 중심
* 태그는 최소화

---

### 1.4 Retrospective — 회고

```
#retrospective/daily
#retrospective/weekly
#retrospective/monthly
#retrospective/project
#retrospective/experience
```

* 반드시 **되돌아봄 + 개선 인사이트**
* 감정 기록 ❌
* `#retrospective/experience`: 행사, 모임, 커뮤니티 참여 경험 공유

---

### 1.5 Book — 책 노트

```
#book
```

* 단일 태그만 사용
* 세부 분류는 **노트 내부 구조와 링크로 해결**

---

## 2. Domain (내용의 분야)

> **무엇에 대한 이야기인가?**
> 필요할 때만, **최대 1개**

```
#tech/frontend
#tech/backend
#tech/ai
#tech/llm
#tech/infra
#tech/db
#tech/system
```

### 규칙

* `#learn/*`, `#essay/*`에서만 사용 권장
* `#short/*`에는 사용 ❌

---

## 3. Series (연재 / 흐름)

> **이 노트가 하나의 흐름에 속하는가?**

```
#series/*
```

### 🔓 Series는 열린 집합이다

* `#series/agent`
* `#series/llm-eval`
* `#series/search-v2`
* `#series/whatever`

👉 **자유롭게 추가 가능**

---

### Series 생성 규칙 (중요)

1. **흐름이 있을 때만 만든다**
2. **단발성 노트에는 사용하지 않는다**
3. 이름은 **주제/프로젝트 단위**
4. 끝난 시리즈는 **확장하지 않는다**

📌 시리즈는 “카테고리”가 아니라 **연결선**

---

## 4. 공식 태그 조합 패턴

### 📘 일반 지식

```
#learn/concept + #tech/ai
#learn/design + #tech/system
```

---

### 🧠 사고 전환 / 전제 해체

```
#learn/breakbelieve + #tech/system
#learn/breakbelieve + #series/agent
```

---

### 🧩 설계 + 연재

```
#learn/design + #tech/system + #series/system-design
```

---

### ✍️ 깊은 글

```
#essay/product
#essay/career
```

---

### 🪶 짧은 기록

```
#short/idea
#short/thought
```

---

### 🔁 회고

```
#retrospective/weekly
#retrospective/project
#retrospective/experience
```

---

### 📚 책

```
#book
```

---

## 5. 고정 태그 목록 (Note Type & Domain만 고정)

### Note Type

```
#learn/concept
#learn/howto
#learn/troubleshooting
#learn/design
#learn/performance
#learn/breakbelieve

#short/thought
#short/idea
#short/log

#essay/thinking
#essay/career
#essay/product
#essay/learning

#retrospective/daily
#retrospective/weekly
#retrospective/monthly
#retrospective/project
#retrospective/experience

#book
```

### Domain

```
#tech/frontend
#tech/backend
#tech/ai
#tech/llm
#tech/infra
#tech/db
#tech/system
```

### Series

```
#series/*
```

(열린 집합)

---

## 6. 애매할 때 판단 순서

1. **짧고 날것이다 → `#short/*`**
2. **배운 내용이다 → `#learn/*`**
3. **생각이 뒤집혔다 → `#learn/breakbelieve`**
4. **내 관점이 중심이다 → `#essay/*`**
5. **되돌아보고 있다 → `#retrospective/*`**
6. **책에서 출발했다 → `#book`**
