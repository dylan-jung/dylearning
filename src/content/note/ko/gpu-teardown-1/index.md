---
title: GPU Teardown 1 - Inside the GPU
timestamp: 2026-05-17
toc: true
draft: true
---
# GPU 톺아보기 - GPU 아키텍처 분석

CPU와 GPU는 설계 목표가 다르다. CPU는 작업 하나의 지연을 줄이는 쪽이고, GPU는 전체 처리량을 늘리는 쪽이다. 이 차이가 코어 구성부터 메모리 계층, 실행 방식까지 이어진다.

이 글은 GPU 구조를 세 부분으로 본다. 전체 구성(Part I), SM 내부(Part II), 성능의 물리적 한계(Part III).

> 이 분석은 **NVIDIA H100(Hopper)** GPU를 기준으로 한다. 세대·버전 비교가 필요한 부분(Tensor Core 발전, 세대별 Ridge Point)에서만 V100~B200을 함께 놓는다. AMD·Intel GPU는 용어(SM ↔ CU, warp ↔ wavefront)와 일부 내부 구조가 달라 그대로 대응되지 않는다.

---

## Part I. GPU 전체 구조

*GPU는 왜 이렇게 설계됐고, 무엇으로 구성되나.*

### CPU와 GPU: 두 설계 철학

GPU(Graphics Processing Unit)는 그래픽 연산, 특히 화면의 수많은 픽셀을 동시에 처리하려고 태어났다. 화면을 그리려면 같은 종류의 연산을 빠르고 많이 수행해야 하고, 그래서 병렬성이 처음부터 핵심이었다. 이후 "이 연산 유닛을 그래픽 말고 일반 계산에도 쓰면 어떨까"라는 발상에서 GPGPU(General Purpose GPU)가 나왔다. 2006년 NVIDIA가 CUDA를 공개하면서 GPU는 그래픽 카드를 벗어나 AI·시뮬레이션·과학 계산의 장치가 됐다.

AI에서 GPU가 강한 이유도 같은 자리에 있다. 행렬·텐서 연산은 같은 연산을 대량의 데이터에 반복 적용하는 문제다. 픽셀이 행렬 원소로 바뀌었을 뿐이다.

CPU와 GPU의 설계 차이를 표로 놓으면 이렇다.

| 구분 | CPU | GPU |
|------|-----|-----|
| 설계 목표 | 지연 시간 최소화 | 처리량 최대화 |
| 코어 구성 | 적은 수의 강한 코어 | 많은 수의 단순한 코어 |
| 강점 | 단일 작업을 빠르게 | 같은 작업을 대량 병렬 |
| 캐시 전략 | 큰 캐시 + 복잡한 제어 로직 | 작은 캐시 + 병렬성 활용 |
| 지연 대응 | 캐시, 분기 예측, 복잡한 제어 | 다른 warp로 전환해 지연 숨기기 |
| 적합 작업 | OS, 웹 서버, 분기 많은 코드 | 행렬 연산, 이미지 처리, 딥러닝 |

CPU는 한 가지 일을 최대한 빨리 끝내도록, GPU는 동시에 많은 일을 처리하도록 설계됐다. GPU의 코어 하나는 단순하지만 그런 코어가 수천 개 동시에 동작한다. 지연 대응 방식도 갈린다. CPU는 캐시와 분기 예측으로 대기를 줄이고, GPU는 다른 warp로 갈아타며 대기를 숨긴다. 이 차이가 Part II의 주제다.

GPU가 병렬 연산에 강한 이유는 네 가지다. 첫째, 데이터 병렬성. 같은 연산을 많은 데이터에 한꺼번에 적용한다. 둘째, 규칙적인 메모리 접근. 연속된 스레드가 연속된 메모리를 접근하면 GPU가 하나의 트랜잭션으로 묶는데(메모리 병합, Coalescing), 이렇게 대역폭을 아낀다. 셋째, 지연 숨기기(Latency Hiding). 스레드 일부가 메모리를 기다릴 때 다른 warp를 실행해 그 시간을 메운다. 넷째, 높은 메모리 대역폭. HBM이 CPU보다 훨씬 넓은 데이터 통로를 댄다.

### 메모리 계층

GPU의 메모리는 하나가 아니다. 빠르고 작은 메모리와 느리고 큰 메모리가 계층을 이룬다. 두 축으로 갈린다. 누가 보느냐(스코프), 그리고 칩 위에 있느냐 밖에 있느냐(On/Off-Chip). 스코프는 thread, block, grid, GPU 전체로 넓어지고, 넓어질수록 대체로 느리고 크다.

