---
title: "플로이드의 토끼와 거북이 알고리즘"
date: 2023-12-31T00:00:00+09:00
tags: ["algorithm", "graph"]
ShowToc: true
---

## 개요

그래프에서 사이클을 찾는 건 비교적 쉽게 구현할 수 있다. 내가 자주 참여하는 앳코더 컨테스트에서도 사이클을 찾는 문제가 단골 질문으로 C번 문제쯤에 등장하곤 했다.

오늘은 `함수 그래프(Functional Graph)`에서 사이클을 O(1)의  공간 복잡도로 찾을 수 있는 플로이드의 토끼와 거북이(Floyd's Hare and Tortoise) 알고리즘에 대해 알아보자.

---

## 어디에 쓰는 물건인가

이 알고리즘은 JomaTech의 천만 뷰 영상인 [If Programming Was Anime](https://www.youtube.com/watch?v=pKO9UjSeLew)에서 소개되었고 나도 이 영상을 통해 이런게 있다는 걸 처음 알았다 ㅋㅋ

![Joma Tech](/images/floyds-tortoise-and-hare/joma_tech.jpeg)

이 알고리즘은 함수 그래프에서 두 개의 포인터 만을 이용해서 사이클을 찾는 알고리즘이다. 울프람 알파는 [함수 그래프 정의](https://mathworld.wolfram.com/FunctionalGraph.html)를 다음과 같이 설명한다.

> A functional graph is a directed graph in which each vertex has outdegree one
>
> 방향 그래프에서 모든 정점의 outdegree가 1인 그래프

다시 말해서 임의의 정점 %%i%% 가 `(i, f(i))`의 관계를 가진 간선 하나를 가지고 있는 그래프를 말한다. 이런 그래프에서는 반드시 하나의 사이클이 존재한다. (트리의 간선의 개수는 %%|V|-1%%이기 때문에 여기서 하나의 간선을 추가하면 사이클을 가진 그래프가 생긴다)

[Geeks for Geeks](https://www.geeksforgeeks.org/floyds-cycle-finding-algorithm/)에서는 링크드 리스트에서 반복되는 구간을 찾는 알고리즘이라고 소개하는데 사이클을 가진 링크드 리스트가 함수 그래프이므로 이는 같은 말이다.

---

## 플로이드의 토끼와 거북이

이름에 플로이드가 붙어있긴 하지만 사실 이는 로버트 플로이드가 발명한 알고리즘이 아니다. 도널드 크루스라는 컴퓨터 과학자가 이를 플로이드가 발명한 알고리즘이라고 설명했는데, 플로이드가 발간한 논문 어디에도 이런 알고리즘에 대한 설명이 없다고 한다. 현재는 이게 이진 탐색 알고리즘 처럼 구전되어 전해져 내려왔다는 설이 유력하다.

잡설이 길었는데 이 알고리즘은 서로 다른 속도로 움직이는 두 개의 포인터로 구현된다. 구현 자체는 간단한데 서로 다른 속도로 움직이도록 내버려 두면 반드시 사이클 안의 한 정점에서 토끼와 거북이가 서로 만나게 된다.

```python
# `f(x)` = x 정점에 연결된 정점
tortoise = f(head)
hare = f(f(head))
while tortoise != hare:
    tortoise = f(tortoise)
    hare = f(f(hare))
```

![Tortoise and hare examples](/images/floyds-tortoise-and-hare/tortoise-and-hare.png)

사이클의 한 점을 찾는 걸 넘어서 사이클이 어디서 시작 되는지도 알아낼 수 있다.
```python
hare = head
while tortoise != hare:
    tortoise = f(tortoise)
    hare = f(hare)

# 사이클의 시작 지점
print(hare)
```

---
## 왜 이게 되는걸까?
수학적 증명 없이도 대충 직관적으로 이를 받아 들일 수 있다. 똑같이 출발했는데 토끼가 더 빨리 뛰어가므로 토끼가 먼저 사이클에 진입하게 된다. 계속 진행하다가 거북이가 사이클 안으로 진입하면 이 때, 토끼가 거북이를 따라 잡아야 하는 상황이 온다.

![Circle](/images/floyds-tortoise-and-hare/circle.png)

이 때 거북이는 1칸씩 움직이고, 토끼는 2칸씩 움직이기 때문에 각 진행 마다 상대적인 거리는 1칸씩 줄어들게 되므로 반드시 한 지점에서 만나게 된다. [LeetCode Discuss](https://leetcode.com/discuss/general-discussion/1116359/intro-to-floyds-cycle-detection-algorithm)와 [Wikipedia](https://en.wikipedia.org/wiki/Cycle_detection) 에서는 만나는 되는 시점에서 한 명을 `head`로 보내버리고 **한 칸씩 움직이면 왜 사이클의 시작점에서 만나는지 설명해주고 있다**

## 활용 문제
이를 활용하는 대표적인 문제로 [LeetCode - Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/description/)가 있다. 배열 안에서 중복된 원소를 찾는 문제인데 반드시 O(1) 공간 복잡도로 풀이할 것을 요구하고 있다. `[1,n]`범위의 수가 배열안에 존재하고 있고 중복된 원소는 1개만 존재하기 때문에 함수 그래프의 속성을 만족하며 반드시 사이클을 형성한다.

배열의 해당 원소의 값을 다음에 방문해야 할 곳으로 바라보는 링크드리스트로 취급하면서 알고리즘을 정직하게 구현하면 풀리는 문제이다.

```cpp
class Solution {
public:
    int findDuplicate(vector<int>& nums) {
        int fast = 0;
        int slow = 0;

        do {
            slow = nums[slow];
            fast = nums[nums[fast]];
        } while(slow != fast);

        fast = 0;
        while(fast != slow) {
            slow = nums[slow];
            fast = nums[fast];
        }

        return fast;
    }
}
```

[AtCoder 311 - Find It](https://atcoder.jp/contests/abc311/tasks/abc311_c) 311회차 ABC 컨테스트에서 출제된 C번 문제도 이를 활용하여 풀이할 수 있다. 여기서는 사이클에 속한 원소를 진행 방향 순서대로 중복없이 출력하도록 한다. 