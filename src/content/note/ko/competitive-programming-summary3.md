---
title: Competitive Programming Summary - 3
timestamp: 2025-09-09
toc: true
series: competitive-programming
tags:
  - learn/concept
---
그래프 이론에 대한 내용을 추가적으로 정리한다.

### Directed Acyclic Graphs (DAG)

사이클이 없는 유향 그래프를 DAG라 한다. DAG는 항상 위상 정렬이 가능하며, 각 연결 성분에는 적어도 하나의 진입차수 0(소스)와 진출차수 0(싱크) 정점이 존재한다. 일반 유향 그래프는 강연결요소(SCC)를 축약하면 항상 DAG로 변환된다.

핵심 용도는 “의존성 순서가 있는 문제”를 선형 순서(위상 순서)로 펴서 선형 스캔/DP로 해결하는 것이다. 음수 가중치가 있어도 사이클이 없으면 안전하다.

#### Topological Sorting

두 가지 표준 방법이 있다. 둘 다 시간복잡도는 $O(n+m)$이다. 그러나 DFS(후위순) 기반이 더 구현하기 쉬우므로 이를 위주로 알아본다.

- 상태 관리: 0=미방문, 1=진행 중, 2=완료.
- DFS에서 간선 $u\to v$가 진행 중(1) 정점으로 향하면 백엣지이며 사이클 존재.
- 모든 인접 탐색을 마친 뒤 스택에 푸시하고, 마지막에 스택을 뒤집으면 위상 순서.

```c++
int n;
vector<int> adj[N];
int state[N]; // 0,1,2
vector<int> order;
bool has_cycle = false;

void dfs(int u){
    state[u] = 1;
    for(int v: adj[u]){
        if(state[v] == 0) dfs(v);
        else if(state[v] == 1) has_cycle = true;
    }
    state[u] = 2;
    order.push_back(u);
}

vector<int> topo_sort(){
    for(int i=1;i<=n;i++) if(state[i]==0) dfs(i);
    reverse(order.begin(), order.end());
    return order; // has_cycle이면 DAG 아님
}
```

```python
n = len(adj)
state = [0] * n  # 0=미방문, 1=진행 중, 2=완료
order = []
has_cycle = False

def dfs(u):
	global has_cycle
	state[u] = 1
	for v in adj[u]:
		if state[v] == 0:
			dfs(v)
			if has_cycle:
				return
		elif state[v] == 1:
			# back-edge 발견 => 사이클
			has_cycle = True
			return
	state[u] = 2
	order.append(u)

for u in range(n):
	if state[u] == 0:
		dfs(u)
		if has_cycle:
			return [], True

order.reverse()
```

#### Shortest/Longest Paths on DAG

DAG에서는 위상 순서대로 간선을 느슨화(relaxation)하면 단일 시작점 최단/최장 경로를 $O(n+m)$에 계산한다. 음수 가중치도 안전하다(사이클이 없으므로).

- 단일 시작점 최단 경로 / 최장 경로

```c++
// DAG 최단 경로
const long long INF = 9e18;
int n;
vector<pair<int,int>> adj[N]; // (v, w)

vector<int> topo; // 미리 위상 정렬
long long dist[N];

void dag_shortest(int s){
    for(int i=1;i<=n;i++) dist[i]=INF;
    dist[s]=0;
    for(int u : topo){
        if(dist[u]==INF) continue;
        for(auto [v,w]: adj[u]){
            if(dist[v] > dist[u] + w){
                dist[v] = dist[u] + w;
            }
        }
    }
}
```

```python
# DAG 최장 경로
INF = 10**18
def dag_longest(adj, w, topo, s):
    n = len(adj)
    dist = [-INF]*n
    dist[s] = 0
    for u in topo:
        if dist[u] == -INF:
            continue
        for v in adj[u]:
            nd = dist[u] + w[u][v]
            if nd > dist[v]:
                dist[v] = nd
    return dist
```

#### Path Counting and Variants

- 경로 수 세기: 시작점 $s$에서 위상 순서대로 DP.
- $dp[s]=1$, 간선 $u\to v$마다 $dp[v]\mathrel{+}=dp[u]$.

```python
def count_paths(adj, topo, s):
    n = len(adj)
    dp = [0]*n
    dp[s] = 1
    for u in topo:
        for v in adj[u]:
            dp[v] = dp[v] + dp[u]
    return dp
```

#### Cycle Detection and SCC to DAG