| 메모리 | 스코프 | 위치 | 레이턴시 | 크기 (H100 기준) | 관리 주체 |
|--------|--------|------|---------|-------------------|----------|
| 레지스터 | Thread 전용 | On-Chip | ~1 cycle | SM당 65,536개 (≈256KB) | 컴파일러 |
| 지역 메모리 | Thread 전용 | Off-Chip (HBM) | ~500 cycles | 스레드당 최대 512KB | 컴파일러 |
| 공유 메모리 | Block 내 공유 | On-Chip | ~5 cycles | SM당 최대 228KB | **프로그래머** |
| L1 캐시 | Block 내 공유 | On-Chip | ~5 cycles | 공유 메모리와 통합 256KB | 하드웨어 |
| 전역 메모리 | 전체 | Off-Chip (HBM3) | ~500 cycles | H100 80GB / H200 141GB | 프로그래머 |
| 상수 메모리 | 전체 (읽기 전용) | Off-Chip + 전용 캐시 | ~5 (hit) / ~500 (miss) | 64KB | 프로그래머 |
| 텍스처 메모리 | 전체 (읽기 전용) | Off-Chip + 전용 캐시 | ~5 (hit) / ~500 (miss) | 가변 | 프로그래머 |
| L2 캐시 | 전체 | On-Chip | ~200 cycles | H100 50MB | 하드웨어 |

여기서 cycle은 GPU 내부 클럭이 한 번 진행되는 시간 단위로, 각 계층 접근이 상대적으로 얼마나 빠르거나 느린지를 보여주는 감각적 표현이다. 실제 cycle 수는 아키텍처·클럭·접근 패턴에 따라 달라진다.

On-Chip(레지스터·공유 메모리·L1)은 수 cycle, Off-Chip(전역·지역 메모리)은 약 500 cycle. 100배 차이다. 같은 데이터를 여러 번 쓸 거면 느린 HBM에서 매번 읽지 말고 shared memory나 register로 끌어와 재사용한다.

**Thread 수준**에는 레지스터와 지역 메모리가 있다. 레지스터는 SM 안 On-Chip의 가장 빠른 공간으로, 커널 내부 지역변수가 여기 담긴다. 양이 정해져 있어서(Hopper 기준 SM당 65,536개) 변수가 넘치면 컴파일러가 일부를 Off-Chip의 지역 메모리로 내린다. 이게 register spill이다. 이름만 "지역 메모리"지 물리적으로는 HBM이라, spill이 나면 1 cycle이 500 cycle이 된다. 한 블록이 레지스터를 많이 쥘수록 SM에 올릴 블록·warp가 줄어드는데, 이 Occupancy 문제는 Part II에서 다룬다.

**Block 수준**에는 공유 메모리와 L1 캐시가 있다. 둘 다 On-Chip이라 5 cycle 안팎이지만 성격이 다르다. 공유 메모리는 표에서 유일하게 프로그래머가 직접 채우고 직접 재사용하는 영역이다. 같은 블록 안 스레드들이 자주 쓰는 데이터를 여기 올리면 HBM 왕복이 준다. L1 캐시는 하드웨어가 알아서 관리한다. Hopper는 둘을 Unified Data Cache로 합쳐 256KB를 두고, 공유 메모리에 0~228KB를 할당한 뒤 나머지를 L1이 쓴다. 한쪽을 키우면 다른 쪽이 줄어든다.

**Grid 수준**에는 모든 스레드가 보는 전역·상수·텍스처 메모리가 있다. 전역 메모리는 GPU에서 가장 큰 영역(H100 80GB, H200 141GB)이고 호스트와 데이터를 주고받는 통로다. `cudaMalloc()`으로 잡고 `cudaMemcpy()`로 옮기는 공간이 여기다. 대신 가장 느리다(약 500 cycle, H100 3.35TB/s·H200 4.8TB/s HBM). 상수 메모리와 텍스처 메모리는 읽기 전용이고 전용 캐시를 둬서, 적중하면 빠르고 빗나가면 전역 메모리 수준으로 떨어진다. 상수 메모리는 커널 실행 중 바뀌지 않는 작은 값(64KB)에, 텍스처 메모리는 본래 용도인 그래픽 연산에 쓴다.

**GPU 전체 수준**에는 L2 캐시가 있다. 전역 메모리와 각 SM 사이에서 모든 SM이 공유하고(H100 50MB), 하드웨어가 관리한다.

마지막 열을 보면 관리 주체가 셋으로 나뉜다. 컴파일러(레지스터·지역 메모리), 하드웨어(L1·L2), 프로그래머(공유 메모리·전역 메모리). 성능을 끌어올릴 여지는 대개 세 번째, 특히 공유 메모리에 있다.

### 실행 단위: SM과 다섯 겹의 계층

메모리가 "데이터가 어디 있나"라면 실행 단위는 "연산이 어떻게 묶여 도나"다. 둘이 만나는 곳이 SM이다.

GPU는 SM(Streaming Multiprocessor)을 여러 개 묶은 구조다. SM은 CUDA 코어 여럿을 가진 연산 장치로, H100 SXM 기준 GPU당 132개가 있고 SM당 CUDA 코어는 128개다. 합치면 16,896개. SM 안에는 CUDA 코어 외에 Warp Scheduler, Tensor Core, Register File 등이 들어간다. 내부는 Part II에서 연다.

