---
title: "SIEVE로 보는 최신 캐시 연구 동향 | LRU중심 연구에서 FIFO의 발전"
date: "2023-12-03T07:02:04.099Z"
slug: "어떤-소가-일을-더-잘합니까-fifo가-lru보다-낫습니다요-1a49b9060ce4"
description: "S3FIFO / SIEVE 소프트웨어 캐시 분야 최신 논문 소개"
tags: []
---

### S3FIFO / SIEVE로 보는 최신 캐시 연구 동향

캐시는 모던 컴퓨팅 인프라의 핵심 컴포넌트이며 성능은 높이고 비용은 줄이기 위해 사용된다. 웹, 앱, CDN, 백엔드 서버, 데이터베이스 그리고 가상메모리에 쓰이는 페이지 교체까지 소프트웨어 스택 전반에 많이 채용되고 있는 우수사원이다.

오늘은 최신 캐시 연구 동향을 알아보기 위해 <strong>SOSP’23, </strong>NSDI’24에 등재된 두 개의 논문을 다룬다. 두 논문은 카네기 멜런 대학교 [병렬 데이터 연구실(Parallel Data Lab)](https://www.pdl.cmu.edu/Publications/index.shtml) 에서 발표된 논문으로, 모두 본인이 각자의 분야에서 가장 뛰어난(SOTA) 캐시 알고리즘이라고 주장한다. S3-FIFO 캐시는 14개의 데이터셋에서 10개 분야에서 최고의 효율성을 기록했으며 Optimized-LRU와 비교하여 6x 성능을 향상시켰고, SIEVE는 코드 단 20줄을 고쳐서 ARC 알고리즘의 캐시 미스율을 최대 63.2% 줄였다

- [FIFO queues are all you need for cache eviction \| SOSP 2023](https://dl.acm.org/doi/10.1145/3600006.3613147)
- [SIEVE is Simpler than LRU: an Efficient Turn-Key Eviction Algorithm for Web Caches](https://junchengyang.com/publication/nsdi24-SIEVE.pdf) \| NSDI 2024

### INDEX

- 논문 근본론
- 소프트웨어 캐시(Cache)
- 캐시를 평가하는 메트릭들
- LRU (Least Recently Used) 캐시는 아니되옵니다
- 원-히트-원더 (One-hit-wonder)
- S3-FIFO 설계 및 구현
- S3-FIFO 성능 평가 및 분석
- SIEVE 설계 및 구현
- 마무리

## 논문 근본론

본격적인 이야기를 시작함에 앞서, 당신이 이 글을 끝까지 완주할 수 있도록 설득하기 위해 논문의 근본에 대해 말할 수 있어야 한다. 기본적으로 논문이란 다음 3가지를 만족해야 근본이 되기 위한 기본 조건은 갖추게 된다.

1.  이 문제가 왜 반드시 해결되어야 하는 ‘<strong>심각한 문제’</strong>인지 설명해야 한다.
2.  그동안 알려진 방법으로는 왜 (완벽히) 해결이 안되는지 서술해야 한다.
3.  본인이 제시하는 해결 방법과 연구 결과가 어떤 영향을 주는지 설명해야 한다.

세 항목이 잘 나타나 있고 좋은 학회에서 피어리뷰 까지 거쳤다면 비로소 근본있는 논문이라 할 수 있겠다. 필자는 여기에 더해 논문을 읽어보기 전에 저자의 프로필까지 보는 편이다.

두 논문의 주요 저자인 [Juncheng Yang](https://jasony.me/) 은 카네기 멜런 대학교의 박사과정을 지내고 있다. 본격적인 연구 생활 이전에는 트위터에서 인턴 및 연구원 생활을 지냈는데 저자의 주요 연구인 Segcache는 NSDI’21 에서 best-paper award를 수상했으며 이 연구성과가 반영된 소프트웨어가 트위터에 배포되어 실제로 쓰이고 있다고 한다. 여기까지 탐색해보고 속으로 생각했다. ‘아, 이 논문은 근본의 자세가 되었구나’ 이제 본격적으로 내용을 알아보자.

## 소프트웨어 캐시 (Cache)

캐시는 모던 컴퓨팅 인프라의 핵심 구성요소로 키/밸류 데이터베이스, 웹 캐시, CDN, 백엔드 서버 등 여러 분야에서 요청 레이턴시를 낮추고, 네트워크 대역폭을 줄이고, 반복적인 계산을 미리 해두는 등의 역할을 한다.

넷플릭스는 오직 캐시를 위해서만 [18,000여대의 서버를 운영하고](https://netflixtechblog.medium.com/cache-warming-leveraging-ebs-for-moving-petabytes-of-data-adcf7a4a78c3) 있고 트위터는 10만 CPU와 100 TB이상의 DRAM을 캐시를 위해서 대규모의 클러스터를 운영한다. 사실 우리가 다니고 있는 이 직장에서도 각 조직별로 사용하고 있는 캐시의 역할을 생각해보면 캐시의 성능을 높일 수 있다는 것이 이 산업분야에서 어떤 의미를 지니는지 쉽게 상상할 수 있다.

캐시는 내가 다루는 모든 <strong>데이터</strong>보다 저장 용량이 작기 때문에 저장 공간이 부족하면 일부 데이터를 지우고 새로운 내용을 채워 넣어야 한다. 이 때 어떤 데이터를 캐시에서 추방할 건 지 결정하는 <strong>축출 알고리즘(Eviction Algorithm)</strong>이 캐시의 핵심이다. e.g. LRU(Least Recently Used)캐시는 가장 오랫동안 참조되지 않은 데이터를 큐에서 밀어낸다.

## 캐시를 평가하는 메트릭들

어떤 캐시가 좋은 캐시인지 평가하는 항목에는 5가지가 있다.

- <strong>효율성(Efficiency) :</strong> 효율성은 캐시에 요청이 들어왔을 때 필요한 정보가 얼마나 자주 캐시에 남아있는가?를 의미한다. 보통 <strong>캐시 미스 비율(miss ratio)</strong>로 평가한다.
- <strong>처리율(Throughput) :</strong> 캐시가 초당 얼마나 많은 요청을 소화할 수 있는지 나타내며 QPS(Queries Per Seconds)라는 단위로 표현한다.
- <strong>확장성(Scalability) :</strong> 캐시에 동시 접근 할 때 캐시의 성능인 QPS가 얼마나 증가하는지를 가지고 상대적인 확장성의 높낮이를 비교할 수 있다. 모던 컴퓨터들은 점점더 많은 CPU를 탑재하고 있으며 AMD EPYC 9654P 장비는 192개의 CPU core를 가지고 있다.
- ⭐ <strong>플래시 친화성(Flash Friendly) </strong>: 캐시가 얼마나 플래시에 친화적인지 설명한다. 백엔드 개발자인 우리는 인-메모리나 Redis를 사용해서 캐시를 구현하면 DRAM을 많이 사용해서 구현할텐데 많은 데이터를 리전별로 공급해야 하는 CDN 사업자들은 SSD 같은 낸드 플래시 기반의 저장장치로 캐시로 구현한다고 한다. 하지만, 플래시의 경우 쓰기 횟수가 제한되어 있는데다 랜덤 액세스가 쓰기 증폭을 유발하는 등 자칫 잘못하면 플래시의 수명을 빨리 갉아먹는다. 완전히 마모되어서 쓸 수 없는 상태를 wear out되었다고 표현한다. 플래시 친화성은 캐시가 얼마나 flash 디바이스에 친화적으로 디자인 되었는지를 평가하는 척도이다.
- <strong>심플함(Simplicity) :</strong> 캐시가 얼마나 쉽게 구현되어 있는지를 나타낸다. 구현이 간단할수록 디버깅이 쉽고 유지보수가 간단하다.

## LRU (Least Recently Used) 캐시는 아니되옵니다

논문 저자의 말을 빌리면, 지난 수 세기동안 캐시 연구의 주인공은 LRU 캐시였다. 일반적으로 <strong>요청 워크로드(request workloads)</strong>가 최근 데이터가 더 자주 접근된다는 temporal locality 성질을 가지고 있어서 LRU가 FIFO캐시보다 더 효율적이다 라는 것이 일반적인 통념이라고 알려져 있다. ARU, SLRU, LIRS 등 최근 캐시 연구들은 모두 LRU를 기반으로 설계되어 왔다.

그렇다면 왜 그동안 LRU가 캐시 연구분야에서 강세였는가? 이런 통념을 뒤집는다는 게 학술적으로 어떤 의미를 지니고 있는지 좀 더 피부로 느끼려면 [Belady’s Anomaly](https://en.wikipedia.org/wiki/B%C3%A9l%C3%A1dy%27s_anomaly)에 대해 이해하면 좋다. 다음 그림과 같은 요청이 시간 순서대로 들어온다고 생각해보자.

![](/img/medium/1-JX8fJObUtUjlJBjuiri4iQ-0812724cc162.png)

캐시에 위 그림에 나타낸 요청이 순서대로 입력으로 주어진다

그리고 크기가 3인 FIFO 큐를 사용해서 들어오는 요청을 캐싱한다. 아래 그림에서 <strong>PF는 Page Fault</strong>를 나타내며 캐시 미스를 의미하고 X는 페이지 교체가 발생하지 않은 캐시 히트를 의미한다. 아래 그림을 보면 크기가 3인 FIFO 큐를 사용할 경우 캐시 히트가 3회 발생한다.

![](/img/medium/1-cBSElk1gYFCeriQ8xvpRGA-751fea93a4a8.png)

[Ref. Geeks for Geeks — Belady’s Anomaly in Page Replacement Algorithms](https://www.geeksforgeeks.org/beladys-anomaly-in-page-replacement-algorithms/)

아 캐시 크기가 너무 작으니까 캐시 크기를 늘리면 캐시 히트가 증가하고 캐시 미스가 감소해야겠지? 라는 생각이 직관적이지만 캐시 크기를 3에서 4로 늘릴 경우 오히려 캐시 미스가 증가하는 현상이 나타나는데 이를 <strong>Belady‘s Anomaly</strong> 이라고 부른다.

![](/img/medium/1-vHzGQxj6CmjL51cce-BT_Q-bf25bc0ae63a.png)

[Ref. Geeks for Geeks — Belady’s Anomaly in Page Replacement Algorithms](https://www.geeksforgeeks.org/beladys-anomaly-in-page-replacement-algorithms/)

<strong>Belady’s Anomaly</strong>은 이미 1980s 대에 정립된 이론이며 캐시에서 축출할 데이터를 선택할 때 우선순위를 고려하지 않아서 발생하는 것으로 알려진다. 그리고 이런 이상 현상은 LRU를 사용할 경우 확실히 발생하지 않아 캐시 미스가 감소한다. 이것을 그동안의 캐시 연구가 LRU를 최적화하는데 집중된 이론적 배경으로 설명할 수 있다.

1990년대에는 2개 이상의 정적인 LRU를 사용하는 연구가 있었고, 2000년대에는 LRU의 크기를 동적으로 변형시키거나 복잡한 메트릭을 평가 지표로 활용하곤 했다. 2010/2020년대에 들어서는 머신러닝을 이용해서 캐시에서 어떤 오브젝트를 밀어낼 것인지 선택하는 알고리즘들이 개발되면서 LRU를 이용한 캐시 구현이 점점 더 복잡해져 가고 있다. (e.g. LRU-k, TwoQ, SLRU, ARC, LIRS, GLCache, HALP)

논문의 저자는 LRU 캐시에 3가지 문제점이 있다고 지적한다.

1.  LRU캐시를 구현하는 방법은 다양하지만 [흔히 양방향 링크드 리스트(Doubly Linked List)로 구현되어 객체당 2개의 포인터를 요구한다](https://github.com/hashicorp/golang-lru/blob/main/internal/list.go#L10-L32). 캐시 객체의 개수가 많고 크기가 작을수록 오버헤드를 유발한다. (e.g. twitter, facebook 같은 워크로드)
2.  LRU는 캐시 히트가 발생하면 오브젝트에 락을 걸고 해당 객체를 리스트의 head로 프로모팅 해야 하는데 이 과정에서 최소 6번의 랜덤 액세스가 발생한다. Meta에서 개발된 [RocksDB는 LRU 캐시의 락을 확장성 병목으로 지목하기도 했다.](https://rocksdb.org/blog/2014/05/14/lock.html)
3.  마지막으로 LRU 캐시는 플래시 친화적이지 않다. 오브젝트 축출 순서가 정렬되어 있지 않기 때문에 랜덤 엑세스를 유발한다.

## 원-히트-원더 (One-hit-wonder)

캐시 축출 알고리즘인 LRU는 temporal locality성질에 의해 존재의 타당성을 얻었다면 저자는 FIFO 도입의 타당성을 입증하기 위해 원-히트-원더 (One-hit-wonder)라는 데이터의 새로운 성질을 사용했다. <strong>원-히트-원더</strong>란 요청 시퀀스에서 한 번만 등장하는 오브젝트의 비율을 말한다.

![](/img/medium/1-ibtEJVH3Oc0EjcN5NqdZnw-693147fb85e7.png)

S3-FIFO Queue \| One-hit-wonder ratio

위 그림을 보면 A부터 E까지 5개의 요청이 17초 동안 입력으로 주어진다. 시퀀스의 길이가 17인 경우 원-히트-원더는 ‘E’ 하나로 전체 객체 중 비율이 20%이지만 시퀀스 길이를 줄이수록 원-히트-원더 비율이 증가함을 보여준다.

![](/img/medium/1-UIqHLqeHLpVnLvmHrzd83A-aef304a56060.png)

Zipf’s law , [Twitter](https://github.com/twitter/cache-trace) , [Microsoft Research](http://iotta.snia.org/traces/block-io/388) 의 데이터를 보여주는 라인그래프

웹 캐시 워크로드는 일반적으로 <strong>멱급수 법칙</strong>(Power-law \| generalized Zipfian)을 따른다고 알려져 있다. 위 그림에서 왼쪽 두 개의 그래프는 Zipf 분포를 나타내고 오른쪽 두개는 트위터와 마이크로소프트 리서치에서 공개한 데이터를 토대로 원-히트-원더의 비율을 계산한 것이다.

그래프의 X축은 시퀀스가 포함하는 오브젝트의 비율을 나타낸 것이다. 그림 (d)를 보면 전체 오브젝트 중 10%를 포함하는 시퀀스에서 원-히트-원더 비율은 트위터의 경우 25%, MSR 데이터는 75%인 걸 알 수 있다. 트위터의 경우 Zipf 그래프를 추종한다기엔 너무 낮은 걸 알 수 있는데 소셜 네트워크 데이터가 일반적으로 좀 더 세게 왜곡(skew)되어 있다고 한다. <strong>이 데이터는 우리에게 캐시 크기를 전체의 10%로 책정 한다면 72%~78% 정도의 객체는 두 번 이상 쓰이지 않기 때문에 공간만 차지한다는 것을 알려준다.</strong>

![](/img/medium/1-do0zyEBKvIvWfP4LAMLCUA-b70738beab0e.png)

LRU 캐시 정책을 적용해서 객체를 축출할 당시의 freq 값이 몇인지 보여준다

저자들은 실제 데이터에 LRU 캐시 정책을 적용해보면서 오브젝트가 캐시에서 제거될 때 freq 카운트 값을 기록했다. 위에서 앞서 보여준 라인 그래프와 유사하게 트위터의 경우 대략 26%, MSR은 78%정도의 객체가 freq 값이 1인걸 보여준다. LRU캐시에 기록되긴 했지만 2번 이상 발생할 요청이 아니다. 세상에서 가장 완벽한 캐시를 만들려면 미래에 발생할 정보를 완벽히 알고있어야 하지만 그것은 불가능하다.

### Quick Demotion | 빠르게 강등시키기
위 관찰결과에 따라 자리만 차지하고 쓸모 없는 객체들은 빠르게 캐시에서 밀어낼 필요가 있다. 논문에서는 이를 빠른 강등(Quick Demotion) 이라고 표현했다. 기존에는 CDN 서버들이 Bloom Filter를 사용해서 이 역할을 하고 있지만 Bloom Filter는 너무 빠르게 정보를 제거해서 정확도가 떨어진다.

ARC, LIRS 등 캐시 알고리즘들이 캐시 오염(cache pollution)을 막기 위해 여러 가지 방법을 도입해서 사용하고 있지만 <strong>원-히트-원더 오브젝트가 얼마나 오랫동안 캐시에서 생존할 수 있는지</strong>는 표현하지 못해서 너무 빨리 제거하거나 너무 느리게 제거하곤 했다. 논문 저자들은 3개의 FIFO 큐만 이용해서원-히트-원더 비율을 낮추는 방법을 고안했다. 논문에 따르면 SOTA보다 높은 효율성을 가지면서 FIFO만 사용해서 설계된 첫번째 알고리즘이라고 한다.

## S3-FIFO 설계 및 구현

위에서 많은 이야기를 했지만 S3-FIFO의 설계 및 구현 난이도는 굉장히 쉬운 편이다. 숙련된 코더라면 당장 에디터 창을 열어서 본인이 직접 코딩할 수 있을 정도이다. S3-FIFO는 전체 캐시 크기의 10%의 공간을 차지하는 small queue <strong>S</strong>와 main queue <strong>M</strong> 그리고 나중에 M 보내기 위한 ghost queue <strong>G</strong> 이 세가지 FIFO queue로 이루어져 있다.

![](/img/medium/1-IITUp_SuQ0jQXJ8sXUwtjQ-4007187c32b8.png)

S3-FIFO의 구조

### 1️⃣ 읽기 연산 (Read)
큐에 저장될 각 오브젝트는 2 비트 공간을 가진 빈도수 정보를 기록한다. 읽기 연산은 S 혹은 M에 이미 객체가 있다면 freq 변수를 min(freq+1,3) 으로 업데이트하고, 객체가 없다면 캐시에 정보를 저장하는 삽입 연산을 수행한다.

![](/img/medium/1-Ha5lIuowYCFeqidsNMhDbw-122257d30f38.png)

### 2️⃣ 삽입 연산 (Insert)
캐시 공간이 가득 차 있다면 캐시 안에 있는 데이터를 제거해서 공간을 확보해야 한다. 이 연산이 <strong>evict()</strong> 이다. 공간을 확보 한 뒤에 ghost queue G에 데이터가 있다면 main queue M에 객체를 삽입하고 아니라면 S에 삽입한다.

![](/img/medium/1-WAqFsdrN1ZjHSTTEQZ8PGw-e9d0d6d361fe.png)

### 3️⃣ 캐시 축출 연산 (Eviction)
small queue S의 크기가 전체 캐시 크기의 10%를 넘는다면 S의 데이터를 제거하고 아니라면 M의 데이터를 제거한다.

![](/img/medium/1-vaC5L_2MdgWbEaq_onxw4Q-7e77c9683e35.png)

small queue S 에서 데이터를 제거할 때, 읽기 연산으로 기록한 빈도수가 1을 넘으면 main queue M으로 데이터를 이동시키고 아니라면 ghost queue G로 넘긴다. 주의 할 점은 M으로 데이터를 이동시키는 연산은 실제 지우는 것으로 취급하지 않고 G로 이동시킬 때만 evicted 변수를 true로 대입한다. 이를 비유하자면 <strong>단기기억(small queue)</strong>에서 <strong>장기기억(main queue)</strong>으로 보내는 걸로 생각하면 이해하기 쉽다.

![](/img/medium/1-2Xc_rGioXnevrldmpR__Hw-d8ccc3cf3c46.png)

main queue M 에서 데이터를 제거할 때는 freq 변수가 0인 데이터만 제거한다. 이 값이 1 이상이라면 -1을 하고 큐의 맨 앞에 다시 삽입한다.

![](/img/medium/1-sfhXwis70HlSDR7snGNtDQ-0200a29f6dcd.png)

의사코드이긴 하지만 전체 라인 수가 40줄 밖에 안되고 단순한 FIFO queue만을 사용하고 있기 때문에 알고리즘과 구현 난이도가 굉장히 쉽고 간편한게 특징이다.

### 4️⃣ 연산 비용 분석
캐시 미스가 발생하면 S or M 에서 캐시 축출이 발생하고 이 연산은 큐의 tail object를 M 또는 G로 이동시키는 연산을 포함한다. 특별히 M에서 발생하는 캐시 축출은 freq 변수를 보고 tail object를 큐의 head로 프로모팅 하는 과정을 포함한다. 프로모팅 하는 과정이 while문으로 되어 있는데 논문 저자들은 이게 실제로 발생하는 경우가 캐시 히트보다 현저히 적기 때문에 이 정도 오버헤드는 무시해도 된다고 말하고 있다.

ghost queue G는 장기기억으로 저장할지 말지만 결정하기 때문에 객체의 고유 아이디(ID)만을 저장한다. 만약 객체의 평균 크기가 4KB이고 ID가 4 byte integer라면 전체 캐시 크기의 0.09%만을 차지한다. G의 경우 꼭 큐일 필요는 없이 버킷 해시 테이블 같은 인덱스 자료구조를 사용해도 무방하다.

<strong>마지막으로 이 부분이 가장 중요해 보이는데</strong> 이 모든 연산이 lock-free 자료구조를 이용하면 락을 잡지 않고도 쓰레드-안전하게 구현이 가능하다는 것이다. 이것이 락을 잡는 LRU보다 성능이 더 높다고 주장하는 이유이다. 아래 구현체를 [lockfree queue를 go언어](https://github.com/golang-design/lockfree/blob/master/queue.go)로 구현한 일부를 가져왔다.

```go
func (q *Queue) Enqueue(v interface{}) {
    i := &directItem{next: nil, v: v} // allocate new item
    var last, lastnext *directItem

    for {
        last = loaditem(&q.tail)
        lastnext = loaditem(&last.next)

        if loaditem(&q.tail) == last { // are tail and next consistent?
            if lastnext == nil { // was tail pointing to the last node?
                if casitem(&last.next, lastnext, i) { // try to link item at the end of linked list
                    casitem(&q.tail, last, i) // enqueue is done. try swing tail to the inserted node
                    atomic.AddUint64(&q.len, 1)
                    return
                }
            } else { // tail was not pointing to the last node
                casitem(&q.tail, last, lastnext) // try swing tail to the next node
            }
        }
    }
}
```

사실 코드를 보면 쓰레드를 명시적으로 블럭킹 하지 않았을 뿐이지 CAS (Compare-And-Set) 연산과 loop를 이용해서 조건을 만족할 때 까지 계속 시도한다. 스레드의 개수가 CPU 코어 개수 보다 작다면 컨텍스트 스위칭 비용이 발생하지 않기에 성능이 높다라곤 하는데 lock-free 자료구조가 정말 더 빠른지에 대해서는 논란의 여지가 있다. 이 이야기는 본 포스팅의 지면을 할애해서 따로 설명하진 않는다.

## S3-FIFO 성능 평가 및 분석

성능 평가 항목에서 아래 세 질문의 답을 내릴 것이다.

- S3-FIFO의 효율성이 정말 SOTA 인가?
- S3-FIFO가 정말로 확장성이 높은가?
- S3-FIFO가 진짜로 flash cache design에 도움이 되는가?

### 데이터 셋(Dataset)
평가를 위해 총 14개의 데이터 셋을 이용했으며 이 중 11개는 공개된 데이터이고 3개는 기업에서 제공하는 비공개 데이터 셋이다. 웹 워크로드 뿐 아니라 블록 I/O, CDN, 키-밸류 데이터를 포함해서 총 854조개의 요청과 61조개의 오브젝트와 21,088 TB 규모의 트래픽, 그리고 총 3,753 TB 규모의 데이터를 가지고 실험을 진행했다. 아래 표는 이번 실험에 이용된 데이터 셋이다.

![](/img/medium/1-AErmh7Hsx_8_GBd2VODqLw-34ac7d6542ef.png)

S3-FIFO 큐의 성능 평가를 위해 사용된 데이터 셋

실험 자체는 [libCacheSim](https://github.com/1a1a11a/libCacheSim) 이라는 시뮬레이터를 이용했다. 재밌는 건 이게 논문 저자가 직접 개발한 시뮬레이터라는 것이다. META에서 만든 [libCache](https://github.com/facebook/CacheLib)을 시뮬레이션 용도로 변형한 거라서 실험 결과의 신뢰성에 대해서는 의심하지 않아도 된다. 필자가 재밌다고 한 건 코딩보다는 연구에만 강한 박사과정 학생분들도 꽤 많은데 이 분은 코딩 좀 치는 사람이라는 것이 재밌었다.

### 효율성 평가 (Efficiency)

효율성은 얼마나 캐시 미스가 작은지를 나타내는 지표이다. 아래 그림이 S3-FIFO 큐와 다른 13개의 캐시를 비교한 그림이다.

![](/img/medium/1-oHRh6WuCxneawoB2C-DCGQ-aa309d46dc73.png)

위 그래프의 Y축은 정말 기본적인 FIFO 큐에 비해서 얼마나 캐시 미스를 줄였는지 비율을 나타낸다. 값이 클수록 좋은 캐시 알고리즘이다. 그림을 보면 S3-FIFO큐가 모든 알고리즘 중에서 가장 효율이 좋음을 알 수 있다.

> 논문에서는 각 알고리즘 별로 얘는 이래서 안좋고, 쟤는 저래서 안좋고 캐시들이 왜 성능이 안좋은지 조목 조목 까는 공간이 있는데 이 포스팅에서는 다루지 않는다. 궁금하신 분은 논문의 8–9 페이지를 참고하면 된다.

그림의 왼쪽 그래프는 전체 객체의 10%를 캐시 공간으로 잡는 경우이고 오른쪽 그래프는 캐시 공간을 0.1%로 설정한 경우의 실험 결과이다. 캐시 공간을 줄이면 캐시 미스율도 같이 떨어지는 경향이 나타난다. 그리고 일부 데이터 셋에 대해선 S3-FIFO의 성능이 다른 것 보다 낮은 경우가 있었다. 이는 대 부분의 객체가 단 2번만 히트되는 워크로드인 경우 small queue S의 캐시 미스가 빈번히 발생했다고 한다. 하지만 이는 TinyLFU, LIRS, 2Q 처럼 캐시 공간을 여러개로 분리한 알고리즘 대부분에 적용되는 항목이다.

![](/img/medium/1-cCzTv5xtA7ElvoXkHzWsHg-574785d681e6.png)

데이터 셋 별로 비교한 그림 / 거의 뭐 그림 그리기 장인이다.

위 표는 각 데이터 셋 별로 결과를 세부적으로 나타낸 것이다. 캐시 알고리즘이 다양한 데이터 셋에 대해서 잘 적용되어야 견고한 알고리즘이라고 말할 수 있을 것이다. 캐시 크기가 큰 경우 S3-FIFO 큐가 14개 데이터셋 중에 13개 데이터 셋에 대해서 가장 우위를 점하고 있으며 캐시 크기가 작은 경우 에는 쓸만한 정도로 좋았다 라고 볼 수 있음을 알 수 있다.

### S3-FIFO는 왜 효과적인가?

S3-FIFO의 핵심은 원-히트-원더 객체를 빠르게 필터링 해서 가치가 없는 데이터를 캐시 공간에서 빠르게 제거하고 가치가 높은 객체를 오랫동안 보존하는 것이라고 설명했다. 이 원리가 잘 작동하는지 평가하기 위해 아래 두 가지 메트릭을 평가했다.

- <strong>Normalized quick demotion speed</strong>\
  객체가 얼마나 빨리 small queue S에서 제거되었는지 속도를 나타낸 것이다. LRU에서 데이터가 제거되는 속도를 기준 점으로 잡고 ARC, TinyLFU와 비교했다.
- <strong>Quick demotion precision</strong> : 제거된 오브젝트가 다시 캐시에 요청으로 들어오기 까지 걸리는 시간이 <strong>캐시 크기/캐시 미스율</strong> 보다 크다면 “아 역시 빨리 제거하길 잘했다" 라고 판단하고 이 비율을 계산했다.

![](/img/medium/1-7oGYhnYDfsiwLN4vDukZIQ-c851c1e8f154.png)

캐시 축출의 정확도와 속도를 나타낸 표

위 그래프에서 밝은 색일 수록 전체 캐시 크기에서 small queue S에 할당한 비율이 더 크다는 걸 의미한다. S3-FIFO와 TinyLFU가 비교해 볼만하다. 우측 하단의 그림 (d)를 보면 캐시 크기가 작은 경우 정확도 차이가 0.01% 정도로 거의 비슷하다고 하고, 그림 (b)를 보면 TinyLFU의 정확도가 더 높다고 나온다.

하지만 S3-FIFO에서는 small queue S가 클 수록 더 느리게 제거하고 정확도가 증가한다는 뚜렷한 경향성을 보여주지만 Tiny LFU는 불안정한 데이터를 보여준다. 즉 이 알고리즘을 실제 현업에 도입한기엔 캐시 알고리즘으로써의 견고함이 떨어진다.

S3-FIFO가 꼭 FIFO queue를 써야 했는가? LRU 3개로 구현하면 왜 안되는지 따져볼 수 있다. 논문에서는 그것도 구현해봤는데 비교할 가치를 느끼지 못할 정도로 제대로 동작하지 않았다고 한다.

### 플래시 친화적인가?

SSD를 오랫동안 사용할 수 있는지 알아보기 위해 CDN 데이터를 가지고 실험을 해본다. 플래시는 쓰기 횟수의 제한이 있기 때문에 최대한 DRAM을 많이 사용해야 한다. S3-FIFO를 생각해보면 small queue S와 ghost queue G는 메모리에 배치하고 장기기억에 해당하는 main queue M은 SSD에 분할해서 할당해서 플래시 친화성을 높인다.

Wikimedia & Tencent Photo CDN 데이터를 이용해서 실험을 진행했으며 3개의 비교군을 설정했다. Probabilistic 따로 안찾아봤고 [Flashield](https://www.usenix.org/conference/nsdi19/presentation/eisenman)<strong>(NSDI’19)</strong> 는 스탠포드 대학 연구진들이 발표한 연구로 머신 러닝을 이용한다.

CDN에서는 캐시를 평가할 때 캐시 미스율보다 네트워크 대역폭까지 함께 고려한다. 아래 그림의 Y축은 얼마나 많은 데이터 쓰기가 발생했는지 보여주고 X축은 캐시 미스율을 나타낸다. 그래프의 원점에 가까울수록 좋은 캐시라는 의미이다.

![](/img/medium/1-tjUPPZm2LKYCdo5XAD64WA-03b1b5eb1409.png)

S3-FIFO가 얼마나 플래시 친화적인지 보여주는 그래프

## 성능 평가

마지막으로 캐시의 QPS를 평가해보자 스레드 개수를 높여가면서 처리율이 증가하는지 따져보았다. 킹론상 S3-FIFO는 lock-free queue를 사용하기에 확장성이 높고 다른 LRU기반 캐시들은 락을 잡아서 구현해야 하기에 스레드 개수에 따른 성능 확장은 기대하기 어렵다.

> 아래 표에서는 뜬금없이 Segcache라는 애가 등장하는데 이것도 논문 1저자가 연구한 캐시의 한 종류이다. 논문 낸 김에 끼워팔아서 이것도 드셔보실래요? 권장하듯이 등장한 거라 별로 큰 의미는 없는 것 같다.

![](/img/medium/1-E2zkBMpXcfIrPGrlBRBZ9g-0e141b60450c.png)

S3-FIFO 큐의 성능 평가

## SIEVE 설계 및 구현

S3-FIFO가 큐를 세 개나 쓰면서 구현했다면 SIEVE는 한술 더 떠서 FIFO 큐 하나만을 사용해서 구현한다. 9개의 SOTA알고리즘과 비교해서 캐시 미스율을 크게 낮췄고 여기서도 락을 잡지 않아서 16-thread의 LRU캐시보다 2배 이상의 성능을 가진다고 한다.

SIEVE는 최고의 알고리즘은 아니지만 심플하면서도 강력한 캐시 축출 알고리즘이라고 시장에서 포지셔닝 하고 있다. 아래 표는 캐시 히트, 축출, 삽입연산을 구현하기위해 필요한 코드 라인 수를 비교해서 보여준다.

![](/img/medium/1-7JWMd5WqiD0PwaYtJtOZxg-c8994b01fb29.png)

각 알고리즘 별 필요한 코드 구현 라인 수

뿐만 아니라 실제 오픈소스를 수정해서 SIEVE를 구현하는데 필요한 라인수를 언어별로 보여준다. 테스트 코드를 수정하기 위한 라인 수는 표현하지 않았다. 새로운 캐시들이 계속 연구 결과로 발표되고 있지만 현업에서 실제로 적용되는 경우는 많지 않은데 그 이유를 구현의 복잡해지면 무언가 잘못되었을 때 디버깅 하기가 어렵고 버그가 발생할 가능성이 크기 때문이라고 설명한다. 이 논문에선 알고리즘의 심플함을 많이 강조한다.

![](/img/medium/1-etgDYcbG0nbBKX393mtYww-fdd6f633392a.png)

오픈소스에 SIEVE를 도입하기 위해 필요한 코드 구현 라인 수

### Lazy Promotion & Quick Demotion
Lazy Promotion은 객체를 캐시에 <strong>‘유지’</strong>하겠다 라는 판단을 데이터를 제거해야하는 시점에 판단하는 것을 말한다. LRU 캐시는 객체의 접근 빈도수를 업데이트 하면서 객체를 즉시 head로 프로모팅 하는 반면에 이를 최대한 지연 시켜서 프로모션에 필요한 비용을 줄이겠다는 전략이다. Quick Demotion은 위에서 한 번 설명한 내용이라 생략한다. 이 둘이 SIEVE의 주요 전략이다.

### CLOCK
SIEVE는 다른 캐시보다 CLOCK 알고리즘과의 비교가 매우 중요해보인다. 둘의 구현이 정말 종이 한장 차이로 비슷하기 때문이다. CLOCK 알고리즘은 객체에게 두 번째 기회를 줘서 다시 큐의 앞 부분으로 이동시키는 캐시 알고리즘으로 이미 [1969년에 논문](https://www.multicians.org/paging-experiment.pdf)으로 출간되었다.

### 구현 (Implementation)

![](/img/medium/1-Iwm6cQm7EtNshQjcLbDezA-a844143a76fa.png)

SIEVE와 CLOCK 구현체의 비교

위 그림은 SIEVE 알고리즘의 구현 원리와 함께 비교를 위해 FIFO-Reinsertion도 같이 보여준다. 사실 FIFO-Reinsertion과 CLOCK이 같은 알고리즘이기 때문에 CLOCK과 비교한다고 받아들이는게 좋다.

SIEVE는 하나의 큐와 hand 라는 특수한 포인터 변수를 함께 사용한다. 캐시 히트가 발생하는 경우 객체의 visited 변수를 1로 변경하는 역할만 하고 아무것도 하지 않는다. 캐시 미스의 경우 hand포인터가 head로 향하는데 방문하는 모든 객체의 visited 변수를 0으로 바꾸고, 만약 이미 0이라면 해당 객체를 캐시에서 제거한다. 아래는 SIEVE의 의사코드를 보여준다.

![](/img/medium/1-rJDjhFBpsKlwBIg4DmtLXA-b4393daa0d5f.png)

SIEVE 알고리즘의 의사코드

## 평가
데이터 셋은 트위터와 메타의 데이터 셋을 포함해 총 7개의 데이터 소스를 이용했으며 총 1559개의 트레이스 데이터를 가지고 평가를 진행했다.

![](/img/medium/1-WF2DGAx5DL6JBL7zWC0Ilw-2eee07e24522.png)

1559개의 트레이스를 이용한 평과 결과

캐시 크기가 큰 경우 SIEVE는 거의 모든 분야에서 개선된 모습을 보여준다. SIEVE는 10%의 해당하는 트레이스에 대해 최대 42% 캐시 미스 감소율을 보였고 CDN1에 대해서 평균적으로 21%의 캐시 미스 감소율을 보여준다. 다른 알고리즘과 비교해서는 ARC보다 1.5% 감소를 보여주는데 논문에서는 특별히 1.5%를 감소시킨다는 건 굉장히 큰 결과라고 한 번 강조했다.

반면, 캐시 크기가 작을 경우 다른 알고리즘과 비교해 높은 성능 개선은 보여주지 못했는데 그 이유는 이 알고리즘이 <strong>탐색-저항(scan-resistant)</strong>하지 않기 때문이다. 이는 아래에서 좀 더 설명한다. 위 그래프에서 특히 눈 여겨볼 점은 알고리즘의 복잡성을 나타내는 코드 라인 수 표와 비교했을 때 적은 노력으로 큰 효과를 낼 수 있다는 점과, 비슷한 알고리즘인 CLOCK과 비교했을 때 뚜렷한 성능개선을 보여준다는 걸 주의 깊게 보면 좋을 것 같다.

### 왜 CLOCK과 비교해서 더 효율성이 좋은가?
이 부분은 논문의 5장. Visualizing the shifting process 에 그림과 함께 자세히 설명하고 있다. 필자가 이해한 것을 바탕으로 후려쳐서 설명해보자면 앞서 캐시 정책의 두 핵심이 Lazy Promotion과 Quick Demotion이라고 설명했다.

CLOCK의 경우 tail 포인터에서 축출한 대상에게 한 번 더 기회를 주는 느낌으로 head로 옮기는 반면 SIEVE는 hand 포인터가 “너 다음에 두고보자” 라고 언지를 두면서 head로 포인터가 움직인다. 즉 다시 한 번 기회를 받은 객체들은 평균적으로 큐의 뒷 부분에 위치하게 되고 새로운 객체들은 head 쪽에 위치하게 된다. hand 포인터가 점점 head 쪽으로 가까워지기 때문에 캐시 미스가 발생할 경우 축출 대상을 탐색할 때 <strong>새로운 객체</strong>를 위주로 탐색하기 때문에 Quick Demotion이 제대로 작동하는 것이다.

![](/img/medium/1-s-CEtILbnlJ1Koa12STn0w-129015709b2b.png)

SIEVE의 sifting 과정을 묘사한 그림

### Cache Primitives 로서의 가능성
여기서 또 하나 강조하는 점이 SIEVE가 좀 더 복잡하고 고급진 캐시 정책을 설계할 때 Cache Primitive로서 역할을 할 수 있다는 것이다. 대부분의 고도화된 캐시 정책들이 FIFO, LRU, LFU를 핵심 재료로 사용하면서 성능을 높이고 있는데 SIEVE도 이런 핵심 재료로 쓰일 수 있다고 주장한다. 예를 들어 ARC 알고리즘에서 LRU 컴포넌트를 SIEVE로 교체하면 최대 62.5%, 평균 3.7%의 개선이 있다고 한다.

![](/img/medium/1-Xmojh3M2mPhOnRulAOWOzA-4939aa64df45.png)

SIEVE / Cache primitives 로서의 가능성을 보여주는 그래프

### Scan-Resistant

SIEVE는 일부러 메타와 트위터에서 공개한 <strong>웹 캐시 워크로드</strong> 데이터셋을 중심으로 실험을 진행했다. 그 이유는 SIEVE가 scan-resistant 하지 않기 때문에 범위 쿼리를 많이 포함하는 Block I/O 데이터 셋에 취약하기 때문이다.

scan-resistant란 범위로 탐색하는 쿼리가 주어질 때 캐시가 여전히 좋은가를 말한다. 범위 탐색을 하는 경우 대량의 객체들이 캐시로 후다닥 들어올텐데 이 과정에서 SIEVE의 캐시 크기가 너무 작으면 그 특징을 제대로 써먹지도 못하고 객체가 빠르게 축출된다. 이런 이유로 LRU또한 범위 쿼리가 들어오면 그 만큼 정보를 업데이트 해야 하기 때문에 scan-resistant 하지 않다고 본다.

반면 S3-FIFO는 원-히트-원더를 제거하겠다는 목표가 scan-resistant의 목표와 비슷한데다 대 부분이 단기기억에 해당하는 small queue S에서 제거되고 장기기억인 main queue M의 영향성이 적기 때문에 scan-resistant한 캐시 정책이라고 평가하고 있다.

## 마무리

오늘은 2023년 SOSP에서 소개된 S3-FIFO와, 2024년 NSDI에서 발표될 SIEVE 이 두 개의 논문을 다루었다. 원래는 S3-FIFO만을 다루려고 했는데 관련 자료를 계속 탐색하다 보니 글이 길어졌다. 분량은 다소 길었지만 내용이 어렵지 않아서 소화하는데 문제는 없을 것이다.

그리고 필자는 캐시 연구 분야를 이 두 논문을 통해서 처음 접했기 때문에 논문 저자들이 선택한 데이터가 체리픽 되어 있는지 혹은 다른 곳에서 발표된 더 좋은 성과를 낸 연구가 있는데 관련 연구에 포함이 안되어 있는건지 등을 걸러낼 시야가 부족하다. 그래도 논문의 저자가 [구글, VMWare를 포함한 여러 기업들에서 가능성을 평가하고 있다고 하니](https://x.com/1a1a11a/status/1683925976248451072?s=20) 한 번 지켜 볼만 하다.

마지막으로 필자도 이 연구들을 직접 평가해보고자 go언어로 캐시 라이브러리를 작성 및 평가를 진행해봤다. 바로 [여기](https://github.com/scalalang2/golang-fifo)에서 구현체를 확인할 수 있다. 실제 데이터가 아니라서 그런지 몰라도 S3-FIFO가 TinyLFU에 비해 미세하게 더 효율성이 떨어졌다. 오히려 마지막에 설명한 SIEVE가 이 둘을 미세하게 능가했으며 멀티-쓰레드 환경에서 더 높은 성능을 보여주었다.

![](/img/medium/1-3X3z7RuxLFaUi3UcVce1Cg-4e26f7f7723e.png)

[https://x.com/richardartoul/status/1748897092221751582?s=20](https://x.com/richardartoul/status/1748897092221751582?s=20)

한 번 만들어두니까 많은 사람들이 평가해주는 모습이 너무 신기하다.

### 레퍼런스

- [FIFO queues are all you need for cache eviction \| SOSP 2023](https://dl.acm.org/doi/10.1145/3600006.3613147)
- [SIEVE is Simpler than LRU: an Efficient Turn-Key Eviction Algorithm for Web Caches](https://junchengyang.com/publication/nsdi24-SIEVE.pdf) \| NSDI 2024