- 위상 정렬이 실패(처리 수 < $n$)하면 사이클이 있다.
- 일반 유향 그래프는 SCC를 축약하면 DAG가 되며, 의존성 해석, 경로 DP 등을 이 축약 DAG에서 수행한다.

#### DAG as DP Graph

사실상 대부분의 동적 계획법은 “상태 노드, 전이 간선”으로 이루어진 DAG로 표현된다. 코인 문제, 문자열 DP, 비트마스크 DP 등도 상태 의존성을 DAG로 보고 위상 순서(의존성 순서)에 따라 DP를 수행한다고 이해하면 통일적으로 설계할 수 있다.

### Successor Graphs

directed graph에서 각 노드의 outdegree가 1이면 successor(또는 functional) 그래프라 한다. $succ(x)$로 모든 간선을 표현할 수 있다.

![[Pasted image 20250909154607.png]]
예를 들어 위와 같은 그래프이다.[^1]

$succ(x, k)$를 노드를 $k$ 이동한 결과라고 하면, naive한 방법으로는 $O(k)$가 필요하지만 binary lifting을 쓰면 $O(logk)$에 처리한다.

#### Finding Successors (Binary Lifting)

메인 아이디어는 다음과 같다. $2^t$의 walk에 대해 미리 jump_table을 계산을 한다. 질의가 들어오면 이를 binary로 나누어 jump_table을 이용하여 계산한다.

$$
\text{succ}(x,k) =
\begin{cases}
	\text{succ}(x), & k = 1 \\[6pt]
	\text{succ}(\text{succ}(x, k/2), k/2), & k > 1
\end{cases}
$$

예를들어, 다음과 같이 나타낼 수 있다. 11 = 8 + 2 + 1이므로, $succ(x,11)=succ(succ(succ(x,8),2),1)$

| **x**          | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   |
| -------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| succ(**x**, 1) | 3   | 5   | 7   | 6   | 2   | 2   | 1   | 6   | 3   |
| succ(**x**, 2) | 7   | 2   | 1   | 2   | 5   | 5   | 3   | 2   | 7   |
| succ(**x**, 4) | 3   | 2   | 7   | 2   | 5   | 5   | 1   | 2   | 3   |
| succ(**x**, 8) | 7   | 2   | 1   | 2   | 5   | 5   | 3   | 2   | 7   |
| ...            |     |     |     |     |     |     |     |     |     |

precalculation은 위의 테이블을 채우는 정도의 시간 복잡도가 걸린다. $O(log M * u)$ ($u$는 노드의 수, M은 쿼리의 Maximum)

#### Cycle Detection

Floyd’s algorithm은 그래프의 사이클을 탐지할 때 좋은 알고리즘이다.
메인 아이디어는 다음과 같다. $k$번째 forward를 진행할 때, 최초의 $k == 2k$를 찾으면 cycle을 찾는 것이다. cycle로 $k$만큼 공통적으로 나누어떨어지므로 한 곳에서 만나게 된다. 이는 시간복잡도는 $O(n)$이지만, 메모리는 $O(1)$을 차지하므로 효율적이다.

```c++
a = succ(x);
b = succ(succ(x));
while (a != b) {
	a = succ(a);
	b = succ(succ(b));
}
```

### Union Find (Disjoint Set Union, DSU)

서로소 집합 자료구조로, “원소들이 같은 집합(연결 성분)에 속하는가?”를 매우 빠르게 처리한다. Kruskal’s MST, 연결성 판단, 사이클 검출 등에 사용한다. 핵심 연산은 두 가지다.

- find(x): x의 대표(parent 루트)를 찾는다. 경로 압축(path compression)으로 거의 $O(1)$
- unite(a,b): 두 집합을 합친다. union by size/rank로 거의 O(1).

```c++
vector<int> p;

void init(int n){
	p.resize(n+1);
	iota(p.begin(), p.end(), 0);
}

int find(int x){
	while(p[x]!=x){
		p[x] = p[p[x]]; // path halving
		x = p[x];
	}
	return x;
}

bool unite(int a, int b){
	a = find(a); b = find(b);
	if(a==b) return false;
	p[b] = a;
	return true;
}
```

```python
class UF:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, x):
        # path halving
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def unite(self, a, b):
        a = self.find(a)
        b = self.find(b)
        if a == b:
            return False
        self.p[b] = a
        return True
```

더 최적화가 필요하다면 Size를 이용하여 merge할 노드를 고르는 로직을 넣어 더 최적화 시킬 수 있다.