실제 실행은 다섯 겹의 계층을 따라 올라간다(Hopper 기준).

```
Grid                         커널 전체 실행 범위
└─ Thread Block Cluster      Hopper에서 추가된 계층
   └─ Thread Block / CTA     한 SM 위에서 실행
      └─ Warp                32 threads, 실제 실행 단위
         └─ Thread           최소 실행 단위
```

아래에서부터 올라가며 본다.

**Thread**는 최소 실행 단위다. 각자 고유한 레지스터와 데이터 상태를 가진다.

**Warp**는 32개 스레드 묶음이고, GPU에서 실제로 한 덩어리로 실행되는 단위다. 32개가 같은 명령을 동시에 수행하는 구조를 SIMT(Single Instruction, Multiple Threads)라 한다. 스레드 상태가 독립적이라 warp 안에서 분기는 가능하지만, 갈라지면 경로를 순차 실행해 성능이 떨어진다. 이 비용은 Part II의 Warp Divergence에서 다시 본다.

**Thread Block(CTA)**은 한 SM 위에서 실행되는 스레드 집합이다. 여러 warp로 구성되므로 블록 안 스레드 수는 32의 배수(128, 256, 512…)이고, 현재(2026-05) 모든 아키텍처에서 블록당 최대 1,024개(warp 32개)다. 같은 블록 안 스레드들은 공유 메모리로 데이터를 주고받는다.

**Thread Block Cluster**는 Hopper에서 추가된 계층이다. 원래 블록은 독립 실행이라 블록 간 동기화가 안 됐고, 데이터를 교환하려면 전역 메모리를 거쳐야 했다. 공유 메모리보다 약 100배 느린 경로다. AI 연산이 커지면서 블록 하나의 공유 메모리로는 부족해지자, 물리적으로 가까운 여러 SM에 블록을 함께 배치해 협력시키는 그룹을 뒀다. 클러스터 안 블록은 동시에 실행되고(H100 기준 한 클러스터 최대 16블록), 서로 다른 SM에 흩어진 공유 메모리를 논리적으로 연결해 직접 접근한다. 이 구조가 분산 공유 메모리(DSMEM, Distributed Shared Memory)다. 전역 메모리를 거치지 않고 공유 메모리끼리 데이터를 주고받을 수 있으며, 이 영역은 프로그래머가 제어한다.

**Grid**는 하나의 커널 실행을 구성하는 모든 블록의 집합이다. 커널을 띄우면 그리드가 생긴다.

### 내부 동작 흐름: 문제에서 warp까지

앞의 구조가 연산 한 번에서 어떻게 맞물리는지는 커널을 띄울 때의 다섯 단계로 드러난다.

```
1. 데이터 준비    출력 크기 / 문제 크기 파악
        ↓
2. 그리드 결정    전체 일을 몇 개의 block으로 나눌지
        ↓
3. 블록 분할      block 크기와 thread 수 결정
        ↓
4. SM 할당        block들을 가용 SM에 자동 배치
        ↓
5. 워프 실행      SM 안에서 warp 단위로 실제 실행
```

**데이터 준비.** GPU는 알아서 병렬화하지 않는다. 프로그래머가 "최종 결과가 몇 개 필요한가"를 먼저 정한다. 벡터 덧셈이면 결과 벡터 길이 N, 행렬 곱셈이면 결과 행렬의 행×열, 이미지 처리면 출력 픽셀 수가 기준이다.

**그리드 결정.** 전체 일을 몇 개의 블록 묶음으로 나눌지 정한다. CUDA의 `<<<grid, block>>>`에서 grid가 "커널 전체가 몇 블록인가"다. 데이터가 많으면 그리드가 커지고, 블록 하나로 못 담으면 블록을 여러 개 만든다.

**블록 분할.** 블록 하나에 스레드를 몇 개 둘지 정한다. 여기서부터 하드웨어 효율과 직접 맞물린다. warp 크기(32)의 배수인가, 공유 메모리를 얼마나 쓰나, register pressure가 크지 않나, 블록이 너무 작아 GPU를 덜 채우지 않나. 앞서 본 레지스터·공유 메모리 제약이 그대로 판단 기준이 된다.

**SM 할당.** 커널을 실행하면 GPU가 자원 상태를 보고 블록을 가용 SM에 자동 배치한다. 블록 하나는 SM 하나에서 실행되지만, 자원이 허락하면 한 SM에 여러 블록이 올라간다.

**워프 실행.** 블록이 SM에 올라가면 스레드들이 32개씩 warp로 묶이고, Warp Scheduler가 실행 가능한 warp를 골라 연산을 시킨다. 어떤 warp가 메모리를 기다리면 스케줄러는 다른 warp로 넘어간다. 이렇게 memory latency를 숨기며 처리량을 유지한다.

마지막 단계의 "다른 warp로 갈아타기"는 SM 안에서 일어난다. 그 내부를 연다.

