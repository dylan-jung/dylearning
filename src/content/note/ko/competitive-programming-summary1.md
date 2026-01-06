---
title: Competitive Programming Summary - 1
timestamp: 2025-09-07
toc: true
series: competitive-programming
tags:
  - learn/howto
---
추후 코딩테스트 혹은 competitive programming을 위해 쓸만한 아이디어와 구현 패턴을 요약한다. 근본 이론보다 실전적으로 바로 가져다 쓸 수 있는 코드 조각과 주의점 위주로 정리한다. 모든 예제는 C++과 Python을 함께 제시한다. 이 글은 Guide to Competitive Programming를 기반으로 작성한다.

### Generating Subset

부분집합은 원소를 “포함/미포함” 두 갈래로 분기해 전수 탐색한다. 공집합부터 전체집합까지 $O(2^n)$.

C++ (포함/미포함 백트래킹)

```c++
int n;
vector<int> subset;

void process_subset(const vector<int>& s) {
    // subset s를 이용한 처리
}

void search(int k) {
    if (k == n) {
        process_subset(subset);
        return;
    }
    // 포함
    subset.push_back(k);
    search(k+1);
    subset.pop_back();
    // 미포함
    search(k+1);
}

int main() {
    n = 5;
    search(0);
}
```

Python (포함/미포함 백트래킹)

```python
n = 5
subset = []

def process_subset(s):
    # subset s를 이용한 처리
    pass

def search(k):
    if k == n:
        process_subset(list(subset))
        return
    subset.append(k)
    search(k+1)
    subset.pop()
    search(k+1)

search(0)
```

비트마스크 순회도 자주 쓰인다. $i$의 각 비트가 포함 여부를 나타낸다.

C++

```c++
int n = 5;
for (int mask = 0; mask < (1<<n); ++mask) {
    vector<int> s;
    for (int i = 0; i < n; ++i) if (mask & (1<<i)) s.push_back(i);
    // process subset s
}
```

Python

```python
n = 5
for mask in range(1<<n):
    s = [i for i in range(n) if mask & (1<<i)]
    # process subset s
```

### Permutation

가능하면 표준 라이브러리를 적극 활용한다.

C++ (next_permutation)

```c++
vector<int> p(n);
iota(p.begin(), p.end(), 1); // 1..n
do {
    // process permutation p
} while (next_permutation(p.begin(), p.end()));
```

Python (itertools.permutations)

```python
from itertools import permutations

for p in permutations(range(1, n+1)):
    # process permutation p
    pass
```

직접 구현(백트래킹)이 필요할 때:

C++

```c++
int n;
vector<int> perm;
vector<bool> used;

void process_perm(const vector<int>& p) {
    // 처리
}

void dfs() {
    if ((int)perm.size() == n) {
        process_perm(perm);
        return;
    }
    for (int i = 1; i <= n; ++i) {
        if (used[i]) continue;
        used[i] = true;
        perm.push_back(i);
        dfs();
        perm.pop_back();
        used[i] = false;
    }
}

int main() {
    n = 3;
    used.assign(n+1,false);
    dfs();
}
```

Python

```python
n = 3
perm = []
used = [False]*(n+1)

def process_perm(p):
    # 처리
    pass

def dfs():
    if len(perm) == n:
        process_perm(list(perm))
        return
    for i in range(1, n+1):
        if used[i]:
            continue
        used[i] = True
        perm.append(i)
        dfs()
        perm.pop()
        used[i] = False

dfs()
```

이 외에도 python에서는 itertools의 combination, product로 recursive 한 백트래킹을 사용할 수 있다..

### Sort

직접 구현보다 표준 정렬을 사용한다. 대부분 $O(n\log n)$의 Timsort(Python) 또는 Introsort(C++).

C++

```c++
vector<int> v = {4,2,5,3,5,8,3};
sort(v.begin(), v.end());                // 오름차순
sort(v.rbegin(), v.rend());              // 내림차순
```

Python

```python
l1 = [4,2,5,3,5,8,3]
l1.sort()                                # 제자리 정렬
l2 = sorted(l1)                          # 새 리스트 반환
l1.sort(reverse=True)                    # 내림차순
```

사용자 정의 비교/키:

C++

