---
title: Designing a Image Search System - 2
timestamp: 2025-11-22
toc: true
series: designing-image-search
tags:
  - learn/design
  - tech/backend
---
# 이미지 검색 시스템 구축 배경
이전 글([Designing a Image Search System - 1](/note/designing-a-image-search-system-1))에서는 벡터 검색의 이론적인 부분을 살펴보았다. 이번 글에서는 저번 글에서 이해했던 내용들을 바탕으로 실제로 벡터 검색 서비스를 구현할 때 고려했던 내용들을 바탕으로 작성하려고 한다.

마케터 인터뷰 결과, 업무 시간의 상당 부분이 “괜찮은 광고 예시(레퍼런스)”를 수집하는 데 소모되고 있었다. 이에 따라 마케팅 에셋을 이해하는 검색 경험을 목표로 설정했다.

간단하게 서비스 컨셉을 보여주자면 다음과 같다. 다음과 같은 쿼리가 들어왔을 때 관련된 마케팅 에셋들을 보여주는 방법으로 검색을 진행하는데,

**"크리스마스"를 검색한 결과**
![demo](demo.png)
이러한 느낌으로 검색을 통해 관련도가 높은 아이디어들을 리턴한다.

# 베타 테스트 제공
마케팅 에셋은 **이미지 + 텍스트**로 구성되는 것도 있으며, **이미지**로만 구성되는 것도 있다.(이것은 채널마다 다르다) 이러한 관계로 임베딩 파이프라인과 그 과정은 여기서 따로 다루지는 않겠다. 다만, 서비스의 성격에 따라 적절한 아이디어로 임베딩 벡터들을 뽑아내는 것은 중요하다.

이제 우리가 원하는 것은 어떠한 텍스트의 쿼리가 들어왔을 때 이를 검색할 수 있는 검색엔진을 구축하는 것이다. 가장 먼저 접근했던 방법은 서비스에서 최대한 빨리 만들 수 있는 방법으로 supabase를 사용하고 있었다. pgvector를 이용하여 서비스를 하는 것이 가장 좋아보였다.

그러나...

3주 정도 지나자 데이터셋이 만 단위로 성장했다. 이 시점부터 지표가 급격히 악화됐다.

- **문제 1. DB 리소스 사용 폭증**
pgvector는 Index 없이 full-scan을 하기 때문에, 데이터가 늘어날수록 쿼리 레이턴시가 선형 증가한다. **P95가 3초 이상**을 찍기 시작했다.

- **문제 2. Postgres CPU가 벡터 연산에 잠식**
향후 이미지가 계속 들어올 텐데, 벡터 연산이 CPU를 다 먹어버리니 다른 API의 트랜잭션 성 쿼리에도 영향이 갈 것 같았다.

- **문제 3. 결과 페이지 미도달 이탈률 21%**
검색이 느리면 사용자는 기다리지 않는다. 검색 이후 결과를 보기 전에 이탈하는 고객이 21%로 집계 됐다.

# DB에서 검색을 떼기 전까지의 고민
가장 좋은 문제 해결방법은 최소한의 변경으로 문제를 해결 하는 것이다. 그래서 아키텍쳐를 유지한 채 DB에서 계산하는 방법을 유지하는 방법으로 더 고민해보았다.
## 1. 현재 우리 상황에서 가장 적절한 인덱스는 뭘까?
가장 먼저 떠올랐던 해결책은 사실 굉장히 단순했다.
> “pgvector도 IVF 기반 인덱스 제공하는데, 인덱스만 제대로 쓰면 이 문제 해결되는 거 아니야?”

그래서 실제로 고려해야 할 인덱스 후보들을 정리해서 비교했다. 앞선 [[Designing a Image Search System - 1 |1편]]에서 공부했던 내용을 이용하여 적합한 인덱스를 찾아보자.
- FLAT
- IVF-FLAT
- IVF-PQ
- HNSW
우리 서비스의 데이터 특성, 업데이트 패턴, 메모리 제약, 요구 정확도를 하나씩 고려하면서 생각해보자.
### 업데이트 패턴
벡터 검색 시스템의 업데이트 빈도는 인덱스 선택에 중요한 요소다.
- 완전 실시간(수 초 ~ 분 단위) → HNSW 쪽이 적합 (삽입 비용이 상대적으로 낮음)
- 주기적 업데이트(하루 1회 ~ 며칠에 1회) → IVF 기반 인덱스도 충분히 가능

우리 상황은
- 2~3일에 한 번 정도 새로운 데이터를 몰아서 업데이트한다.
- 광고 에셋은 배치 형태로 입력하는 데이터이다.
즉, 리빌드 후 통째로 스왑하는 구조가 적합하다. (실시간 삽입이 강점인 HNSW가 꼭 필요한 상황은 아니었다.)