---

## Part II. SM 내부 심화

*SM은 처리량을 실제로 어떻게 짜내나.*

### Processing Block: SM의 4분할

SM을 "코어가 잔뜩 박힌 덩어리"로만 보면 latency hiding이나 occupancy가 끝까지 안 잡힌다. SM은 여러 연산 유닛과 스케줄러, 메모리가 배치된 작은 프로세서에 가깝다.

SM은 내부적으로 4개의 Processing Block으로 나뉜다. Sub-partition, Quad로도 불리고, Volta(V100) 이후 모든 NVIDIA 데이터센터 GPU가 이 4분할을 유지한다. H100 기준 블록 하나는 이렇게 구성된다.

```
SM (1개)
│
├── Processing Block 0
│   ├── Warp Scheduler (1개)
│   ├── Dispatch Unit (1개)
│   ├── Register File: 16,384 × 32-bit (64 KB)
│   ├── FP32 CUDA Core: 32개
│   ├── INT32 CUDA Core: 16개
│   ├── FP64 CUDA Core: 16개
│   ├── Tensor Core: 1개 (4세대)
│   ├── Load/Store Unit: 8개
│   └── SFU: 4개
│
├── Processing Block 1  (동일 구성)
├── Processing Block 2  (동일 구성)
├── Processing Block 3  (동일 구성)
│
├── Shared Memory / L1 Cache: 256 KB (4개 블록이 공유)
└── L1 Instruction Cache
```

블록 4개를 합치면 H100 SM 하나에 FP32 128개, INT32 64개, FP64 64개, Tensor Core 4개, Warp Scheduler 4개가 들어간다. 수치가 전부 4의 배수인 건 이 4분할의 결과다(H100 whitepaper).

왜 4개로 나누나. SM 전체를 스케줄러 하나가 맡는다고 하면, 매 사이클 수십 개 warp 중 하나를 골라 수십 개 유닛에 명령을 배선해야 한다. 이 선택과 배선이 복잡할수록 클럭을 올리기 어렵다. 4개로 쪼개면 각 스케줄러가 자기 블록만 맡으니 제어가 단순해지고 클럭 여유가 생긴다.

### 연산 유닛

#### FP32 CUDA Core

가장 기본적인 부동소수점 유닛으로, 매 클럭 FP32 FMA(Fused Multiply-Add) 하나를 처리한다. FMA는 `a × b + c`를 한 번에 계산하고, 곱셈 1회와 덧셈 1회를 합쳐 2 FLOPs로 센다. 이 "2 FLOPs"는 Part III의 peak 계산에서 다시 쓴다.

#### INT32 CUDA Core

정수 전용 유닛이다. 정수 연산에 별도 유닛이 왜 필요한지는 커널을 보면 드러난다.

```c
__global__ void matmul(float* A, float* B, float* C, int M, int N, int K) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;   // ← INT32: 인덱스 계산
    int col = blockIdx.x * blockDim.x + threadIdx.x;   // ← INT32: 인덱스 계산

    float sum = 0.0f;
    for (int k = 0; k < K; k++) {                       // ← INT32: 루프 카운터, 비교
        sum += A[row * K + k] * B[k * N + col];         // ← FP32: 곱셈+덧셈
        //       ^^^^^^^^^^^     ^^^^^^^^^^^
        //       INT32: 주소 계산  INT32: 주소 계산
    }
    C[row * N + col] = sum;                             // ← INT32: 주소 계산
}
```

FP32 연산 한 번에 INT32 연산이 서너 번 붙는다. 배열 인덱스, 루프 카운터, 포인터 산술이 전부 정수다. 정수 연산은 부동소수점의 부속이 아니라 거의 같은 비중의 워크로드다.

Volta 이전에는 CUDA Core 하나가 FP32와 INT32를 번갈아 처리했다. 둘 사이에 의존성이 생기면 직렬화됐다. Volta부터 두 유닛이 분리되며 동시 실행이 가능해져서, 한 warp가 현재 반복의 FP32 곱셈을 수행하는 동안 다음 반복의 INT32 주소 계산을 미리 처리한다(V100 whitepaper, p.15). 분리에는 비용이 따른다. INT32 ALU를 따로 두면 다이 면적과 전력이 는다. Pre-Volta에는 면적 절약이 우선이었으나, 딥러닝이 주 워크로드가 되고 인덱싱이 잦은 GEMM·Convolution이 흔해지면서 분리의 이득이 비용을 넘었다.

이 트레이드오프는 시장마다 다르게 풀린다. 컨슈머 GPU(RTX 50 시리즈, Blackwell 기반)는 모든 코어가 FP32든 INT32든 처리하되 같은 사이클엔 한 종류만 실행한다. 게이밍은 INT32 비중이 낮아 유연성을 택한 것이고, 데이터센터 GPU(A100, H100, B200)는 AI 워크로드에서 분리가 이득이라 그대로 유지한다.

