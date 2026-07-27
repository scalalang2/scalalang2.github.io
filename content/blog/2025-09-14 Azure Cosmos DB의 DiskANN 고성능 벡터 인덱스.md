---
title: "Azure Cosmos DB의 DiskANN 고성능 벡터 인덱스"
date: "2025-09-14T02:03:17.630Z"
slug: "azure-cosmos-db의-고성능-벡터-인덱스-52f874e4bd7b"
description: "OpenAI는 대조학습을 활용한 CLIP 모델에서 멀티-모달 데이터를 하나의 공유된 임베딩 공간으로 투영할 수 있음을 보여주었고, 문장 내에서 단어간 관계성을 계산하는 어텐션 매커니즘을 활용한 트랜스포머 아키텍처를 활용한 언어 모델의 발전은 텍스트를…"
tags: []
---

OpenAI는 대조학습을 활용한 CLIP 모델에서 멀티-모달 데이터를 하나의 공유된 임베딩 공간으로 투영할 수 있음을 보여주었고, 문장 내에서 단어간 관계성을 계산하는 어텐션 매커니즘을 활용한 트랜스포머 아키텍처를 활용한 언어 모델의 발전은 텍스트를 의미 있는 벡터 공간으로 표현하는 임베딩 기술을 크게 발전시켰습니다.

<div class="video-embed"><iframe src="https://www.youtube.com/embed/iv-5mZ_9CPY?feature=oembed" title="Embedded media" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>

임베딩 기술이 발전하면서 벡터 데이터베이스와 이를 활용한 RAG, 멀티-모달 검색 등이 업계에서 많은 주목을 받고 있습니다. 이번 포스팅에서는 VLDB’25에서 마이크로소프트가 발표한 <strong>Azure Cosmos DB를 활용한 비용 효율적인 저지연 벡터 검색 (Cost-Effective, Low Latency Vector Search with Azure Cosmos DB)[1]</strong>에 대해 다룹니다.

사실 벡터 데이터베이스는 효율적인 벡터 검색을 위한 <strong>인덱스 자료구조</strong>가 핵심 역할을 하는데요. Azure Cosmos DB에서 활용하는 벡터 인덱스 구조인 <strong>DiskANN (NIPS’19)[2]</strong>를 이해하면 해당 논문에서 말하는 바는 쉽게 이해할 수 있습니다.

### INDEX

- 벡터 인덱스
- 파티션 기반과 그래프 기반 인덱싱
- Disk ANN
- Azure Cosmos DB
- 평가 및 마무리

## 벡터 인덱스

먼저 용어부터 구분하면서 시작하겠습니다. <strong>벡터</strong>란 N차원 공간에서 크기와 방향을 갖는 숫자 배열로 표현되는 수학적 대상을 의미하고 <strong>임베딩</strong>이란 텍스트, 이미지, 음성 등 비정형 데이터를 딥러닝 모델이 학습한 공간으로 사상시켜서 얻은 벡터 표현을 의미합니다.

역색인 방식을 사용하는 전통적인 텍스트 기반 검색엔진은 텍스트가 문서에 포함되어 있는가를 기준으로 문서를 찾았다면, 벡터 인덱스를 사용하면 의미 단위의 시맨틱 검색이 가능해집니다. 예를 들어, 쇼핑몰에서 검색어로 <strong>노트북</strong> 이라는 키워드 대신 <strong>가벼운데 가성비 있는 노트북</strong> 등 의미가 추가된 키워드를 줘도 시스템이 연관된 상품을 더 잘 찾을 수 있습니다.

벡터 인덱스는 수 천, 수 억개의 벡터 정보를 데이터베이스에 저장했을 때 쿼리로 주어진 정보와 가장 의미적으로 가까운 벡터를 효율 적으로 찾기 위한 자료구조입니다.