인덱스를 자주 재학습하기 어려운 PQ(코드북 갱신 이슈 있음)도 배제 대상은 아니었지만, 아직 데이터량이 폭발적으로 크지 않다는 점을 고려하면 과한 선택이기도 했다.
### 메모리 사용
뒤에서 작성하겠지만, 결국 새로운 검색엔진을 빌드하려고 했고, 메모리에 모든 벡터를 올려서 검색해야 하는 구조를 유지하려면 인덱스 크기 자체가 너무 커서는 안 된다. 이를 고려했을 때 계산은 생략하고 결과만 정리하면 다음과 같다.

| 인덱스          | 메모리 사용량     | 설명                    |
| ------------ | ----------- | --------------------- |
| **HNSW**     | 가장 많음       | 그래프 레벨 + neighbor 리스트 |
| **FLAT**     | 많음          | 벡터 전체를 그대로 메모리에 올림    |
| **IVF-FLAT** | FLAT과 거의 동일 | 벡터는 그대로 + centroid 약간 |
| **IVF-PQ**   | 가장 적음       | 벡터를 압축(PQ)해서 저장       |

다만 이 중에서 IVF-PQ는 메모리는 적지만 압축 시 정확도 희생이 커서, 선택하지 않았다.
### 속도
속도 측면에서 인덱스별 성능을 정리하면 다음과 같다.
- FLAT: 정확하지만 느림 (N개의 벡터 전부 비교)
- HNSW: 매우 빠름 (그래프 기반 ANN)
- IVF-FLAT: 빠름 (nprobe 영역만 스캔)
- IVF-PQ: 매우 빠름 (압축된 벡터 탐색)
### 결론
우리의 시스템에서 HNSW는 빠르지만 메모리 비용이 너무 크고, PQ는 빠르지만 정확도 희생이 컸다.
업데이트 패턴, 메모리 사용, 속도, 정확성의 적당한 트레이드 오프로 **IVF-FLAT**로 정했다.
## 2. 어 그럼 이제 pgvector 인덱스 잘 걸면 되지 않나?
핵심적인 보틀넥은 postgres에서 대부분의 연산들을 처리하는 것이다. pgvector는 IVF 기반 인덱스도 제공한다. 그래서 “인덱스 쓰면 full-scan 안 해도 되니까 괜찮지 않을까?”라는 생각을 할 수 있다.

그래서 얼마나 많은 계산이 필요한 지 직접 계산해보자.
- 임베딩 차원: 512차원
- 인덱스: IVF-FLAT
- Distance: Cosine Distance
을 기준으로 한 번 간단하게 계산해보도록 하자.

### 코사인 유사도의 연산
코사인 유사도는 정규화된 벡터 기준으로는 단순한 내적(dot product)이다.
$$
\sum_{i=0}^{d}{x_i y_i}
$$
512차원 벡터 기준으로 곱셈: 512번 + 덧셈: 511번
코사인 유사도 1회 계산 = 약 **1,023번**의 연산

### IVF-FLAT의 스캔 범위
IVF-FLAT은 하이퍼 파라미터로 다음의 파라미터가 존재한다.
- nlist = 클러스터 개수
- nprobe = 탐색할 클러스터 개수

적당한 값을 넣어서 먼저 가정해보자.
전체 벡터 수 N = 100,000 (10만)
- nlist = 4096
- nprobe = 20

일 때 쿼리 1번에서 실제로 비교하는 벡터 수는 다음과 같이 계산된다.
$$
N_{\text{scan}} \approx N \times \frac{n_{\text{probe}}}{n_{\text{list}}}
= 1,000,000 \times \frac{20}{4096} \approx 488
$$
쿼리 1번에 약 **488**개의 벡터와 비교하게 된다.
### 최종 연산량
이제 여기에 코사인 연산량을 곱해보자.

앞에서 계산한 대로:
- 벡터 1개와의 비교 = 1,536연산
- 쿼리당 스캔 벡터 수 = 488개

그럼 총 연산량은
$$ 488 \times 1,023  \approx 500,000
$$
IVF-FLAT 기준으로, 쿼리 1회 ≈ **50만 연산**이다.

유저가 1초에 10명만 검색해도
$$
500,000\times 10 \approx 5,000,000
$$
초당 약 **500만 연산**을 Postgres가 처리해야 한다.
## 3. 연산량이 부족하면 DB 증설하거나 샤딩할까?
연산량이 부족하면 스케일 업하거나 샤딩하는 것이 잘 알려진 해결법이다. 다만 이 경우는 다르게 봐야 한다. 문제는 이 **500만 연산/sec**가 Postgres 내부에서, OLTP 쿼리와 **동일한 리소스를 공유하며** 수행된다는 점이다.
- shared_buffer
- CPU 스케줄링
- parallel worker
모두 같은 풀(pool)을 쓴다.