#### Tensor Core

행렬 곱셈(MMA, Matrix Multiply-Accumulate)을 명령 하나로 처리하는 전용 유닛이다. CUDA Core가 스레드당 매 클럭 1 FMA를 하는 반면, Tensor Core는 warp 32개 스레드가 협력해 작은 행렬 곱셈을 통째로 수행한다. 명령 하나로 수십~수백 FMA가 동시에 나간다. 1세대 Volta는 4×4 행렬에 대해 `D = A×B + C`를 한 번에 계산했고(V100 whitepaper, p.17), 세대마다 지원 정밀도가 넓어졌다.

| 세대 | 아키텍처 | 지원 정밀도 | 주요 변화 |
|------|---------|-----------|----------|
| 1세대 | Volta (V100) | FP16 | Tensor Core 최초 도입, SM당 8개 |
| 2세대 | Turing (T4) | FP16, INT8, INT4, INT1 | 추론 정밀도 확대 |
| 3세대 | Ampere (A100) | FP16, BF16, TF32, FP64, INT8, INT4 | TF32 기본, 구조적 희소성, SM당 4개로 감소 |
| 4세대 | Hopper (H100) | + FP8 | Transformer Engine, 처리량 2배 |
| 5세대 | Blackwell (B200) | + FP4 | 2세대 Transformer Engine |

SM당 Tensor Core 수는 Volta/Turing 8개에서 Ampere/Hopper 4개로 줄었다. 그런데도 SM 전체 처리량은 세대마다 오른다. 개별 Tensor Core의 클럭당 처리량이 그만큼 커졌기 때문이다.

정밀도 쪽에서 가장 실용적인 건 TF32(TensorFloat-32)다. 기존 FP32 코드를 한 줄도 고치지 않고 Tensor Core에서 가속하는 게 목적이었다. 비트 배치를 보면 의도가 분명하다.

```
FP32:  부호(1) + 지수(8) + 가수(23) = 32 bit
FP16:  부호(1) + 지수(5) + 가수(10) = 16 bit
TF32:  부호(1) + 지수(8) + 가수(10) = 19 bit
```

FP32의 지수 8비트(넓은 범위)에 FP16의 가수 10비트(AI에 충분한 정밀도)를 붙인 형태다. cuBLAS에서 FP32 GEMM을 호출하면 내부적으로 TF32로 Tensor Core에서 실행한다(A100 whitepaper, p.20-21). 사용자는 코드 변경 없이 가속을 얻는다.

Hopper부터는 Transformer Engine이 더해진다. 레이어별 텐서 분포를 실시간 추적해, 손실이 적은 레이어는 FP8로 내려 처리량을 올리고 민감한 레이어는 FP16을 유지한다. 정밀도를 전역으로 고정하지 않고 레이어 단위로 조정한다.

#### SFU와 Load/Store Unit

SFU(Special Function Unit)는 `sin`, `exp`, `log`, `rsqrt` 같은 초월 함수 전용으로 블록당 4개다. AI에서는 GELU·SiLU 같은 activation이나 Softmax의 `exp`가 여기로 간다. LD/ST Unit은 메모리 읽기/쓰기 담당으로 블록당 8개이고, HBM·공유 메모리·레지스터 사이의 데이터 이동을 처리한다.

### Warp Scheduler와 Latency Hiding

Warp Scheduler 4개가 매 클럭 자기 풀에서 Ready인 warp를 골라 명령을 발행한다. 4개라서 SM 하나가 한 사이클에 최대 4 warp, 128 스레드를 동시에 실행한다.

warp가 늘 Ready인 건 아니다. 멈춘 상태가 Stall이고, 원인은 거의 메모리다. HBM에서 데이터를 기다리는 Long Scoreboard가 대표적인데, HBM 한 번 접근에 수백 사이클이 든다. H100 실측이 약 658 사이클이다(Hopper microbenchmarking, 2025). 공유 메모리를 기다리는 Short Scoreboard, `__syncthreads()`에 걸리는 Barrier Stall도 있다.

CPU라면 큰 캐시와 비순차 실행(OoO)으로 이 대기를 줄이려 한다. GPU는 줄이지 않는다. 대신 다른 warp를 실행한다. 기다리는 warp는 둔 채 스케줄러가 다음 Ready warp로 넘어가고, 넘어가는 비용은 거의 없다. warp별 레지스터가 Register File에 상주해 문맥을 따로 저장할 필요가 없기 때문이다(CUDA Programming Guide).

이게 Latency Hiding이다. warp 하나는 수백 사이클을 노는데, SM은 그동안 다른 warp를 실행하므로 연산기가 비지 않는다. 빠른 비결이 개별 작업의 속도가 아니라 노는 시간을 없애는 데 있다는 점이 조금 반직관적이다.

갈아탈 warp가 많을수록 hiding이 잘 된다. 그 양을 재는 지표가 Occupancy다.

