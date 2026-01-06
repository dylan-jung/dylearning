---
title: Competitive Programming Summary - 2
timestamp: 2025-09-08
toc: true
series: competitive-programming
tags:
  - learn/concept
---
### Dynamic Programming

- 그리디로는 optimal solution에 도달할 수 없을 때가 있다. 이러한 경우 effective하게 솔루션에 도달하기 위해 사용한다.
- 이전 state들의 조합(sub problems)으로 현재의 optimal state를 표현할 수 있는 문제에서 사용하는 테크닉이다. 자세한 설명은 생략한다.

예를 들어 동전 coins = {1, 3, 4}로 x = 5를 표현하는 경우의 수는 다음과 같이 계산할 수 있다.

$$
solve(x)=solve(x− 1)+ solve(x− 3)+ solve(x− 4)
$$

유명한 문제는 다음과 같다.

- [Longest Increasing Subsequence(LIS)](https://www.acmicpc.net/problem/11053)
- Paths in a Grid
- Knapsack Problems
- [Bitmask DP](https://www.acmicpc.net/problem/1176)
  - 동적 계획법에서 순열을 전부 나열하던 반복을 부분집합 반복으로 바꾸면, 탐색 공간을 에서 으로 줄일 수 있어 실질적으로 훨씬 효율적이다
- Counting Tilings

### Graph Basics

사용되는 용어

- node: 그래프를 구성하는 기본 단위(정점).
- edge: 두 노드를 연결하는 선(방향성과 가중치가 있을 수 있음).
- path: 간선을 따라 노드에서 노드로 이동하는 연속.
- connected: 무방향 그래프에서 임의의 두 노드 간 경로가 존재하는 상태.
- cycle: 시작 노드로 다시 돌아오는 경로(노드/간선이 반복됨).
- tree: 사이클이 없고 연결된 무방향 그래프(엣지 수 = 노드 수 − 1).
- directed: 간선에 방향이 있는 그래프(유향 그래프).
- weighted: 간선에 비용/길이 등 가중치가 있는 그래프.
- degree: 노드에 연결된 간선의 수(유향은 in-degree, out-degree로 구분).
- bipartite: 노드를 두 집합으로 나눠 같은 집합 내부 간선이 없도록 할 수 있는 그래프.

그래프 표현 방법

- Adjacency List

```c++
// directed
vector<int> adj[N];
adj[1].push_back(2);
adj[2].push_back(3);
adj[2].push_back(4);
adj[3].push_back(4);
adj[4].push_back(1);
```

```c++
// undirected
vector<pair<int,int>> adj[N];
adj[1].push_back({2,5});
adj[2].push_back({3,7});
adj[2].push_back({4,6});
adj[3].push_back({4,5});
adj[4].push_back({1,2});
```

```python
# python 예제
N = 10
adj = [[] for _ in range(N)]  # (이웃, 가중치)

adj[1].append((2, 5))
adj[2].append((3, 7))
```

만약 weight가 존재한다면, 함께 적정한 순서로 집어넣으면 된다.

- Adjacency Matrix

```c++
int adj[N][N];
```

$$
\begin{bmatrix}
	0 & 4 & 1 \\
	0 & 0 & 3 \\
	1 & 0 & 0\\
\end{bmatrix}
$$

Weight는 숫자로 표현할 수 있다.

- Edge List
  이렇게 쓰는 경우는 거의 없지만, Kruskal, Bellman–Ford 등 특정 알고리즘에 적합하다.

```c++
vector<tuple<int,int,int>> edges;

edges.push_back({1,2,3}); // 1 - 2, weights: 3
edges.push_back({2,3,2}); // 2 - 3, weights: 2
```

```python
edges = []  # (a, b, w)
edges.append((1, 2, 3))
edges.append((2, 3, 2))
```

### Graph Traversal

#### DFS

- adjency list를 활용하면 편함
- 시간복잡도는 $O(n + m)$임 ($n$: 노드의 수, $m$: 엣지의 수)

```c++
bool visited[N];
void dfs(int s) {
	if (visited[s]) return;
	visited[s] = true;
	// process node s
	for (auto u: adj[s]) {
		dfs(u);
	}
}
```

```python
N = 100_005
adj = [[] for _ in range(N)]
visited = [False]*N

def dfs(s):
    if visited[s]:
        return
    visited[s] = True
    # process s
    for u in adj[s]:
        dfs(u)
```

#### BFS

- adjency list를 활용하면 편함
- 큐를 이용함. 무가중 최단거리에서 유용함.(어떻게 보면 해당 아이디어를 가중치로 확장하면 다익스트라 알고리즘이 됨)

```c++
#include <queue>

queue<int> q;
bool visited[N];
int distance[N];

// node x에서 시작함
visited[x] = true;
distance[x] = 0;
q.push(x);

while (!q.empty()) {
	int s = q.front(); q.pop();
	// process node s
	for (auto u : adj[s]) {
		if (visited[u]) continue;
		visited[u] = true;
		distance[u] = distance[s]+1;
		q.push(u);
	}
}
```

```python
from collections import deque

dq = deque([x])
visited[x] = True
dist[x] = 0
while dq:
	s = dq.popleft()
	# process s
	for u in adj[s]:
		if visited[u]:
			continue
		visited[u] = True
		dist[u] = dist[s] + 1
		dq.append(u)
```

둘 다 자주 사용하는 알고리즘이지만 구현하기에는 DFS가 더 쉬워서 더 좋은 선택이다.
유명한 문제들은 다음과 같다.

- Connectivity Check
- Cycle Detection
- Bipartiteness Check

### Shortest Path

#### Bellman-Ford Algorithm

메인 아이디어는 $n - 1$라운드동안 모든 엣지들을 돌면서 distance의 최소값을 업데이트를 하는 것이다. 만약 이를 넘어간다면 Negative Cycle이 존재한다는 것을 알 수 있다.
이 알고리즘은 edge list를 이용하여 간선을 표현한다.

```c++
for (int i = 1; i <= n; i++) {
	distance[i] = INF;
}
distance[x] = 0;
for (int i = 1; i <= n-1; i++) {
	for (auto e : edges) {
		int a, b, w;
		tie(a, b, w) = e;
		distance[b] = min(distance[b], distance[a]+w);
	}
}
```

```python
dist = [INF]*(n+1)
dist[src] = 0
for _ in range(n-1):
	for a, b, w in edges:
		if dist[a] == INF:
			continue
		if dist[b] > dist[a] + w:
			dist[b] = dist[a] + w
```

해당 알고리즘의 시간 복잡도는 $O(nm)$이다. ($n$: 노드의 수, $m$: 엣지의 수) 느린 편이지만 음수 간선이 가능하다는 것이 장점이다.
변종으로는 the SPFA algorithm ("Shortest Path Faster Algorithm")이 있다.

대표 문제들은 다음과 같다.

- [Negative Cycle Check](https://www.acmicpc.net/problem/11657)

#### Dijkstra's Algorithm

메인아이디어는 아직 처리되지 않았고 거리가 가능한 한 작은 노드를 계속해서 선택하는 것이다. 시간복잡도는 $O(n+m * log m)$으로 표현할 수 있어 효과적이다. 다만 '거리가 점점 커진다'를 가정으로 하고 있으므로 음수 weight의 간선은 불가능하다.

구현은 Priority Queue로 distance를 지속적으로 계산하여 관리한다. adjacency lists를 쓰자. (-d, x)로 써서 distance를 오름차순으로 관리한다.

```c++
priority_queue<pair<int,int>> q;
// ... q를 채움
for (int i = 1; i <= n; i++) {
distance[i] = INF;
}
// x부터 시작
distance[x] = 0;
q.push({0,x});
while (!q.empty()) {
	int a = q.top().second; q.pop();
	if (processed[a]) continue;
		processed[a] = true;
	for (auto u : adj[a]) {
		int b = u.first, w = u.second;
		if (distance[a]+w < distance[b]) {
			distance[b] = distance[a]+w;
			q.push({-distance[b],b});
		}
	}
}
```

```python
import heapq

dist = [INF]*(n+1)
dist[src] = 0
pq = [(0, src)]
visited = [False]*(n+1)
while pq:
	d, a = heapq.heappop(pq)
	if visited[a]:
		continue
	visited[a] = True
	for b, w in adj[a]:
		nd = d + w
		if nd < dist[b]:
			dist[b] = nd
			heapq.heappush(pq, (nd, b))
```

#### Floyd-Warshall Algorithm

Bellman-Ford와 Dijkstra's Algorithm은 모두 '**한 노드**'에서의 다른 모든 노드들의 최소 거리를 구하는 알고리즘이다. 다만 '**모든 노드**'에서 각자 모든 노드들의 최소 거리를 구하는 알고리즘이 필요할 수 있다. 이때 Floyd-Warshall를 이용한다.
메인 아이디어는 각 라운드마다 '중간다리' 역할을 하는 노드를 선택한다. 이 노드를 통해 최소로 만들 수 있는 경로가 생긴다면 업데이트한다.
구현은 간단하다. adjacency matrix를 이용하여 구현한다.

```c++
// 초기화: 알고있는 distance만 먼저 초기화한다.
for (int i = 1; i <= n; i++) {
	for (int j = 1; j <= n; j++) {
		if (i == j) dist[i][j] = 0;
		else if (adj[i][j]) dist[i][j] = adj[i][j];
		else dist[i][j] = INF;
	}
}
// Floyd-Warshall Algorithm
for (int k = 1; k <= n; k++) { // 이때 k가 중간 다리
	for (int i = 1; i <= n; i++) {
		for (int j = 1; j <= n; j++) {
			dist[i][j] = min(dist[i][j],dist[i][k]+dist[k][j]);
		}
	}
}
```

```python
INF = 10**18

# dist: n x n matrix, dist[i][i]=0, 없으면 INF로 초기화
n = len(dist)
for k in range(n):
	dk = dist[k]
	for i in range(n):
		if dist[i][k] == INF:
			continue
		dik = dist[i][k]
		for j in range(n):
			if dk[j] == INF:
				continue
			nd = dik + dk[j]
			if nd < dist[i][j]:
				dist[i][j] = nd
```

시간복잡도는 $O(n^3)$이다.

### Reference

- Laaksonen Antti, Guide to Competitive Programming