그래서 실제 운영 상황에서는 다음 문제가 발생한다
- 벡터 테이블 스캔이 shared_buffer를 오염시킴 → 캐시 미스 증가
- CPU가 벡터 연산에 독점됨 → 일반 쿼리가 ready queue에서 대기
- parallel worker가 벡터 검색에 쓰여 OLTP 쿼리가 parallel plan을 쓰지 못함
- I/O 대역폭을 벡터 검색이 잡아먹으면 다른 쿼리의 응답 지연

검색 연산때문에 Postgres 내부 자원 경합 문제가 새롭게 나타난다. 이러한 방식은 본질적인 문제가 해결되지는 않는다.

또한 샤딩을 진행하면 top_k를 가져올 때 샤딩된 데이터들을 추가적으로 모아주는 로직이 새롭게 필요할 것이다. 또한 각 샤딩 인덱스를 따로 만들어 넣어줘야 하는데 이 방식이 운영적인 부담감 또한 주게 된다.

# 아키텍쳐 변경(pgvector → Faiss Server)
## 전체적인 구조 설계
이러한 이유를 바탕으로 아키텍쳐 변경을 시작했다.
![architecture](architecture.png)
먼저 새로 만든 아키텍처의 큰 그림부터 보자.

1. **임베딩 파이프라인 (오프라인)**
	- 광고 에셋(이미지, 텍스트)을 벡터로 임베딩
	- 임베딩 벡터 + ID 매핑(id_map)을 파일로 저장
	- 주기적으로 Faiss 인덱스를 빌드하고 GCS(또는 유사 스토리지)에 업로드
2. **검색 서버 (FastAPI + Faiss 인메모리 인덱스)**
	- 애플리케이션 서버와 분리된 전용 검색 서버
	- 인메모리 Faiss 인덱스를 로딩하고, 텍스트 쿼리를 벡터로 바꿔서 검색
	- 결과로 나온 이미지 ID 리스트를 기반으로 DB에서 메타데이터 조회
3. **DB (Postgres)**
	- 이미지/캠페인 메타데이터, 채널 정보, 카피 등 저장
	- OLTP 쿼리 전용

검색 서버는 "벡터 유사도 검색"에 집중하고 DB는 "데이터 영속성/조인/조회"에 집중 으로 책임을 나눈 것이다. 임베딩 파이프라인은 현재 글에서 작성하진 않지만 중요한 내용 중 하나라 포함했다. 임베딩 파이프라인은 각자의 현재 상태에 맞게 현재 도메인에서 중요한 정보들을 임베딩하면 될 것이다.

현재 모든 코드를 공개하기는 힘든 상황이라 따로 이미지 검색시스템의 일부만 공개하여 코드를 설명한다. 실제 구현의 내용과 사용한 Provider들은 조금씩 다르다.
## 인덱스 변경 시나리오
아키텍처를 이렇게 바꾸고 나면, 바로 다음 문제가 생긴다.
> “오프라인에서 새 인덱스를 빌드해서 스토리지에 올렸을 때, 검색 서버는 이걸 언제, 어떻게, 서비스 중단 없이 갈아끼울 것인가?”

Faiss 인덱스를 인메모리로 들고 있는 구조라서, 검색 서버 프로세스를 재시작해서 로딩하는 방식은 최대한 피하고 싶었다. 게다가 인덱스 파일 크기가 수백 MB 정도만 돼도, 로드하는 동안 검색이 멈추거나 느려지는 건 피할 수 없다.

그래서 인덱스는 오프라인 파이프라인에서 빌드하고 GCS 같은 스토리지에 업로드한다. 검색 서버는 manifest 파일만 보고 **현재 어떤 인덱스 버전을 써야 하는지**를 판단하여 새 버전이 올라오면 백그라운드에서 다운받고 메모리에서 인덱스를 로딩한 뒤 한 번에 교체하는 구조로 제작했다.
## 코드 레벨 분석
이걸 구현하기 위해 검색 서버의 일부 핵심 코드들을 가져왔다.
### 1. IndexHolder
검색의 모든 요청은 IndexHolder에서 먼저 **스냅샷**을 읽는다.
교체는 백그라운드에서 한 번에 이루어진다.
```python
class IndexHolder:
    def __init__(self):
        self._lock = threading.RLock()
        self._index = None
        self._id_map = None
        self._version = None

    def get_snapshot(self):
        with self._lock:
            return self._index, self._id_map, self._version

    def swap(self, index, id_map, version):
        with self._lock:
            self._index = index
            self._id_map = id_map
            self._version = version
```
* 검색 요청은 `get_snapshot()`으로 현재 인덱스를 읽는다
* 인덱스 교체는 `swap()`에서 한 번에 이루어진다
* 락이 있어 race condition 없음
* 교체 타이밍과 상관없이 항상 일관된 인덱스로 검색 가능
### 2. IndexLoader 
manifest에는 이렇게 적혀 있다.
```json
{
  "version": "20250101",
  "index_path": "path/to/index.faiss",
  "id_map_path": "path/to/id_map.json",
  ...
}
```
IndexLoader는 이 파일을 읽고 필요한 파일을 가져온 뒤, 인덱스를 실제로 로딩한다.