```
Occupancy = SM에 상주하는 활성 Warp 수 / SM이 수용 가능한 최대 Warp 수
```

H100은 SM당 최대 64 warp(2,048 스레드)를 올린다. 후보가 많으면 스케줄러가 고를 Ready warp가 많아 hiding이 잘 된다. 다만 Occupancy가 높다고 항상 빠르지는 않다. Occupancy를 끌어내리는 자원이 셋이다. 레지스터(SM당 65,536개를 나눠 쓰므로 스레드가 많이 쥐면 올릴 warp가 준다), 공유 메모리(Block당 많이 쓰면 동시 Block이 준다), Block 크기(32의 배수가 아니면 마지막 warp에 빈 스레드가 생긴다). 첫 번째가 함정이다. Occupancy를 올리려 레지스터를 깎으면 Part I에서 본 spill이 나서 오히려 느려진다.

### Warp Divergence

warp 안 32개 스레드가 분기로 다른 경로를 타면 GPU는 두 경로를 순차 실행한다. 한쪽이 실행되는 동안 다른 쪽 스레드는 놀고, 그만큼 처리량이 깎인다. 이게 Warp Divergence이고, Part I에서 말한 "warp 안 분기 비용"이 이것이다.

Volta부터 Independent Thread Scheduling이 도입돼 각 스레드가 독립적인 PC와 호출 스택을 갖지만, 본질은 같다. 분기가 있으면 비활성 스레드가 생기고 처리량이 준다. Independent Thread Scheduling은 이를 더 효율적으로 관리할 뿐이다.

AI 워크로드에서는 이 문제가 거의 없다. 행렬 곱셈, element-wise 연산(ReLU, GELU), LayerNorm, Softmax 같은 핵심 연산은 모든 스레드가 데이터만 다를 뿐 같은 경로를 탄다. GPU의 SIMT 모델이 AI 연산에 잘 맞는 이유 중 하나다.

### SM 전체 그림

지금까지 연 내부를 H100 SM 하나로 합치면 이렇다.

```
┌─────────────────────────────── SM ───────────────────────────────┐
│                                                                   │
│  ┌─ Processing Block 0 ─┐  ┌─ Processing Block 1 ─┐             │
│  │ Warp Scheduler (1)    │  │ Warp Scheduler (1)    │             │
│  │ FP32 Core ×32         │  │ FP32 Core ×32         │             │
│  │ INT32 Core ×16        │  │ INT32 Core ×16        │             │
│  │ FP64 Core ×16         │  │ FP64 Core ×16         │             │
│  │ Tensor Core ×1 (4세대) │  │ Tensor Core ×1 (4세대) │             │
│  │ LD/ST Unit ×8         │  │ LD/ST Unit ×8         │             │
│  │ SFU ×4                │  │ SFU ×4                │             │
│  │ Register File 64KB    │  │ Register File 64KB    │             │
│  └───────────────────────┘  └───────────────────────┘             │
│                                                                   │
│  ┌─ Processing Block 2 ─┐  ┌─ Processing Block 3 ─┐             │
│  │      (동일 구성)       │  │      (동일 구성)       │             │
│  └───────────────────────┘  └───────────────────────┘             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │     Shared Memory / L1 Cache: 256 KB (Unified, 전체 공유)     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

GPU 전체 (H100 SXM): 132 SM → FP32 16,896개 / Tensor Core 528개
```

SM은 연산 유닛을 4블록으로 나눠 클럭을 올리고, warp를 갈아타며 메모리 대기를 숨긴다. 이렇게 숨겨도 넘지 못하는 선이 있다. 그 선을 그리는 게 Roofline이다.

---

## Part III. 성능의 물리적 한계

*처리량은 어디서 막히나.*

### 두 개의 천장

GPU 성능에는 물리적 상한이 둘 있다. 연산 처리량(Compute Throughput)은 초당 가능한 부동소수점 연산의 최대 횟수(FLOP/s)이고, 메모리 대역폭(Memory Bandwidth)은 초당 HBM에서 읽거나 쓸 수 있는 데이터의 최대량(Byte/s)이다.

실제 성능은 둘 중 낮은 쪽이 정한다. 연산기가 빨라도 데이터가 그 속도로 안 들어오면 데이터 속도에 묶이고, 반대도 같다. 이 두 천장을 한 그래프에 얹은 게 Roofline Model이다(Williams et al. 2009). 어떤 연산이 어느 천장에 부딪히는지는 Arithmetic Intensity가 가른다.

### Arithmetic Intensity

```
Arithmetic Intensity (AI) = 수행 연산 횟수(FLOPs) / 이동 데이터 양(Bytes)
단위: FLOP/Byte
```

데이터 1바이트를 옮길 때 그걸로 연산을 몇 번 하느냐다. 작으면 데이터만 나르고 연산은 적은 것이고, 크면 한 번 가져온 데이터를 여러 번 쓰는 것이다. 두 극단을 계산하면 차이가 분명해진다.