> 벡터 유사도 검색을 구현하는 가장 간단한 방법은, 저장된 모든 벡터를 선형 탐색(<strong>O(N)</strong>)하면서 거리를 계산하는 것입니다. 하지만 이 방식은 데이터 규모가 커질수록 비효율적이므로 더 나은 방법을 찾아야 합니다. 여기서는 논문 내용을 이해하기 위한 기초적인 내용을 다루고 있습니다. 벡터 검색에 대한 더 깊은 내용은 [Pangyoalto](https://medium.com/u/89ed5885f0af)님의 다음 두 글을 추천드립니다.\
> - [벡터 검색 알고리즘 살펴보기(1): Similarity Search와 HNSW\
> ](https://pangyoalto.com/faiss-1-hnsw/)- [벡터 검색 알고리즘 살펴보기(2): HNSW, SPANN](https://pangyoalto.com/hnsw-spann/)

### ① 근사 최근접 이웃 탐색 (ANNS: approximate nearest neighbor search)
머신러닝이 발전하면서 피쳐 공간의 차원이 점차 증가하고 있으나, 학습에 쓰이는 데이터 표본 수는 상대 적으로 적기 때문에 고차원 공간에서 너무 희소하게 분포되는 현상이 나타나며 이를 <strong>차원의 저주</strong>라고 부릅니다.

[<strong>Curse of dimensionality</strong>\
medium.com](https://medium.com/geekculture/curse-of-dimensionality-e97ba916cb8f "https://medium.com/geekculture/curse-of-dimensionality-e97ba916cb8f")[](https://medium.com/geekculture/curse-of-dimensionality-e97ba916cb8f)

![](/img/medium/1-wnNOrIlevLCpg2ViSqh5PQ-338c3cf746d4.png "출처 : [https://medium.com/geekculture/curse-of-dimensionality-e97ba916cb8f](https://medium.com/geekculture/curse-of-dimensionality-e97ba916cb8f)")


차원이 증가할 수록 희소한 공간이 많아지기 때문에 상대적인 거리라는 값이 의미를 잃어버리게 됩니다. 저는 이를 직관적으로 이해하기 위해서 흔히 다음과 같은 예시를 드는데요. 철수와 민수를 구분하는 데이터를 <strong>성별</strong> 하나만 사용해서 벡터를 만들면 이 둘 사이의 거리는 0입니다.

여기서 MBTI, 직업, 거주지 등 다양한 변수를 추가할 때 마다 서로가 구별되기 때문에 벡터 거리상으로는 계속 멀어지게 되는데요. 유클리드 거리 수식을 보면 차원의 수가 증가할 수록 값은 벡터의 거리가 1로 수렴하게 됩니다.

![](/img/medium/1-As9ZXy_DVIBAIGNm8mrzOw-6f8d1e092a5e.png "유클리드 거리 계산")


따라서 가장 가까운 벡터를 찾는 건 사실상 불가능에 가깝고, 가장 인접할 가능성이 높은 k 개의 이웃을 찾는 것을 목표로 합니다. 이를 좀 더 formal하게 정의하면, 쿼리와 알고리즘의 결과값 X가 k개의 최근접 이웃 후보를 가지고 있고 ground-truth를 G라고 할 때, k- @ recall k는 다음과 같이 정의됩니다

![](/img/medium/1-rJecniEeNzW8bYJo0ab5PA-70d6d95cd25e.png)

### ② 파티션 기반 인덱싱
파티션 기반 인덱스란 벡터 데이터들을 특정 파티션 단위로 나누어서 쿼리로 찾아야 할 대상을 줄이는 인덱싱 기법입니다. SPANN, ScaNN 등 여러 기법들이 있는데 대부분 IVF(Inverted File Index)를 기반에 두고 있습니다.

IVF를 수행하려면 먼저 파티션 개수인 파라미터와 탐색할 파티션의 개수인 nlist와 nprobe를 결정한 다음 K-평균 클러스터링, LSH 등을 활용해서 군집화를 수행해서 nlist로 결정한 개수만큼 중심점을 추출합니다. RDBMS에서 인덱스를 생성할 때는 데이터가 없어도 인덱스부터 만들 수 있었는데요, 벡터 인덱스에서는 클러스터링관련 알고리즘을 활용하기 때문에 데이터 부터 모은다음 인덱스를 생성해야합니다.

![](/img/medium/1-k1ZiwL1oR2oi2lhnSuI1sQ-fb8b4e64b269.png "[Voronoi diagram — Wikipedia](https://en.wikipedia.org/wiki/Voronoi_diagram)")


이렇게 얻어진 중심점들을 기준으로 공간이 분할되면, 각 벡터는 가장 가까운 중심점에 대응되는 파티션에 할당됩니다. 한번 파티션이 나워진 뒤 검색을 수행할 때는 주어진 쿼리 벡터와 가장 가까운 중심점(또는 여러 개의 중심점, nprobe에 따라 다름)을 찾은 후 해당 파티션들 안에서 후보 벡터와의 거리를 비교하여 가장 가까운 벡터를 찾습니다.

![](/img/medium/1-CEIA8y4go7woDyZCCWoelw-44edb67d06df.png "[NVIDIA : Accelerated Vector Search: Approximating with NVIDIA cuVS Inverted Index](https://developer.nvidia.com/blog/accelerated-vector-search-approximating-with-nvidia-cuvs-ivf-flat/)")


파티션의 개수를 k개로 하고 전체 데이터 수를 N이라 할 때, IVF 인덱스의 탐색 시간 복잡도는 O(k + N/k)가 됩니다. 탐색하는 파티션이 많을수록 검색 속도는 느려지지만 정확도(recall)는 증가합니다.

## ③ DiskANN
지금부터는 <strong>그래프 기반 벡터 인덱스</strong>를 소개하려고 합니다. 이 분야는 <strong>NSW, </strong>HNSW라는 잘 알려진 알고리즘이 있지만, 이번 포스팅의 주인공인 Cosmos DB가 DiskANN를 사용하고 있기 때문에 이 글에서는 이것만 소개합니다.

> 제가 다른 알고리즘은 얕게만 알고 있어서 설명할 능력이 부족하기도 하고 DiskANN의 기본 원리는 다른 그래프 기반 알고리즘과 많은 부분을 공유하므로, DiskANN을 이해하면 다른 관련 알고리즘을 학습하는 데에 도움이 되실 것으로 기대합니다.

## DiskANN

DiskANN은 다음 특징을 가지는 ANN 알고리즘입니다.

1.  DiskANN은 64GB RAM을 가진 서버에서 100차원의 벡터 데이터 1억개를 인덱싱하고 서빙할 수 있습니다. 95% + 1-recall@1의 성능을 가지며 레이턴시는 5ms 미만입니다.
2.  Vamana 알고리즘을 개발했으며 NSG, HNSW보다 더 차원이 적은 그래프 인덱스를 생성할 수 있습니다.
3.  Vamana는 인-메모리 모드에서도 동작하며 검색 속도가 NSG, HNSW와 비슷하거나 더 우수합니다.
4.  Vamana는 벡터 압축 스킴(e.g. Product Quantization)과 쉽게 통합할 수 있습니다.

Vamana로 바로 들어가기 전에 선행 지식으로 필요한 GreedySearch에 대해 이야기 하면서 시작해봅시다.

### ① GreedySearch 알고리즘
DiskANN을 포함한 NSW, HNSW는 벡터들을 그래프로 구축하고 GreedySearch라는 탐색 알고리즘을 활용합니다. 그래프에서 정점은 하나의 벡터를 의미하고 간선은 벡터와 벡터 사이의 거리를 말합니다. 거리는 코사인 유사도와 유클리드 거리 등을 활용할 수 있습니다. 일단 논문에서는 유클리드 거리를 사용했습니다.

![](/img/medium/1-SzcIHkCKhC9Hfk7TO7tfvQ-207b7918d64e.png "DiskANN / GreedySearch 알고리즘")


GreedySearch의 함수에 4개의 매개변수가 존재하는데요. s는 시작 정점을 의미하며 아무거나 선택해도 상관없습니다. x_q는 우리가 찾고자하는 쿼리벡터를 의미합니다. 예를 들어, 검색어로 “<strong>가벼운데 가성비 있는 노트북</strong>”을 입력한 경우 이를 임베딩 해서 변환한 벡터가 쿼리벡터가 되고 이것과 가장 가까운 정점들 k개가 우리가 찾고자 하는 결과값입니다.

마지막 매개변수인 L은 탐색에 어느정도 시간을 쓸 수 있는가를 결정합니다. 이 값을 늘릴수록 더 많은 정점을 탐색하기 때문에 정확도가 증가하지만, 반대로 레이턴시도 같이 증가하기 때문에 반응성이 떨어집니다.

알고리즘은 아직 방문하지 않은 정점 집합 ($L \setminus V$) 중에서 쿼리 벡터와 가장 가까운 벡터 ($p^* = \operatorname{argmin}(\lVert p - q \rVert)$) 를 찾고 $p^*$ 벡터의 이웃을 다시 탐색 공간에 추가하면서 더 이상 가까운 이웃이 나타나지 않을때까지 반복합니다.

![](/img/medium/1-SlVMQCnhYcm59lQ6DHN2NQ-8c2e4d7c06e6.png "Azure Cosmos DB 논문에서 인용한 L과 Recall간의 관계")


위 그림은 천만개의 벡터를 저장했을 때 L을 변경해가면서 정확도(Recall)와 레이턴시 그리고 컴퓨팅 사용량(Request Units)의 변화량을 보여줍니다. L=50세팅에서는 p99에서 20ms에 가까운 레이턴시로 서비스를 제공하지만 L을 높이면 레이턴시와 정확도가 같이 증가합니다.

### ② RobustPrune
Greedy Search 알고리즘이 잘 수렴하기 위한 충분 조건으로 <strong>SNG(sparse neighborhood graph)</strong>라는 속성을 만족해야 하는데요. 이를 만족하는 그래프를 구축하는 방법은 다음과 같습니다.

1.  집합 S를 P \\ {p}로 초기화합니다.
2.  집합 S에서 p와 가장 가까운 정점 $p^*$을 찾아 간선을 추가합니다.
3.  모든 정점 $p'$에 대해, 만약 $d(p,p') > d(p,p^*)$라면 $p'$를 후보에서 제거합니다.
4.  집합 S가 공집합이 아닐 때까지 2~3 과정을 반복합니다.

![](/img/medium/1-U3lWhhZs_ualsvHZnKd6jQ-0d24c460f21f.png)

위 그림에서 빨간색 정점은 (3)번 과정에서 제거된 노드를 의미하고 파란색 정점은 아직 제거되지 않아서 다음 Iteration에서 평가될 노드를 의미합니다. 이 알고리즘은 O(N²)의 시간복잡도를 가집니다.

하지만 이러한 그래프 구축 방식은 특정 상황에서 탐색 성능이 크게 저하되는 엣지 케이스가 발생할 수 있는데요. 가령, 모든 벡터 정점이 하나의 차원 위에 완벽히 정렬되는 경우가 이에 해당합니다.

![](/img/medium/1-5DYALOm6KLRDVjHfX9_MAg-c97309216bcf.png)

이를 보완하기 위해 DiskANN에서는 간선 제거에 대한 임계값 α를 사용한 RobustPrune 알고리즘을 사용합니다. 매개변수는 총 4개가 등장합니다. p는 간선을 추가할 정점을 의미하고 V는 후보군을 의미합니다. α은 임계값을 의미하며 R은 간선의 최대 갯수입니다.

![](/img/medium/1-vu0F42igUX1MKSpzC2Jc8Q-f8ac6fe315b9.png "RobustPrune 알고리즘")


### ③ Vamana
마지막으로 Vamana 알고리즘은 그래프 구축 알고리즘입니다. 나이브한 방법을 사용하면 그래프 구축의 시간 복잡도가 O(N²)이기 때문에 Vamana 알고리즘에서는 RobustPrune을 정점 일부를 샘플링 해서 간선을 구축합니다. 아래 노테이션 중에 medoid는 그래프 내에서 다른 모든 정점과의 거리 합이 가장 작은 정점을 의미하는데요. 꼭 정확한 값을 구할 필요는 없어 보이고 적당히 휴리스틱하게 구해서 써도 될 것 같습니다.

![](/img/medium/1-2ffbW1yi7rh_ZcDjx2MN8A-3144002f7e49.png "Vamana Indexing Algorithm")


일단 내가 가지고 있는 데이터 셋에서 랜덤그래프 G를 만듭니다. 즉, 앞서 말했듯이 데이터 셋을 충분히 가지고 있는 상황에서 수행해야 합니다. 그리고 랜덤한 정점 i에 대해서 GreedySearch를 수행한 뒤 방문한 노드에 대해 RobustPrune을 수행합니다.

![](/img/medium/1-4Pv99F54zVfRLGYzJ-wQqQ-d44bce83fc3e.png)

위 그림은 Vamana Indexing 알고리즘에서 각 Iteration 마다 그래프 모양이 어떻게 변하는지 보여줍니다.

### ④ Product Quantization
여기서 두 가지 문제가 더 남아있습니다. DiskANN은 데이터를 1억개 이상 서빙하는게 목표였죠? (1) 1억개 이상의 정점을 가진 그래프를 메모리에 올려두고 인덱스 빌딩을 하면 메모리를 초과하게 되구요. (2) 고차원 벡터를 사용하면 주어진 탐색 시간 내에 빠른 탐색이 어려울 수 있습니다

![](/img/medium/1-BtkOiPGjKTehtCJWb25CdA-5c6781431549.png)

(1)번 문제는 그래프를 여러 개의 파티션으로 분리한 다음에 개별적으로 인덱스를 빌딩한 다음에 하나로 병합해서 SSD에 저장합니다. 너무 딱 잘라서 나눠버리면 쿼리 성능이 떨어지기 때문에 적당히 정점들이 일부 겹치게끔 파티션을 나눠서 진행하는 방법으로 해결합니다.

이제 (2)번 문제가 중요한데요. 유명한 벡터 압축 기법인 Product Quantization을 사용합니다. Product Quantization[3]은 벡터를 여러 개의 서브 벡터로 나눈 다음에 서브 벡터 끼리 군집화를 진행한 다음 centroid id를 부여해서 부호화합니다. 이렇게 인코딩 된 값을 PQ code라고 부릅니다.

![](/img/medium/1-LHah0Tcqf8G9x8TjBV1Lzw-bbb557fdf6d3.png)

예를 들어, 32비트 부동 소수점 값으로 이루어진 크기가 1024인 벡터를 상상해봅시다. 원본 벡터를 저장하기 위해 필요한 공간은 1024 × 32 = 4096 byte 인데요. 이를 8개의 서브벡터로 나누어서 8 bit = log(256)의 ID를 부여하면 8 byte로 무려 512배 압축할 수 있습니다. 이렇게 PQ로 압축해도 벡터와 벡터간의 거리 성질은 어느 정도 보존 되는 것으로 알려져 있습니다.

## Azure Cosmos DB

Azure Cosmos DB에서 벡터 인덱싱은 기존에 존재하던 B+ Tree에 DiskANN을 결합시켜서 벡터 인덱스를 지원하기 때문에 앞서 설명했던 DiskANN을 이해했다면 이 논문의 거의 대부분은 이해할 수 있습니다.

Azure Cosmos DB[4]는 완전 관리형, 글로벌로 분산된, 멀티 모델 데이터베이스 서비스입니다. 여기서 멀티<strong>-</strong>모델 이란 의미는 키-밸류, 문서, 그래프, 관계형 등 다양한 형태의 정보를 단일 인터페이스로 다룰 수 있게 통합했다는 의미인데요. 실제로는 DB마다 사용법은 조금씩 다르지만 서버리스, 글로벌 복제, 확장성, 파티션 분할 등의 특징은 공통적으로 가집니다

![](/img/medium/1-Nu08tTv-6eOKXWi-mYn5eg-cef9e6acc27b.png "[https://azure.microsoft.com/en-us/blog/azure-cosmos-db-database-for-intelligent-cloud-intelligent-edge-era/](https://azure.microsoft.com/en-us/blog/azure-cosmos-db-database-for-intelligent-cloud-intelligent-edge-era/)")


Azure Cosmos DB는 서버리스 제품이기 때문에 사용자가 독립적인 머신을 빌리는 것이 아니라 멀티 테넌트 형태로 다른 이용자와 함께 서비스를 공유하게 됩니다.

Cosmos DB는 다양한 데이터베이스 작업의 비용을 Request Unit(RU)라는 단위로 표준화하며, 처리량은 초당 Request Unit(RU/s) 기준으로 측정됩니다. Request Unit은 CPU, 메모리, IOPS 등 시스템 자원을 추상화한 일종의 통화 단위인데요. 따라서 사용자는 실제 머신 임대 비용이 아닌 자신이 사용한 RU 단위에 따라 비용을 지불하게 됩니다.

![](/img/medium/1-7gD2NQhyq1K8Mvlve_0qNg-16b7ce2dd0c7.png "[Request Units in Azure Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/request-units)")


### ① Schema Agnostic Indexing
Azure Cosmos DB의 모든 데이터베이스가 벡터 인덱싱을 지원하는 건 아니고, Azure Cosmos DB for NoSQL에만 적용되어 있습니다. 이 DB는 JSON데이터만 사용해서 데이터를 저장, 색인, 쿼리 할 수 있습니다.

```json
{
  "id": "prd_20250914_001",
  "name": "Wireless Noise-Cancelling Headphones",
  "category": "Electronics/Headphones",
  "brand": "Acme Audio",
  "price": {
    "currency": "KRW",
    "amount": 199000
  },
  "attributes": {
    "color": "Black",
    "connection": "Bluetooth 5.3",
    "batteryLifeHours": 30,
    "weightGrams": 240
  },
  "media": {
    "thumbnail": "https://cdn.example.com/images/prd_20250914_001_thumb.jpg",
    "images": [
      "https://cdn.example.com/images/prd_20250914_001_1.jpg",
      "https://cdn.example.com/images/prd_20250914_001_2.jpg"
    ]
  },
  "embedding": {
    "values": [
      0.0182, -0.0427, 0.0911, 0.0035, -0.0279,
      0.0554, 0.0071, -0.0123, 0.0448, -0.0362,
      0.0209, 0.0144, -0.0098, 0.0331, -0.0256,
      0.0115, -0.0042, 0.0297, -0.0168, 0.0220
    ],
    "dim": 20,
    "model": "text-embedding-3-small",
    "source": "title+category+attributes"
  }
}
```

상품 데이터를 예시로 보면,상품명과 카테고리, 상품 속성을 임베딩해서 벡터를 구하고 이를 Azure Cosmos DB에 저장하면 `embedding.values` 에 대해서 벡터 검색을 수행할 수 있습니다. 임베딩 하는 방법은 LLM기업에서 제공하는 API를 사용하거나 HuggingFace에서 적당한 모델을 다운로드 받으셔서 사용하면 됩니다.

```python
# pip install openai
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

texts = [
    "임베딩은 텍스트를 벡터로 표현합니다.",
    "벡터는 의미적 유사도를 계산하는 데 사용됩니다."
]

res = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts
)

embeddings = [item.embedding for item in res.data]
```

NoSQL 제품군은 재밌는 특징을 하나 가지고 있는데요. JSON 데이터를 저장하면 내가 스키마를 지정하지 않아도 모든 필드에 대해 인덱스를 자동으로 생성해줍니다. 이를 Schema Agnostic Indexing 이라고 부르는데요. 2015년 VLDB에서 소개된 논문인 [Schema-Agnostic Indexing with Azure DocumentDB[5]](https://www.vldb.org/pvldb/vol8/p1668-shukla.pdf) 에서 관련 내용을 다루고 있습니다.

여기서는 단순하게만 알아보겠습니다. NoSQL 제품에서는 JSON 문서를 저장할 때 이를 트리구조로 변환한 다음 인덱스에 전부 저장합니다

![](/img/medium/1-QV2IAfH9lBOMjZBjuiafTA-3bbd370abd73.png)

조금 더 상세하게 설명하면 아래 JSON 문서를 저장하면, 오른쪽 처럼 정보를 분해할 수 있습니다. 이렇게 분해된 경로를 키로 가지고 문서 ID를 값으로 가지게끔 Bw-Tree에 저장합니다. (Bw-Tree는 또 뭘까요 🤔)

![](/img/medium/1-o97pf3GTUYRbaY_kmR8vuw-08611e41b345.png)

Bw-Tree (2013)[6][7]는 B+ Tree의 특징은 그대로 유지하면서 lock-free 형태로 만든 버전입니다. 기본적인 아이디어는 트리를 직접 변경하는 대신 변경 사항인 D elta Update를 Leaf노드에 추가하고 모든 연산을 CAS(Compare-And-Swap)으로만 진행합니다

![](/img/medium/1-ajDJwCeglHP-GnbXPsvohg-6ffefc227aad.png)

Cosmos DB에서는 Bw-Tree가 Foward Index 및 Inverted Index 모두 지원합니다. Inverted Index에서는 경로를 키로 가지고 리프 노드에서 문서 번호를 리스트로 가지고 있습니다.

![](/img/medium/1-_-9mOvezkI1Txxbxh5xkFw-990a39671466.png)

> Bw-Tree는 B+Tree의 Lock-free 버전입니다. 익숙하지 않은 용어가 등장하면 글을 해석할 때 어려울 수 있기 때문에 B+Tree를 떠올리면서 읽으시면 이해가 더 수월할 것입니다.

## ② DiskANN을 Bw-Tree와 결합
이번 포스팅의 주인공 논문은 바로 현재 이 상태에서, 벡터 인덱스를 추가로 지원을 어떻게 했는가를 다루고 있습니다. 이를 활용해서 아래 쿼리를 지원할 수 있습니다. 사용방법이 꽤 간단합니다. [VectorDistance](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/vectordistance) 함수를 사용해서 가장 가까운 벡터를 찾겠다는 선언만 해주면 됩니다.

SELECT TO\
P 10\
c.id,\
c.title,\
c.product,\
VectorDistance(c.contentVector, @query_vector) AS SimilarityScore\
FROM c\
WHERE c.category = "game"\
ORDER BY VectorDistance(c.contentVector, @query_vector);

벡터 인덱스를 Bw-Tree에서 지원하는 가장 쉬운 방법은 테이블 ID와 경로를 키로 가지면서 리프노드에는 테이블 내에 있는 모든 문 서의 벡터들을 리스트 형태로 저장해두는 겁니다. 벡터 관련 쿼리가 들어오면 O(N²)으로 모든 벡터를 전수조사 하면서 계산해보면 됩니다. 당연히 이 방법은 현실적이지 않죠

동일한 접근법으로 Product Quantization을 사용하면 데이터 압축 효과가 있기 때문에 성능을 다수 높일 수 있습니다. 논문에서는 <strong>OpenAI Ada v3 embedding</strong> 모델을 96x나 압축 저장할 수 있다고 했습니다. 당연히 이 방법도 벡터 개수가 천만개 단위를 넘어가면 비현실적인 방법입니다.

지금까지 설명한 배경을 바탕으로, Cosmos DB의 벡터 인덱스 구현 핵심은 아래 그림으로 요약할 수 있습니다. 양자화된 벡터 값을 키로 가지면서 리프 노드에는 문서 ID를 적어 두는 것과 문서 ID를 키로 가지면서 그래프 사이의 인접리스트를 형성하도록 인덱스에기록해둡니다. 그리고 그래프 구축 및 탐색에는 DiskANN의 알고리즘을 이용합니다.

![](/img/medium/1-RKaB9SqX4g-meEQDjnsIDQ-7bb5507eaa6e.png)

위 인덱스 레이아웃이 실제로는 B+ 트리에서 TermKey를 경로로 가지며 리프노드에 TermValue값을 저장한 상황을 상상하시면 됩니다. 첫 번째 Inverted Term인 (TermPrefix + DocumentId + Quantized Vector Value)의 경우는 단순히 양자화된 벡터값을 빠르게 찾기 위해서 사용하며 Value에는 의미없는 Dummy값을 저장합니다. B+ 트리에서 문서 ID로 양자화된 벡터값을 찾을 때 “Prefix Seek” API를 사용해서 찾을 수 있다고 합니다.

두 번째 Forward Term에 해당하는 (TermPrefix + Document ID)를 키로 가지는 값은 해당 문서의 이웃 정점인 인접 리스트를 저장해서 그래프 정보를 가지고 있습니다. 바로 이 정보를 활용해서 DiskANN의 GreedySearch를 수행합니다.

### ③ MiniBatchInsert
디테일한 부분에서는 DiskANN과 조금씩 다릅니다. 새 정점을 그래프에 삽입할 때 Insert 요청을 모아 배치로 처리하고, RobustPrune까지 병렬로 수행한 뒤 결과를 일괄 업데이트합니다.

![](/img/medium/1-ltit1-4VI3PAwO1c2FIPmw-5d101755ea3c.png)

### ④ Re-rank
쿼리를 수행할 때 quantizedVectorListMultiplier를 기입할 수 있습니다. 양자화된 벡터는 압축 표현이기 때문에 양자화된 벡터로 Greedy Search를 수행하면 정확도가 떨어집니다. 그래서 실제로는 일부러 원하는 것 이상으로 많이 후보군을 선정한 다음 <strong>원본 벡터(full precision vector)로 다시 계산해서 순위를 재-정렬합니다.</strong>

![](/img/medium/1-dk2jJeR9d-_tfPVb0_b3tA-2b09e5e96dd2.png)

![](/img/medium/1-EhtTedzrR9ty3SGDDED6tg-990a7d5245b7.png)

### ⑤ Filter-Aware Search
애플리케이션에서는 다음 처럼 predicate를 포함하는 검색을 수행하는 경우가 흔합니다. 이런 경우에는 Filter-Aware 탐색을 제안하는데요. 비트맵 인덱스를 사용해서 서로 비교하는 전략을 사용합니다. 아래 알고리즘에서는 레이블 비트맵이 서로 동일한 경우 $0 < \beta \le 1$ 의 값을 곱해서 해당 정점에 어드밴티지를 더합니다.

![](/img/medium/1-XfPxCVGAgV99GgYZjBjZGg-8623b6177939.png)

## 평가 및 마무리

앞서 GreedySearch에 대해 설명할 때 아래 평가자료를 사용했었는데요. 해당 그림은 Cosmos DB 논문[1]에서 인용한 그림이었습니다. 1000만개의 벡터를 저장하고 L값을 증가시키면서 레이턴시와 컴퓨팅 사용량의 변화를 관측했습니다.

![](/img/medium/1-q-qZVn6jodn3zLm1apuADw-d803a33b4034.png)

다음 두 그래프는 서로 다른 데이터셋을 활용해서 데이터를 100K, 1M, 10M 증가시켰을 때의 성능 변화 추이를 보여줍니다. L은 100으로 동일합니다. 데이터가 증가하면 레이턴시가 증가하긴 하지만 100K와 10M을 비교했을 때, 데이터는 100배 증가해도 레이턴시는 2배까지는 증가하지 않았다고 평가합니다.

![](/img/medium/1-YAnMbcGnmG7Gvyujq7bWBQ-07526b17f279.png)

Zilliz, Pinecone 등 다른 서비스와 비용에 대해서 평가한 자료도 있습니다. CosmosDB가 쿼리 비용이 훨씬 저렴한 것으로 나오는데요. 알고리즘의 차이가 있다기 보다는 서버리스 제품이라서 그런걸까? 하는 생각이 들었습니다.

![](/img/medium/1-I1Dt0W5G7valbtu8XjGTAg-65ece59eda39.png)

Milvus, Zilliz와 같은 전용 벡터 데이터베이스는 뛰어난 성능을 제공 하긴 하지만 운영 DB는 그대로 두고 전용 벡터 데이터베이스를 구축해야 하므로, 시스템 아키텍처가 복잡해지고 비용이 증가합니다.

반면 Cosmos DB는 스케일 아웃 및 글로벌 복제, Schema Agnostic Indexing 등을 제공하면서 벡터 검색을 지원하기 때문에 서비스 운영에 필요한 데이터와 같이 통합해서 사용할 수 있다는 장점이 있습니다.

Azure를 사용하지 않는 개발 환경이라면, PostgreSQL의 벡터 검색 성능을 높이기 위해 [timescale/pgvectorscale (Github 2.2k)](https://github.com/timescale/pgvectorscale)확장 플러그인을 활용하는 것을 고려해볼 수 있습니다. 이 플러그인은 논문과 마찬가지로 DiskANN을 사용하여 PostgreSQL 데이터베이스에 고성능 벡터 인덱스를 지원합니다

### 레퍼런스

- [1] [Cost-Effective, Low Latency Vector Search with Azure Cosmos DB](https://arxiv.org/abs/2505.05885)
- [2] [DiskANN: fast accurate billion-point nearest neighbor search on a single node](https://dl.acm.org/doi/abs/10.5555/3454287.3455520)
- [3] [Pinecone — Product Quantization: Compressing high-dimensional vectors by 97%](https://www.pinecone.io/learn/series/faiss/product-quantization/)
- [4] [Azure Cosmos DB — database for Intelligent Cloud — Intelligent Edge era](https://azure.microsoft.com/en-us/blog/azure-cosmos-db-database-for-intelligent-cloud-intelligent-edge-era/)
- [5] [Schema-Agnostic Indexing with Azure DocumentDB](https://www.vldb.org/pvldb/vol8/p1668-shukla.pdf)
- [6] [The Bw-Tree: A B-tree for New Hardware Platforms](https://www.microsoft.com/en-us/research/publication/the-bw-tree-a-b-tree-for-new-hardware/) — Microsoft
- [7] [Building a Bw-Tree Takes More Than Just Buzz Words — SIGMOD’18](https://dl.acm.org/doi/10.1145/3183713.3196895)
