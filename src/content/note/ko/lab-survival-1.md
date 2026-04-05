---
title: 랩에서 살아남기 — 왜 LLM을 밑바닥부터 뜯어봐야 했나
timestamp: 2026-04-05
toc: true
series: lab-survival
tags:
  - tech/ai
---

# Lab Survival

학사 개발자가 회사의 AI Lab에서 살아남기 위해 LLM을 밑바닥부터 공부하는 시리즈다.

Transformer 구조 자체는 안다. Attention이 뭔지, 왜 작동하는지 정도는 설명할 수 있다. 문제는 그 다음이다. 모델을 개선해야 할 때, 학습이 잘 안 될 때, 새로운 기법을 도입해야 할 때 — **"그래서 어떻게 해야 하는데?"**에 대한 판단이 잘 서지 않는다.

개발자 출신이라 시스템을 만드는 건 할 수 있다. 서빙 파이프라인을 짜고, 데이터 전처리를 하고, 인프라를 구성하는 건 익숙하다. 하지만 모델 자체를 개선해야 하는 상황에서는 감각이 없다. 어떤 논문을 봐야 하는지, 어떤 방향으로 손을 대야 하는지, 그 판단의 근거가 되는 지식이 부족하다.

그래서 직접 LLM을 처음부터 학습해보기로 했다.

# 왜 minimind인가

[minimind](https://github.com/jingyaogong/minimind)는 약 64M 파라미터의 초소형 언어 모델을 처음부터 끝까지 학습하는 오픈소스 프로젝트다.

- **전 과정을 다룬다** — 토크나이저 학습부터 Pretrain, SFT, LoRA, RLHF, Tool Use, Agentic RL, 모델 증류까지
- **고수준 추상화가 없다** — transformers나 trl 래퍼 없이 PyTorch로 직접 구현되어 있어서, 각 알고리즘이 실제로 어떻게 동작하는지 코드로 확인할 수 있다
- **재현 가능한 규모** — 3090 한 장, 2시간이면 학습이 끝난다
- **최신 기법 반영** — Qwen3 구조 기반, GRPO/CISPO 같은 최근 RL 알고리즘, Adaptive Thinking, Agentic RL까지 포함

논문만 읽으면 수식은 이해되는데 구현 감각이 안 잡히고, 프레임워크만 쓰면 편한데 내부가 보이지 않는다. minimind는 그 사이를 메워주는 프로젝트라고 생각한다.

# 앞으로 다룰 것

minimind의 코드를 따라가면서, 각 단계에서 **왜 이렇게 하는지**, **최신 논문에서는 이걸 어떻게 개선하고 있는지**를 함께 정리할 계획이다.

1. **Tokenizer** — BPE 학습, ByteLevel 처리, 특수 토큰 설계
2. **Model Architecture** — Dense/MoE 구조, RoPE, KV-Cache, Qwen3과의 대응
3. **Pretraining** — 데이터 구성, 학습 전략, loss 분석
4. **SFT** — 지도학습 파인튜닝, chat template 설계
5. **LoRA / Distillation** — 경량 파인튜닝, 화이트박스 증류
6. **RLHF / RLAIF** — DPO, PPO, GRPO, CISPO 비교와 구현
7. **Tool Use / Agentic RL** — 도구 호출 학습, 멀티턴 에이전트 RL

각 편에서 관련 논문도 같이 다룰 생각이다. 코드를 보고, 논문을 읽고, 실제로 돌려보면서 감을 잡아가는 과정을 기록한다.