벡터 덧셈 `C[i] = A[i] + B[i]`은 원소당 덧셈 1회(1 FLOP)를 하려고 A·B를 읽고 C를 쓴다(12 Bytes, FP32). AI = 1/12 ≈ 0.083 FLOP/Byte다.

행렬 곱셈 `C = A × B`(모두 N×N)은 2N³ FLOPs를 하며 3N²×4 Bytes를 옮긴다. AI = 2N³ / 12N² = N/6 FLOP/Byte다. N=4096이면 약 683 FLOP/Byte로, 벡터 덧셈보다 네 자릿수 가까이 높다.

차이는 데이터 재사용에서 온다. 행렬 곱셈은 A의 한 행과 B의 한 열이 여러 출력 원소 계산에 반복 동원되므로 같은 데이터로 더 많은 연산을 뽑는다. Part I에서 본 tiling, 즉 데이터를 shared memory에 올려 재사용하는 기법이 중요한 까닭도 AI를 끌어올리는 데 있다.

### Roofline과 Ridge Point

Roofline은 X축에 Arithmetic Intensity, Y축에 달성 가능한 성능(FLOP/s)을 두고 둘 다 log scale로 그린다.

```
       ▲ Attainable Performance (FLOP/s)  [log scale]
       │
  Peak │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┬━━━━━━━━━━━━━━━━  ← Compute Ceiling
  FLOP/s                                 │
       │                                ╱│
       │                              ╱  │
       │                            ╱    │
       │                          ╱      │
       │                        ╱        │
       │                      ╱    Memory Bandwidth Slope
       │                    ╱      (기울기 = BW)
       │                  ╱
       │                ╱
       │──────────────╱──────────────────────────────────→ Arithmetic Intensity
                           ↑                               (FLOP/Byte) [log scale]
                      Ridge Point
```

왼쪽의 비스듬한 선은 메모리 대역폭이 만드는 천장(기울기가 대역폭)이고, 오른쪽 수평선은 연산 처리량이 만드는 천장이다. 둘이 만나는 점이 Ridge Point다.

```
Ridge Point = Peak FLOP/s / Peak Bandwidth
```

AI가 Ridge Point보다 왼쪽이면 비스듬한 선에 막혀 Memory Bound, 대역폭이 부족하다. 오른쪽이면 수평선에 막혀 Compute Bound, 연산기가 부족하다. 같은 GPU라도 커널에 따라 어느 천장에 부딪히는지가 갈린다.

### 세대별 Ridge Point와 Memory Wall

Ridge Point를 실제 스펙으로 계산하면 흐름이 보인다.

| GPU | Peak FP16 Tensor (TFLOP/s) | HBM BW (TB/s) | Ridge Point (FLOP/Byte) |
|-----|---------------------------|---------------|------------------------|
| V100 | 125 | 0.90 | **138.9** |
| A100 80GB | 312 | 2.04 | **152.9** |
| H100 SXM | 1,979 | 3.35 | **590.7** |
| H200 SXM | 1,979 | 4.80 | **412.3** |
| B200 | 2,250 | 8.00 | **281.3** |

두 가지가 읽힌다. H100의 Ridge Point가 590.7로 유독 높다. Tensor Core 처리량이 A100 대비 6.3배 오르는 동안 대역폭은 1.6배 느는 데 그쳤기 때문이다. Ridge Point가 높다는 건 어지간히 intensity 높은 연산이 아니면 대부분 Memory Bound로 떨어진다는 뜻이다. 한편 H200과 B200에서는 Ridge Point가 다시 내려온다. NVIDIA가 대역폭 부족을 인식하고 HBM을 공격적으로 키우기 시작한 신호다.

이 격차에 이름이 있다. 연산기는 세대마다 빠르게 빨라지는데 데이터 통로(HBM 대역폭)가 그 속도를 못 따라가는 현상이 Memory Wall이다. SM이 warp를 갈아타며 메모리 대기를 숨겨도, 들어오는 데이터 총량 자체가 대역폭에 묶이면 거기서 멈춘다. 최신 GPU일수록 어지간한 연산이 Memory Bound로 떨어지는 까닭이다.

### 천장의 물리적 기원

두 숫자가 어디서 오는지 내려가 본다.

연산 처리량은 단순하다. CUDA Core 기준 peak FP32는 이렇게 떨어진다.

```
Peak FP32 FLOP/s = SM 수 × FP32 Cores/SM × 2 × Clock

예: H100 SXM = 132 × 128 × 2 × 1.98 GHz ≈ 67 TFLOP/s
```

여기 들어간 2가 Part II에서 본 "FMA당 2 FLOPs"다. 다만 실제 AI 워크로드의 peak은 이 CUDA Core 수치가 아니라 Tensor Core 스펙이 정한다. Tensor Core가 같은 면적에서 warp 단위 행렬 곱셈으로 훨씬 높은 처리량을 내기 때문이다.

