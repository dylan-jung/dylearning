---
title: 구독 시스템 구현
timestamp: 2025-08-13
toc: true
tags:
  - learn/design
  - tech/backend
draft: true
---

결제 혹은 매매 등은 에러가 발생하면 안되고, 강건해야하는 시스템이다. 이미 많은 플랫폼에서 구독 시스템을 구현하여 SaaS 형태로 제공하고 있지만 이를 어떻게 만들었을지 궁금했다. 직접 구독 시스템을 만들고 시나리오들을 생각해보며 구조들을 간단하게 다뤄보자.

> [!info] 어떻게 구현할 지에 대한 요구사항은 [[Designing a Subscription System - Requirements]] 에 정리해두었다.

# 구독 시스템 구현

최근 n
로그만 남기기..

user
id
plan_id

plan
id
role_id
name
period // yearly, monthly
amount

role
id
// flags

invoice
id
payment_method_id
amount

subscription
id
user_id
plan_id
invoice_id
start_date
end_date
next_charge_at

outbox
id
type
payload
invoice_id
status
created_at

payment_method
id
card_info

# 자동 결제

1. 클린 아키텍쳐로 구성
   - PG사는 언제든 바뀔 수 있다
   - DB도 언제든 바뀔 수 있다.
   - ...
2. 장애발생시
   1. PG 여러개 사용할 구조
   2. 서킷브레이커
3. 테스트를 위한 구조

개선된 클린아키텍쳐

트랜잭션
-> 음.. 강력한 트랜잭션을 위해?

마이크로서비스라고 가정하고
-> 외부 API(PG) 잘 사용

흠..

에러처리

# ㅎ