```c++
vector<string> v = {"a", "bbb", "cc"};
auto comp = [](const string& a, const string& b){
    if (a.size() != b.size()) return a.size() < b.size();
    return a < b;
};
sort(v.begin(), v.end(), comp);
```

Python

```python
v = ["a","bbb","cc"]
v.sort(key=lambda s: (len(s), s))  # 길이→사전식
```

주의:

- Python은 안정 정렬이라 다중 키 정렬이 용이하다.

### Binary Searching

정렬된 배열에서의 이진 탐색, 횟수/범위 계산, 단조 함수의 경계 탐색

경계 탐색(첫 ≥x, 첫 >x):
C++

```c++
vector<int> v = {2,3,3,5,7,8,8,8};
auto itL = lower_bound(v.begin(), v.end(), 5); // 첫 ≥5
auto itU = upper_bound(v.begin(), v.end(), 5); // 첫 >5
int cnt = itU - itL;                           // 5의 개수
```

Python

```python
import bisect
v = [2,3,3,5,7,8,8,8]
L = bisect.bisect_left(v, 5)   # 첫 ≥5
U = bisect.bisect_right(v, 5)  # 첫 >5
cnt = U - L
```

대다수의 경우에는 위와 같이 라이브러리를 사용하는 것이 더 빠르게 푸는 방법이지만, 아래와 같이 직접 구현할 일도 있다.

C++ (기본 이진 탐색)

```c++
int binary_search_idx(const vector<int>& a, int x) {
    int lo = 0, hi = (int)a.size()-1;
    while (lo <= hi) {
        int mid = lo + (hi - lo)/2;
        if (a[mid] == x) return mid;
        if (a[mid] < x) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1; // not found
}
```

Python (기본 이진 탐색)

```python
def binary_search_idx(a, x):
    lo, hi = 0, len(a)-1
    while lo <= hi:
        mid = (lo+hi)//2
        if a[mid] == x:
            return mid
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

단조 조건자에서 최소/최대 참 인덱스 찾기(“가능/불가능” 판정 기반):

C++

```c++
int first_true(int lo, int hi, auto pred) { // pred(mid) 단조 true/false
    int ans = hi+1;
    while (lo <= hi) {
        int mid = lo + (hi - lo)/2;
        if (pred(mid)) { ans = mid; hi = mid - 1; }
        else lo = mid + 1;
    }
    return ans; // 없으면 hi+1
}
```

Python

```python
def first_true(lo, hi, pred):
    ans = hi + 1
    while lo <= hi:
        mid = (lo + hi)//2
        if pred(mid):
            ans = mid
            hi = mid - 1
        else:
            lo = mid + 1
    return ans
```

### Data Structures

#### Dynamic Arrays

C++ vector

```c++
vector<int> v = {2,4,2,5,1};
vector<int> a(8);       // size=8, 초기값 0
vector<int> b(8, 2);    // size=8, 초기값 2

v.push_back(3); // ...3
v.push_back(2); // ...3,2
v.push_back(5); // ...3,2,5

sort(v.begin(), v.end());
reverse(v.begin(), v.end());
```

Python list

```python
v = [2,4,2,5,1]
a = [0]*8
b = [2]*8

v.append(3)
v.extend([2,5])
v.sort()
v.reverse()
```

연결 리스트와 splice(부분 리스트 이동)는 list에서 제공된다.

C++

```c++
list<int> L1 = {1,2,3,4};
list<int> L2 = {10,20,30};
auto it = next(L1.begin(), 2);     // L1: 1 2 |3 4
L1.splice(it, L2, L2.begin());     // L2의 첫 원소(10)를 it 앞에 이동
// 결과: L1: 1 2 10 3 4, L2: 20 30
```

Python 표준 list에는 splice가 없고, 슬라이싱으로 부분 교체를 흉내낼 수는 있지만 이동은 별도 구현이 필요하다.

#### deque

양끝 입출력 $O(1)$.

C++

```c++
#include <deque>
deque<int> d;
d.push_back(5);   // [5]
d.push_back(2);   // [5,2]
d.push_front(3);  // [3,5,2]
d.pop_back();     // [3,5]
d.pop_front();    // [5]
```

Python

```python
from collections import deque
d = deque()
d.append(5)
d.append(2)
d.appendleft(3)
d.pop()
d.popleft()
```

#### stack

C++

```c++
#include <stack>
stack<int> s;
s.push(2);
s.push(5);
cout << s.top() << "\n"; // 5
s.pop();
cout << s.top() << "\n"; // 2
```

Python (list 사용)

```python
s = []
s.append(2)
s.append(5)
print(s[-1])  # 5
s.pop()
print(s[-1])  # 2
```

#### queue

C++

```c++
#include <queue>
queue<int> q;
q.push(2);
q.push(5);
cout << q.front() << "\n"; // 2
q.pop();
cout << q.back() << "\n";  // 5
```

Python (deque로 큐)

```python
from collections import deque
q = deque()
q.append(2)
q.append(5)
print(q[0])     # 2
q.popleft()
print(q[-1])    # 5
```

#### ordered_set

정렬된 고유 원소 집합. 탐색/삽입/삭제 $O(\log n)$.

C++

```c++
#include <set>
set<int> s;
s.insert(3);
s.insert(2);
s.insert(5);
cout << s.count(3) << "\n"; // 1
cout << s.count(4) << "\n"; // 0
s.erase(3);
s.insert(4);
cout << s.size() << "\n";   // 3