메모리 대역폭은 HBM의 물리 구조에서 온다. HBM은 DRAM 다이를 수직으로 쌓고(3D stacking) TSV(Through-Silicon Via)로 관통 연결한 뒤, 실리콘 인터포저 위에서 GPU 다이 바로 옆에 붙인다. 메모리를 칩 옆에 가깝게, 넓은 버스로 붙여 대역폭을 끌어올린다.

| HBM 세대 | 스택당 채널 | 채널당 버스 폭 | 사용 GPU |
|---------|-----------|-------------|---------|
| HBM2 | 8 | 128 bit | V100, A100 40GB |
| HBM2e | 8 | 128 bit | A100 80GB |
| HBM3 | 16 | 64 bit | H100 |
| HBM3e | 16 | 64 bit | H200, B200 |

HBM3에서 독립 채널을 8개에서 16개로 늘렸다(JEDEC HBM3). 채널당 버스 폭은 절반이 됐지만 채널 수가 두 배라, 더 잘게 쪼갠 병렬 접근으로 전체 대역폭을 올렸다. Part I 메모리 표의 "전역 메모리 3.35TB/s"가 이 적층 구조에서 나온 숫자다.

---

## 마무리

지금까지 H100을 기준으로 전체 구성, SM 내부, 성능 한계를 봤다. 마지막의 Memory Wall은 그래프로 끝나는 이야기가 아니다. LLM 추론의 Prefill과 Decode를 Roofline 위에 올리면, 같은 행렬 곱셈이라도 입력 크기에 따라 Memory Bound와 Compute Bound를 오간다. 그 계산이 다음 글이다.

---

## References

**아키텍처 화이트페이퍼**

- [NVIDIA H100 Tensor Core GPU Architecture Whitepaper](https://resources.nvidia.com/en-us-tensor-core): SM 구성, 메모리 용량, 실행 계층, Tensor Core 4세대, FP8, Transformer Engine.
- [NVIDIA A100 Tensor Core GPU Architecture Whitepaper](https://images.nvidia.com/aem-dam/en-zz/Solutions/data-center/nvidia-ampere-architecture-whitepaper.pdf): Processing Block, FP32/INT32 분리, TF32, 구조적 희소성 (p.14-22).
- [NVIDIA V100 Tensor Core GPU Architecture Whitepaper](https://images.nvidia.com/content/volta-architecture/pdf/volta-architecture-whitepaper.pdf): FP32/INT32 분리 최초 도입, Independent Thread Scheduling, Tensor Core 1세대.
- [NVIDIA RTX Blackwell PRO GPU Architecture Whitepaper](https://www.nvidia.com/content/dam/en-zz/Solutions/design-visualization/quadro-product-literature/NVIDIA-RTX-Blackwell-PRO-GPU-Architecture-v1.0.pdf): 컨슈머 GPU의 통합 FP32/INT32 코어.

**CUDA / 프로파일링 문서**

- [NVIDIA Developer Tech Blog: NVIDIA Hopper 아키텍처 심층 분석](https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/): Thread Block Cluster, DSMEM, Unified Data Cache.
- [CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/): Hardware Multithreading(warp 스케줄링·문맥 전환 비용), Programming Model, Compute Capabilities(공유 메모리 용량).
- [CUDA C++ Best Practices Guide: Occupancy](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/#occupancy): Occupancy 정의와 제한 요소.
- [NVIDIA Volta Tuning Guide](https://docs.nvidia.com/cuda/volta-tuning-guide/): FP32/INT32 dedicated core, Independent Thread Scheduling.
- [Nsight Compute Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html#metrics-decoder): Warp Stall 원인 분류.

**논문 / 스펙**

- Williams, S., Waterman, A., & Patterson, D. (2009). [Roofline: An Insightful Visual Performance Model for Multicore Architectures.](https://people.eecs.berkeley.edu/~kubitron/cs252/handouts/papers/RooflineVyNoYellow.pdf) *CACM, 52(4).*
- [Dissecting the NVIDIA Hopper GPU Architecture via Microbenchmarking (2025)](https://arxiv.org/abs/2501.05370): H100 HBM latency 약 658 사이클 실측.
- [JEDEC HBM3 Standard (JESD238)](https://www.jedec.org/standards-documents/docs/jesd238b01), [HBM3 Announcement](https://www.jedec.org/news/pressreleases/jedec-publishes-hbm3-update-high-bandwidth-memory-hbm-standard): 채널 수 8→16 확대.
- GPU별 Datasheet: [V100](https://images.nvidia.com/content/technologies/volta/pdf/volta-v100-datasheet-update-us-1165301-r8.pdf), [A100](https://www.nvidia.com/en-us/data-center/a100/), [H100](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306), [H200](https://www.nvidia.com/en-us/data-center/h200/), [B200](https://www.nvidia.com/en-us/data-center/b200/): Ridge Point 계산 수치.
- NASA: Basics of NVIDIA GPU Hardware Architecture.