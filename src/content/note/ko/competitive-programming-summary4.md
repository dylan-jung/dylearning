---
title: Competitive Programming Summary - 4
timestamp: 2025-09-10
toc: true
series: competitive-programming
tags:
  - learn/concept
---
# Bit-Parallel Algorithms

비트 연산의 특징

- Xor 연산은 암호학적 key 역할을 한다.
- And 연산은 스위치 역할을 한다.

대표적인 예제, **Counting Subgrids**

```c++
for (int a = 0; a < n; a++) {
	for(int b = 0; b < n; b++) {
		int count = (row[a]&row[b]).count();
	}
}
```

Amortized Analysis

### Reference

- Laaksonen Antti, Guide to Competitive Programming
- [Geek For Geeks](https://www.geeksforgeeks.org/dsa/successor-graph/)