auto it = s.lower_bound(4); // 첫 ≥4
```

Python 표준에는 균형 이진트리 기반 ordered set이 없다. 필요 시:

- 정렬된 리스트 + bisect로 흉내(삽입 O(n)).
- 또는 set으로 보관 후 매번 sorted로 정렬된 뷰를 얻는다.

#### unordered_set

해시 기반 집합. 평균 $O(1)$.

C++

```c++
#include <unordered_set>
unordered_set<int> us;
us.insert(3);
if (us.count(3)) { /* exists */ }
```

Python

```python
s = set()
s.add(3)
3 in s  # True
```

#### multiset

동일 원소의 중복 허용.

C++

```c++
#include <set>
multiset<int> ms;
ms.insert(5);
ms.insert(5);
ms.insert(5);
cout << ms.count(5) << "\n"; // 3
ms.erase(ms.find(5));        // 하나만 제거
```

Python (Counter로 멀티셋)

```python
from collections import Counter
ms = Counter()
ms.update([5,5,5])
print(ms[5])         # 3
ms.subtract([5])     # 하나 감소
if ms[5] == 0: del ms[5]
```

#### map

키-값 사전. C++ map은 정렬맵($O(\log n)$), unordered_map은 해시맵(평균 $O(1)$).

C++

```c++
#include <map>
map<string,int> m;
m["monkey"] = 4;
m["banana"] = 3;
m["harpsichord"] = 9;
cout << m["banana"] << "\n"; // 3

if (m.find("aybabtu") != m.end()) {
    // key exists
}
```

Python dict

```python
m = {}
m["monkey"] = 4
m["banana"] = 3
m["harpsichord"] = 9
print(m.get("banana", 0))  # 3
if "aybabtu" in m:
    pass
```

#### priority queue

최댓값/최솟값을 빠르게 꺼내는 자료구조.

C++ (최대 힙)

```c++
#include <queue>
priority_queue<int> pq;
pq.push(3);
pq.push(5);
pq.push(7);
pq.push(2);
cout << pq.top() << "\n"; // 7
pq.pop();
pq.push(6);
cout << pq.top() << "\n"; // 6
```

C++ (최소 힙)

```c++
priority_queue<int, vector<int>, greater<int>> minpq;
```

Python (heapq: 최소 힙)

```python
import heapq
pq = []
heapq.heappush(pq, 3)
heapq.heappush(pq, 5)
heapq.heappush(pq, 7)
heapq.heappush(pq, 2)
print(pq[0])               # 2 (최소)
heapq.heappop(pq)
heapq.heappush(pq, 6)
```

Python에서 최대 힙이 필요하면 음수로 보정하거나 튜플 우선순위를 활용한다.

```python
import heapq
maxpq = []
heapq.heappush(maxpq, -3)
heapq.heappush(maxpq, -5)
print(-maxpq[0])  # 5
```

- 우선순위 큐 삽입/삭제 $O(\log n)$, top 접근 $O(1)$.

---

- 정렬 후 선형 스캔이 가능한 상황에서는 set보다 sort가 더 빠르다.

### Reference

- Laaksonen Antti, Guide to Competitive Programming