### Minimum Spanning Trees

무방향 연결 가중 그래프에서 모든 정점을 연결하는 부분 그래프 중 가중치 합이 최소인 트리를 말한다. 트리이므로 간선 수는 $n-1$이다. greedy한 방법으로 Minimum, Maximum Spanning Tree를 구할 수 있다는 것이 증명되어 있다.

#### Kruskal’s Algorithm

메인 아이디어는 작은 가중치의 edge부터 그리디하게 그래프에 하나씩 추가하는 것이다. 하나의 트리가 완성되면 알고리즘은 끝난다.
구현은 edge list를 이용하면 편하다.

하나의 트리가 완성되었다는 것을 판단하기 위해서 Union-Find 기법을 사용한다.

- edge들을 정렬한다($O(m * log m)$, $m$은 edge의 개수)
- edge들를 하나씩 뽑고 $u$, $v$에 대해 연결되어 있지 않다면 연결한다.(unite한다)($O(m \alpha (n))$)

```c++
vector<tuple<int, int, int>> E;
int tree[1001];
int n, m, cost;

// Union-Find Part
int find(int t) {
    if(tree[t] == t) return t;
    return find(tree[t]);
}

void unite(int a, int b) {
    int x = find(a);
    int y = find(b);
    tree[x] = tree[y];
}

// Kruskal Part
void kruskal() {
    sort(E.begin(), E.end());
    for (int i = 0; i < 1001; i++)
        tree[i] = i;
	cost = 0;
    for (auto &&item : E)
    {
        int a, b, c;
        tie(c, a, b) = item;
        if(find(a) == find(b)) continue;
        unite(a, b);
        cost += c;
    }
}
```

```python
# Kruskal: edges = [(w,u,v)], 정점은 0-index 가정(입력에 따라 1-index면 -1 처리)
def kruskal(n, edges):
    edges.sort()  # w 오름차순
    dsu = DSU(n)
    total = 0
    picked = 0
    used = []
    for w,u,v in edges:
        if dsu.unite(u, v):
            total += w
            used.append((u, v))
            picked += 1
            if picked == n-1:
                break
    if picked != n-1:
        return -1, []  # 연결 아님
    return total, used
```

따라서 $O(m * log n)$($n$은 노드의 수, $m$은 엣지의 수)의 시간복잡도를 가진다.

#### Prim's Algorithm

아이디어는 하나의 정점에서 시작하여, “현재 트리와 인접한 간선 중 가장 가중치가 작은 간선”을 반복 채택한다. 다익스트라, BFS와 굉장히 비슷한 아이디어를 가지고 있다.

마찬가지로 $O(m * log n)$($n$은 노드의 수, $m$은 엣지의 수)의 시간복잡도를 가진다.

```c++
vector<bool> visited(n, false);
priority_queue<pair<int,int>> pq;

int totalCost = 0;
pq.push({0, 0}); // {가중치, 시작노드}

vector<tuple<int,int,int>> edges = {
	{0,1,2}, {0,3,6}, {1,2,3}, {1,3,8}, {1,4,5}, {2,4,7}, {3,4,9}
};

for (auto [u, v, w] : edges) {
	graph[u].push_back({v, w});
	graph[v].push_back({u, w}); // 무방향
}

while (!pq.empty()) {
	auto [w, u] = pq.top();
	w *= -1;
	pq.pop();

	if (visited[u]) continue;
	visited[u] = true;
	totalCost += w;

	for (auto [v, weight] : graph[u]) {
		if (!visited[v]) {
			pq.push({-weight, v}); // 여기서 음수의 weight를 집어넣어 최소값으로 정렬
		}
	}
}
```

```python
graph = [[] for _ in range(n)]

edges = [
	(0,1,2), (0,3,6), (1,2,3), (1,3,8), (1,4,5), (2,4,7), (3,4,9)
]
for u, v, w in edges:
	graph[u].append((v, w))
	graph[v].append((u, w))  # 무방향

visited = [False] * n
pq = [(0, 0)]  # (가중치, 노드)
total_cost = 0

while pq:
	w, u = heapq.heappop(pq)
	if visited[u]:
		continue
	visited[u] = True
	total_cost += w

	for v, weight in graph[u]:
		if not visited[v]:
			heapq.heappush(pq, (weight, v))
```

### Reference

- Laaksonen Antti, Guide to Competitive Programming
- [Geek For Geeks](https://www.geeksforgeeks.org/dsa/successor-graph/)