```python
def update_index_if_needed():
    manifest = load_manifest()

    _, _, current_version = index_holder.get_snapshot()
    if current_version == manifest.version:
        return  # 이미 최신

    # 인덱스 파일 다운로드 후 Faiss 인덱스 로딩
    index_bytes = storage.download_bytes(manifest.index_path)
    index = faiss.read_index(_write_temp_file(index_bytes))

    # id_map 다운로드
    raw_map = json.loads(storage.download_text(manifest.id_map_path))
    id_map = _normalize_id_map(raw_map)

    # IVF 인덱스라면 nprobe 설정
    if hasattr(index, "nprobe"):
        index.nprobe = manifest.nprobe

    # 최종 교체
    index_holder.swap(index, id_map, manifest.version)
```
* 버전이 바뀐 경우에만 새 인덱스를 다운로드
* 임시 파일을 통해 Faiss 인덱스 로딩
* id_map은 다양한 포맷을 dict 형태로 통일
* IVF-FLAT의 핵심 파라미터인 `nprobe`을 manifest에서 직접 관리
* 완성된 인덱스는 `swap()`으로 원자적 교체

### 3. Manifest Poller
서버가 뜨면 다음과 같은 루프가 백그라운드에서 계속 돌며 manifest를 체크한다.
```python
async def manifest_polling_loop():
    while True:
        await asyncio.to_thread(update_index_if_needed)
        await asyncio.sleep(settings.poll_interval_sec)
```
* 5분(poll_interval_sec)마다 manifest를 검사
* manifest가 바뀌면 IndexLoader가 인덱스를 새로 로딩
* 검색 요청은 이 와중에도 계속 정상 동작
* Offline 파이프라인이 manifest만 갱신해도 자동으로 반영됨
### 4. Search API
검색 API에서 흐름은 다음과 같다.
```python
index, id_map, version = index_holder.get_snapshot()
if not index:
    raise HTTPException(503, "Index not loaded yet")

# 1) 텍스트 → 임베딩
embedding = embed(req.query)

# 2) Faiss 검색
distances, indices = index.search(embedding.reshape(1, -1), req.top_k)

# 3) id_map으로 image_id 매핑
image_ids = [_resolve(id_map, int(idx)) for idx in indices[0] if idx >= 0]

# 4) DB에서 메타데이터 조회
metadata = fetch_images_metadata(image_ids)

return {
    "version": version,
    "results": assemble(distances, image_ids, metadata)
}
```
* 검색 시점의 인덱스 스냅샷을 그대로 사용
* 임베딩은 외부 모델 호출(텍스트 → 512차원 벡터)
* id_map으로 Faiss row index → image_id 변환
* 나머지 필요한 데이터는 DB에서 조회해 결합

# 디자인을 끝내며
한 편의 글에 담기에는 꽤 많은 내용을 다뤘던 것 같다.

pgvector 기반 구조의 한계를 직접 느끼는 것부터 시작하여, 실제로 서비스를 운영하는 과정에서 어떤 결정들을 내려야 했는지까지 벡터 검색을 서비스 수준에 맞게 설계하는 과정 전체를 이야기로 묶어보았다.

이번 글에서 다룬 핵심은 크게 네 가지다.
- 벡터 검색의 본질적 특징과, 기존 RDBMS와 충돌할 수밖에 없는 계산 구조
- 인덱스 선택의 트레이드오프, 그리고 우리 상황에 맞는 IVF-FLAT 선택 근거
- 왜 pgvector 인덱싱만으로는 근본 문제가 해결되지 않는지를 계산을 통해 검증
- Faiss 기반 전용 검색 서버로의 전환, 그리고 무중단 인덱스 업데이트를 위한 설계

이 구조를 도입한 이후, 검색 속도는 안정적으로 ms 단위로 내려왔고, Postgres는 다시 본연의 OLTP 역할에 집중할 수 있었고, 인덱스 업데이트는 서비스 중단 없이 유연하게 진행할 수 있게 되었다.

기회가 된다면 다음 글에서는 이 기반 위에서 검색 품질을 어떻게 정의하고, 어떻게 개선해 나갔는지 좀 더 운영 관점에서 깊게 다뤄보려고 한다.