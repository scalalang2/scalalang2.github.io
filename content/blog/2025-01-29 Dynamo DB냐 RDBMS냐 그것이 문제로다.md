---
title: "Dynamo DB냐 RDBMS냐 그것이 문제로다"
date: "2025-01-29T08:11:27.142Z"
slug: "dynamo-db냐-rdbms냐-그것이-문제로다-45fdf48f6a9d"
description: "회사에 새롭게 입사한 신입 직원이 이런 질문을 했습니다. “왜 여기는 RDBMS를 안쓰고 DynamoDB를 쓰나요?” 저는 RDBMS는 서버 운영 중에 샤드 개수를 늘리고 축소하는 것이 쉽지 않고 DynamoDB는 수평 확장이 쉽다고 답변했습니다…"
tags: []
---

회사에 새롭게 입사한 신입 직원이 이런 질문을 했습니다. “왜 여기는 RDBMS를 안쓰고 DynamoDB를 쓰나요?” 저는 RDBMS는 서버 운영 중에 샤드 개수를 늘리고 축소하는 것이 쉽지 않고 <strong>DynamoDB는 수평 확장이 쉽다고 답변했습니다</strong>. 하지만 답변하면서도 머릿속에 몇몇 반례들이 떠올랐고 답변이 추상적이라고 느껴서 여러모로 스스로 아쉬운 답변이었습니다.

1.  CockroachDB나 Vitess처럼 비교적 최근에 만들어진 RDBMS들은 기본적으로 MySQL 혹은 PostgreSQL의 프로토콜과 호환되게 만들면서도 수평 확장을 지원합니다[1].
2.  심지어 CockroachDB는 PostgreSQL을 제공하지만, 내부 구조는 LSM 트리 기반의 키-밸류 저장소를 이용합니다[2]. 다시 말해 DynamoDB와 유사한 아키텍처 위에 데이터 표현방식만 관계형 데이터로 다룰 수 있도록 제공한다는 뜻입니다.

몇 가지 반례를 떠오르고 나니, 자연스럽게 다음 질문이 떠올랐습니다. RDBMS가 수평확장이 쉽게 된다면 DynamoDB를 선택해야 할 이유가 있을까? 이제는 RDBMS가 DynamoDB의 완벽한 상위호환일까?

### INDEX

- 미완성의 저주
- 과거와 현재, 그리고 Aurora Limitless Database
- 관계형 vs 비관계형
- 복제 (Replication)
- 파티셔닝 (Partitioning)
- 마무리

## 미완성의 저주

![](/img/medium/1-O_e-qAAloTyIly4OitxGWA-2ee222dc4486.png)

Reddit 에서 <strong>DynamoDB/RDBMS 논쟁[3]</strong>을 보던중에 누군가 엔지니어에게 허락된 정답은 <strong>“it depends”</strong> 뿐이라고 남겼습니다. 소프트웨어 아키텍처에서 많은 부분이 트레이드-오프가 존재한다지만, 의사결정에 있어 모든 반론을 받아들인다면 제대로 된 결정을 할 수 없고 미완성의 바다에 장기간 표류하는 저주에 걸릴 겁니다.

![](/img/medium/1-VrBb2hAOqbuhC5xDhGp0Nw-c7a486e3e7ed.png "[지. 지구의 운동에 대하여](https://page.kakao.com/content/60800785), [넷플릭스 상영중](https://www.netflix.com/title/81765022)")


프로그래밍 언어, 디자인 패턴 등은 중요하지만, 절대적인 비교우위를 따지기는 어렵습니다. 객체지향 또는 함수형 패러다임의 언어 중 어느 것을 선택하더라도 그 자체로 잘못된 결정이라고 할 수 없습니다. 이러한 논쟁은 종종 개인의 선호도나 경험에 기반한 주관적인 감정 표현으로 귀결되곤 합니다.

데이터베이스 선택에 있어서도 RDBMS와 키-밸류 저장소는 각각의 장단점이 있습니다. 디스코드[4]는 ScyllaDB라는 분산 키-밸류 데이터베이스를 사용하는 반면, 슬랙[5]은 MySQL의 분산 확장 버전인 Vitess를 채택했습니다. 두 회사 모두 성공적으로 채팅 애플리케이션을 구현했지만, 그 기술적 선택은 서로 달랐습니다.

서버 개발 과정에서 RDBMS와 키-밸류 데이터베이스 중 어느 것을 선택할지에 대해 의견이 대립할 때가 있습니다. 어느 한 쪽의 선택이 틀린 것은 없습니다. 디스코드와 슬랙의 사례를 보면 RDBMS로는 죽어도 못만들어 같은 상황은 없다는 거죠. 반대의 경우도 마찬가지죠. 여기서 만약 양측이 자신의 입장을 고수한다면 영원히 합의점을 찾기 어려울 겁니다.

저는 이 글을 통해 우리 팀이 어떤 가치에 더 우선순위를 두느냐에 따라 <strong>RDBMS</strong>와 <strong>키-밸류 데이터베이스</strong> 중 하나를 선택할 수 있는 기준을 찾아보고자 했습니다. 미래에 비슷한 상황이 있을 때 이 글을 다시 보면서 제가 올바른 의사결정을 할 수 있길 바랍니다.

## 과거와 현재, 그리고 Aurora Limitless Database

ChatGPT에게 RDBMS와 키-밸류 데이터베이스의 차이에 대해 질문하면 성능및 확장성 관점에서 <strong>RDBMS는 수직 확장이 일반적이며 키-밸류 DB는 수평적 확장이 쉽고 빠른 읽기/쓰기에 적합하다고 합니다</strong>. 정보의 바다에서 인류 대다수의 지식을 종합해서 이야기하는 ChatGPT의 특성상 이것이 일반적인 견해라고 해석할 수 있습니다.

![](/img/medium/1-I0QyRzt0P4WbhQTdqIi-eQ-43dee0dd7ac8.png "ChatGPT : RDBMS와 키-밸류 데이터베이스의 차이점이 뭐야?")


AWS를 이용하고 있다면 ChatGPT의 이 답변이 최근까지는 사실에 가까웠을지도 모릅니다. AWS RDS는 기본적으로 샤딩을 지원하지 않기 때문에 <strong>애플리케이션 레벨</strong>에서 샤딩을 직접 구현하는 경우가 많았습니다[6][7][8]. (AWS Aurora Serverless도 수직 확장만 지원합니다)

지금은 Citus[9], Vitess, Cockroach DB[10]처럼 수평 확장을 지원하는 RDBMS가 있습니다. 저는 <strong>클라우드 관리형 DB</strong>가 아니라면 사용할 생각이 없었지만 최근 불과 2개월 전인 2024년 11월 [Amazon Aurora Limitless Database[11]](https://aws.amazon.com/ko/blogs/korea/amazon-aurora-postgresql-limitless-database-is-now-generally-available/)가 출시되었습니다.

<div class="video-embed"><iframe src="https://www.youtube.com/embed/pUqVCK7Ggh0?feature=oembed" title="Embedded media" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>

### ① AWS Aurora
AWS Aurora는 데이터 스토리지 레이어와 연산 처리 레이어를 분리한 구조를 가지고 있습니다. 이 시스템에서 연산 능력은 ACU(Aurora Capacity Unit)라는 단위로 측정되는데, 각 ACU는 약 2GB의 메모리와 그에 맞는 CPU 성능, 네트워크 대역폭을 제공합니다.

Aurora의 장점은 필요에 따라 ACU를 유연하게 조절할 수 있다는 점입니다. 사용한 ACU와 저장 공간에 따라 비용이 청구되므로, 트래픽 변동이 심한 서비스에 특히 효과적입니다. 예를 들어, 온라인 게임에서 피크 시간과 한가한 시간의 동시 접속자 수가 5–6배 차이 날 때 Aurora를 사용하면 이런 변동에 효율적으로 대응할 수 있습니다.

기존 AWS RDS / Aurora Serverless 제품군에서는 Multi-master cluster를 생성한 뒤 샤딩을 서버 코드에서 직접 구현했다면 Aurora Limitless Database는 처음부터 샤딩을 통한 수평 확장이 가능한 데이터베이스를 목표로 개발되었습니다.

## ② Aurora Limitless Database

![](/img/medium/1-K-wYkRq7rT5NUjmHFlBIlg-cf53ea75483a.png "source : [Amazon Aurora PostgreSQL Limitless Database is now generally available](https://aws.amazon.com/blogs/aws/amazon-aurora-postgresql-limitless-database-is-now-generally-available/)")


Aurora Limitless Database는 처음부터 샤딩을 통한 수평 확장이 가능한 데이터베이스를 목표로 개발되었습니다. Limitless Database를 생성하면 단일 엔드포인트가 노출되어 사용자가 편리하게 데이터베이스를 이용할 수 있습니다. Limitless Database는 하나의 샤드 그룹으로 구성되어 있고 샤드 그룹은 2개의 계층으로 이루어져 있습니다.

1.  <strong>라우터 계층 : 샤드 키 분할 정책, 리샤딩 전략, 쿼리 라우팅 등을 관리</strong>
2.  <strong>샤드 계층 : 데이터의 부분집합이 저장되는 PostgreSQL 노드</strong>

클러스터 생성 시 최소 ACU와 최대 ACU를 설정해야 하며, 이 값에 따라 초기 라우터와 샤드의 개수가 결정되는데요. 최소 ACU는 16, 최대 ACU는 6144까지 설정 가능합니다[[15]](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-cluster.html). 샤드의 데이터 용량 혹은 트래픽이 커지면 Shard Split을 통해 샤드를 분할할 수 있으며, 이는 수동으로도 가능하고 자동으로도 가능합니다.

하지만 한 번 분할된 샤드는 다시 병합되지 않고, 개별 샤드나 라우터를 삭제하는 건 불가능하기 때문에 최소 ACU가 증가하게 됩니다[16]. 다시 말하면 수평 확장은 노드의 추가를 통해 이루어지고 비피크 타임을 위한 스케일 다운은 수직적으로 ACU를 늘리고 줄이면서 동작합니다. (e.g. 도쿄 리전에 라우터 8개, 샤드 16개를 구성한다면 최소 ACU는 96개로 대략 하루에 60만원 정도 청구됩니다)

<strong>DynamoDB와 Limitless Database는 모두 수평 확장을 지원하여 쓰기 비율이 높은 게임 서버의 요구사항을 충족할 수 있습니다.</strong> 그러나 이 두 데이터베이스 간의 선택은 단순히 관계형 모델과 문서 모델의 차이만은 아닙니다. 더 깊이 있는 비교를 위해 다음 세 가지 측면에서 분석해보겠습니다.

1.  관계형 vs 비관계형
2.  복제 메커니즘
3.  파티셔닝 전략

이를 통해 두 데이터베이스의 차이점을 명확히 하고, 최종적으로 전문가의 의견을 종합해 선택 기준을 잡아보겠습니다.

> 평소에 관심있게 기술 서적을 보시는 분들은 [DDIA](https://www.yes24.com/product/goods/59566585) 라고 불리는 책에서 위 세 주제를 깊이 있게 다루는 것을 아실 겁니다. 아래 내용에 정리한 내용도 많은 부분 DDIA 책을 참고했고 일부 문구를 인용했습니다.

## 관계형 vs 비관계형

RDBMS와 Dynamo DB의 가장 큰 차이점 중 하나는 데이터 모델의 표현 방식입니다. 관계형 데이터 모델에서는 데이터를 테이블 단위의 스키마로 표현합니다. 서버를 대부분 객체지향 프로그래밍 언어로 개발하기 때문에 관계형 데이터(테이블, 로우, 칼럼)와 객체 사이의 복잡한 전환 계층이 필요합니다. 이렇게 관계형 데이터베이스와 객체지향 프로그래밍의 개념적 차이로 인해 발생하는 문제를 <strong>임피던스 불일치(impedence mismatch)라고</strong> 합니다.

![](/img/medium/1-nEdGAls-6CXPjfPvlq5zLQ-283ce80b37b6.png)

반면 스키마를 제약하지 않는 <strong>비관계형(NoSQL)데이터베이스</strong>는 유연한 스키마를 제공하여 이러한 불일치를 줄일 수 있습니다. JSON 형식으로 데이터를 저장함으로써 객체를 더 자연스럽게 표현할 수 있으며, 이는 코드의 간결성과 유지보수성을 향상시킬 수 있습니다.

JSON 문서는 지역성(locality)이 높아서 상대적인 성능 이점이 있습니다. 데이터가 여러 테이블로 나눠져 있는 관계형 DB에서는 전체 문서를 조회할 때 다수의 인덱스과 디스크 탐색이 필요하기 때문에 레이턴시는 증가하고 처리량이 상대적으로 낮아집니다.

> 게임의 경우 플레이어 본인의 정보를 조회하고, 본인의 정보만을 수정하는 요청이 빈번한 경우에는 JSON 형식의 저장방식이 코드의 간결함을 유지하는데 도움이 될 수 있습니다. 아래는 제가 즐겨하는 게임 중 하나인 젠레스 존 제로의 인벤토리 모습입니다. 800개가 넘는 아이템을 한 번에 조회해야 하기 때문에 이 경우에는 문서 자체를 저장하는게 좋을 수 있습니다.

![](/img/medium/1-eKTRhR5leBkYLlKuZv1UlQ-00ed480f996c.png "본인의 비틱 디스크 후후")


Vitess, CockroachDB 그리고 Limitless Database가 수평 확장을 지원하긴 하지만 일각에서는 이 사실에 비판적인 시각이 있습니다. Apache Cassandra의 핵심 개발자 중 한명인 Jonathan Ellis는 2009년에 다음 발표[17]에서 관계형 데이터베이스는 수평 확장이 불가능 하다고 주장합니다

![](/img/medium/1-D5e4sc8tgvjPD0_4O32sQQ-d5c18f166f6f.png)

> 관계형 DB에서 쓰기를 수평확장 하는 건 사실상 불가능하다. \
> <strong>만약 수평 확장을 한다면 그건 더 이상 관계형이 아니다.</strong>

위의 주장이 어떤 뜻으로 쓰인 건지는 정확히 알 수 없지만, 제가 알고 있는 지식에 기대어 생각해보면 다음과 같이 상상해볼 수 있습니다. 샤딩으로 수평 확장된 데이터베이스에서 데이터가 여러 샤드로 나뉘어져 있으면 트랜잭션은 여러 샤드에 걸쳐 <strong>2단계 커밋 프로토콜(2PC)</strong>을 수행해야 ACID 속성을 만족시킬 수 있습니다.

![](/img/medium/1-iYUNQW8F-uAKn2nHxQBxcg-35c86b88cf31.png "[출처 : 데이터 중심 애플리케이션 설계](https://ebrary.net/64872/computer_science/introduction_phase_commit#google_vignette)")


2단계 커밋 프로토콜은 그 특성상 많이 사용할수록 성능과 처리량이 저하될 수밖에 없습니다. MySQL 분산 데이터베이스인 Vitess는 초기 모델에서 분산 트랜잭션을 지원하지 않았습니다[[18]](https://vitess.io/blog/2016-06-07-distributed-transactions-in-vitess/). 그래서 중간에 한 노드에서 중단이 발생하면 데이터 불일치가 발생합니다. 현재 Vitess는 2단계 커밋 프로토콜을 실험 버전으로 제공하고 있지만, 프로덕션 환경에서는 주의해서 사용하라는 경고 문구가 있으며 가능한 한 사용을 자제하도록 권고하고 있습니다[19].

수평 확장을 위해 2단계 커밋 프로토콜이 발생하지 않도록 데이터를 설계할 수도 있습니다. 최신 RDBMS는 JSON 컬럼을 지원하기 때문에 문서 전체를 단일 행에 저장하면 트랜잭션이 단일 샤드에 대해 원자적으로 동작할 수 있습니다. 하지만 그렇게 하면 Jonathan Ellis의 주장처럼 데이터는 더 이상 관계형으로 표현되지 않게 됩니다.

## 복제 (Replication)

복제란 데이터를 네트워크에 연결된 여러 노드에 분산해서 복사본을 유지하는 매커니즘입니다. 데이터베이스에서는 고가용성을 높이거나 읽기 연산의 처리량을 높이거나 지리적으로 사용자에 가깝게 복제해서 지연시간을 줄이는데 이용합니다. 데이터를 복제하는데에는 크게 동기식 복제, 비동기 복제, 정족수 복제와 합의를 이용한 상태복제머신이 있습니다.

![](/img/medium/1--NfBPOS-y493q9s1Cpa47A-966781b448bd.png "(좌) 비동기 복제 / (우) 동기 복제")


가장 기본적인 RDBMS를 사용한다면 보통 쓰기 인스턴스 한 대와 여러개의 복제 인스턴스(read replica)를 구성하게 됩니다. 쓰기 인스턴스(리더)에 발생한 요청은 연결된 읽기 인스턴스(팔로워)로 로그를 복제해서 복사본을 구성하는데요. 이를 리더- 팔로워 모델이라고 합니다.

리더-팔로워 모델은 요청을 수행하는 리더에 장애가 발생하면, 팔로워 노드 중 하나가 다시 리더로 선출됩니다. 비동기 복제를 사용한다면 리더가 요청을 복제하지 못하고 장애가 발생하면 클라이언트는 본인의 요청이 유실되었다고 느끼게 됩니다. 동기식 복제는 모든 팔로워가 복제를 완료한 시점에 리더가 응답을 주기 때문에 일관성은 보장되나 팔로워 노드가 장애 상황이면 리더는 팔로워가 복구 될 때 까지 대기해야 합니다.

> 번외편 / [Redis의 복제 기본 설정](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)은 비동기로 동작하며, 1초마다 리더에게 ACK를 전달합니다. 이는 장애 시점에서 최대 1초간의 요청이 유실될 가능성이 있다는 의미입니다. 그래서 WAIT 커맨드로 동기 복제를 수행할 수 있는 기능이 있지만 성능을 다소 희생해야 합니다.

### 정족수 복제(Quorum Replication)
Aurora DB에서는 스토리지 레이어와 연산 레이어가 분리되어 있습니다. 그리고 스토리지 레이어는 최대 6대 중에 4대에 복제가 완료되어야 트랜잭션이 커밋됩니다. 정족수 복제는 이론적으로는 W+R ≥ N을 만족한다고 하더라도 일부 엣지케이스가 있다고 알려져 있습니다만, Aurora의 논문에 따르면 Aurora 스토리지 노드의 독특한 구조 때문에 합의까지는 필요 없다고 언급되어 있습니다.

![](/img/medium/1-TRsggfT-94_J4th9_rFJhA-af022f0d3f94.png "[Amazon Aurora: Design Considerations for High Throughput Cloud-Native Relational Database](https://pages.cs.wisc.edu/~yxy/cs764-f20/papers/aurora-sigmod-17.pdf)")


### 합의 알고리즘 (Consensus Algorithm)
합의 알고리즘은 높은 수준의 일관성과 내결함성을 제공하는 알고리즘입니다. 이러한 특성 때문에 쿠버네티스의 etcd, 아파치 카프카의 주키퍼 등 많은 분산 시스템의 컨트롤 플레인에서 활용되고 있습니다. 과거엔 Paxos 알고리즘이 주로 사용되었지만, 최근에는 Raft 알고리즘이 더 널리 채택되는 추세입니다.

DynamoDB는 데이터 저장 시 Paxos 알고리즘을 사용하여 서로 다른 가용 영역(AZ)에 2-out-of-3 방식으로 복제합니다. 정족수 복제와 합의 알고리즘을 통한 높은 가용성 보장은 복제 노드 수가 적을수록 효율적입니다. 결론적으로, Aurora와 DynamoDB는 모두 고수준의 복제 기술을 사용하므로 가용성 측면에서 큰 차이가 없다고 볼 수 있습니다.

## 파티셔닝 (Partitioning)

데이터가 매우 크거나 요청량이 많다면 복제로는 부족하고 데이터를 <strong>파티션</strong> 단위로 쪼갤 필요가 있는데, 이 작업을 <strong>샤딩</strong>이라고 합니다. (우선은 파티셔닝이 가장많이 쓰이는 용어이므로 파티션으로 통일했습니다)

파티셔닝이 적용되는 데이터베이스는 맨 처음으로 파티션 키를 무엇으로 쓸지 결정해야 합니다. 이 파티션키가 동일한 데이터는 같은 파티션에 배치되는데요. 예를 들어 유저와 관련된 정보를 조회하는 일이 많다면 user_id를 파티션 키로 고려할 수 있습니다.

Aurora Limitless Database 에서는 테이블을 생성하기 전에 테이블 모드와 샤드키를 설정해야 합니다. 테이블에는 <strong>샤드 테이블(sharded)</strong>과 <strong>참조 테이블(reference table)</strong> 두 개가 있는데, 참조 테이블은 모든 노드에 복사본을 유지해서 조인 성능을 높이는데 사용합니다. 이런 개념은 거의 대부분 샤딩을 지원하는 데이터베이스에서 공유하고 있습니다.

SET rds_aurora.limitless_create_table_mode='sharded';\
SET rds_aurora.limitless_create_table_shard_key='{"item_id", "item_cat"}';\
CREATE TABLE items(item_id int, item_cat varchar, val int, item text);

키를 파티션으로 나누는 방법에는 크게 <strong>범위 기반</strong>과 <strong>해시 기반</strong>이 있습니다. DynamoDB와 Aurora Limitless는 모두 해시 기반으로 파티션을 다룹니다만 단순히 <strong>모듈러 연산</strong>을 취하기 보단 더 동적으로 이를 제어합니다. Aurora Limitless 에서는 엔지니어가 직접 SQL 명령어 단일 샤드 하나를 쪼갤 수 있는데요. 특정 샤드가 핫 파티션이 된 경우에 사용하면 적절히 부하를 분산시킬 수 있습니다[21].

```sql
SELECT rds_aurora.limitless_split_shard('subcluster_id');
SELECT * FROM rds_aurora.limitless_list_shard_scale_jobs(1691300000000);
```
\
job_id \| action \| job_details \| status \| submission_time \| message\
---------------+-------------+-----------------------+---------+------------------------+-------------------------------------------\
1691300000000 \| SPLIT_SHARD \| Split Shard 3 by User \| SUCCESS \| 2023-08-06 05:33:20+00 \| Scaling job succeeded. +\
\| \| \| \| \| New shard instance with ID 7 was created.\
(1 row)

DynamoDB에서 파티셔닝은 테이블의 처리량(throughput)에 의해 결정됩니다. 클라우드 장비의 스펙이나 네트워크 대역폭을 고려해서 하나의 파티션이 최대 1000 WCUs 만큼만 처리 가능하다는 결론이 나왔다고 합시다. 만약 테이블이 3200 WCUs로 설정했으면 DynamoDB는 800WCUs씩 할당된 4개의 파티션을 생성합니다. 시간이 지나서, 고객이 6000 WCUs로 증가시키면 기존에 존재하는 파티션을 분할합니다. 다시 말하면, 1000 WCUs를 가진 6개의 파티션이 아닌, 750WCUs를 가진 8개의 파티션을 생성하게 됩니다.

이 과정을 반복하다보면 처음에는 파티션 하나에서 출발해서 트래픽이 증가할 수록 AWS가 관리하는 수천대의 스토리지 노드로 파티션이 분할됩니다. 이런 방식으로 DynamoDB는 일관된 레이턴시를 보장합니다.

> AWS RDS처럼 인스턴스를 임대하는 방식이 아닌 아마존이 거대한 키-밸류 DB를 운영하고 있고 멀티-테넌트 방식으로 우리에게 서비스를 제공하는 것이다 보니까 가능한거겠죠?

![](/img/medium/1-83pOJA_GnaFr89hH6xXujw-0c291c5fdb12.png "그림 출처 : [DynamoDB의 시스템 디자인과 분산 트랜잭션 구현 원리](https://medium.com/rate-labs/%EC%95%84-%ED%95%B4%EB%B4%90-dynamodb-%EB%93%A4%EC%96%B4%EA%B0%84%EB%8B%A4-f8da282bc625)")


### ① 파티션 리밸런싱
데이터베이스를 운영하면 하루에도 몇 번씩 상황이 변합니다. 특정 파티션에 쿼리 요청량이 증가하면 이 부하를 다른 노드로 분배할 필요가 있고, 장애가 발생하면 해당 노드가 담당하던 역할을 다른 노드가 이어 받아야 합니다. 이 경우 클러스터에서 한 노드에서 담당하던 부하를 다른 곳으로 옮기는 과정을 <strong>리밸런싱(rebalancing), </strong>리샤딩(resharding)이라고 합니다.

만약 인스턴스를 임대하는 방식이라면 파티션 리밸런싱 전략을 알아둘 필요가 있는데요. Aurora Limitless와 DynamoDB는 모두 파티션을 분할해서 새로운 인스턴스를 할당할 뿐 클러스터 내 노드 끼리 파티션 데이터를 서로 교환하진 않습니다. Aurora Limitless는 위에서 다루었던 샤드 분할 쿼리가 리밸런싱 대안으로 제공됩니다.

> 주로 온-디맨드 인스턴스로 운영하는 Apache Kafka, Elasticsearch 등은 파티션 리밸런싱할 때 클러스터 내의 노드끼리 파티션을 교환합니다. 이 때, 교환되는 파티션 개수를 작게 하기 위해서 일부러 노드 수 보다 많은 양의 파티션을 사전에 미리 생성하곤 합니다.

### ② 자동 리밸런싱과 수동 리밸런싱
파티션 리밸런싱은 자동으로 실행될까요? 아니면 수동으로 실행될까요? 이는 데이터베이스마다 조금씩 다릅니다. Elasticsearch는 자동으로 리밸런싱 하고 카우치베이스는 파티션 할당은 자동으로 제안하지만 반영되려면 관리자가 확정해야 합니다.

DynamoDB는 완전 관리형 키-밸류 데이터베이스로 개발자가 신경써야 할 내용이 크게 없지만, Aurora Limitless Database는 자동으로 샤드를 분할할 수 있는 기능이 제공되지만 [확정 시점에는 downtime이 존재합니다](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-shard-split.html#limitless-shard-split.finalize). 왠만하면 운영 중에는 지양해야겠죠.

리밸런싱은 요청 경로를 재설정해야 하고 대량의 데이터가 노드 사이를 이동해야 하기 때문에 비용이 매우 큰 연산입니다. 운영중에 처리하면 네트워크나 노드에 부하가 발생하게 되고 다른 유저의 요청 성능이 저하 될 수 있습니다. 카카오페이 에서는 샤딩이 얼마나 어려운 작업인지 회고하기도 했습니다.

![](/img/medium/1-KwvD9JFo7NcdSaqpBvlD7Q-959cecb4a640.png "[카카오페이 : AWS re:Invent 2023, 관심 세션을 중심으로 (1편): Aurora DB, Amplify](https://tech.kakaopay.com/post/2023-aws-reinvent-1/)")


> 리밸런싱과 자동 장애 감지가 조합되면 예상치못한 사이드-이펙트가 있을 수 있습니다. 예를 들어 리밸런싱 과정에서 특정 노드에 부하가 생겼다면 장애 감지 시스템이 새로운 노드로 교체하려고 할 수 있습니다.

### Aurora Limitless Database 도입전 고려사항

> 여기서는 제가 만약 Aurora Limitless Database를 실제로 도입한다면, 이런것들이 고려되어야 하겠다고 생각한 내용입니다. 많은 부분들이 미흡할 수 있습니다.

### ❶ 분산 트랜잭션
[Aurora Limitless Database는 내부적으로 샤드간 트랜잭션을 2PC로 지원합니다](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-query.distributed.html). [2PC를 수행하면서 구글 Spanner의 TrueTime과 비슷한 접근법으로 성능 향상을 꾀한듯 보입니다.](https://medium.com/rate-labs/%EA%B5%AC%EA%B8%80-spanner%EC%9D%98-paxos-%EB%B0%8F-truetime-%ED%99%9C%EC%9A%A9%EC%9D%84-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90-46cb5c165de8)

만약에 성능 때문에 분산 트랜잭션을 피하고 싶어도 회피할 수 없는 상황이 하나 있는데요. 샤드키의 경우에는 UPDATE 쿼리가 동작하지 않기 때문에 레코드 삭제와 삽입을 트랜잭션으로 묶어서 처리해야 합니다.

postgres_limitless=\> UPDATE items SET user_id = 11 WHERE user_id = 1;\
ERROR: Shard key column update is not supported\
\
postgres_limitless=\> UPDATE items SET user_id = 11 WHERE username = 'scalalang2';\
ERROR: Shard key column update is not supported

### ❷ 다대다 관계 데이터
다대다(Many-To-Many) 관계의 데이터는 샤딩과 키-밸류 모두 어울리지 않을 수 있습니다. 예를 들면, 유튜브에서 <strong>영상 A의 댓글 목록 조회(A)</strong> 기능과 <strong>내가 작성한 댓글 목록 조회(B)</strong>하는 기능이 있습니다. 이 기능은 서로 배타적인 성격을 가집니다.

쿼리 A를 빠르게 처리하려면 댓글에서 샤드 키를 영상 ID로 잡아야 하고, 쿼리 B를 빠르게 처리하려면 댓글의 샤드키를 유저 ID로 잡아야하는 배타적인 상황이 연출되는데요. 어느 한 쪽의 편의를 주면 다른 기능이 거의 모든 샤드를 스캔해야 하기 때문에 매우 비효율적입니다.

> 이 논리대로라면 유튜브는 자신이 쓴 댓글 리스트를 조회하는 기능이 없겠다라고 추론할 수 있습니다. 실제로 유튜브 내에서는 내 댓글 조회 기능이 없고 Google 활동이라는 별도 페이지가 존재했습니다. 유튜브 내에서 댓글을 작성하면 약 10~20초 뒤에 Google 활동 페이지에 노출됩니다. 즉, 이벤트를 수신바당서 2차 DB를 구성한 것으로 보입니다.

![](/img/medium/1-U6WzJLnl0TKtdwe_oFAPEg-0fc49d2b3a24.png "Google 내 활동 페이지에 있는 나의 댓글 목록 조회 기능")


### ❸ Read Replica 미지원
Aurora Limitless Database는 라우터 계층이 쿼리를 받아서 처리하는데요. 그래서 Read Replica란 개념이 없습니다. 당장 공개된 정보가 부족해서 읽기 전용 복제본을 사용할 수 없어서 읽기 전용 워크로드를 처리할 수 없는 건지는 확신하긴 어렵지만 맥락을 보면 당장은 쓰기 전용 워크로드가 높은 애플리케이션에만 적합해 보입니다.

### ❹ 성능의 불확실성
AWS의 유명한 엔지니어인 Marc Brooker는 [DynamoDB’s Best Feature: Predictability[22]](https://brooker.co.za/blog/2022/01/19/predictability.html) 에서 DynamoDB의 최대 장점은 <strong>예측 가능성</strong>이라고 말합니다.

SQL 데이터베이스는 복잡한 요인들이 상호작용하여 성능을 정확히 예측하기 어렵습니다. 간단한 SELECT나 JOIN 쿼리조차도 다음 요소들의 영향을 받습니다.

- 1. 인덱스 선택
- 2. 캐시 상태
- 3. 키 분포
- 4. 쿼리 옵티마이저의 실행 계획
- 5. 동시에 실행 중인 다른 쿼리
- 6. DB가 가비지 컬렉션 중인지 등 (e.g. VACCUM, Purge Thread)
- 7. 기타 등

이런 요인들 때문에 개발자가 작성한 코드가 실제 운영 환경에서 어떻게 동작할지, 그리고 제품이 성장하고 조건이 변화함에 따라 어떤 예상치 못한 결과가 발생할지 예측하기 어렵습니다.

반면, DynamoDB는 <strong>예측 가능한 성능</strong>을 제공하기 때문에 안정적이고 확장 가능한 시스템을 구축하는 데 큰 도움을 제공합니다. 관계형 데이터베이스도 확장 가능한 서비스 아키텍처를 구현할 수 있지만, 예기치 않은 부하 상황에서 시스템의 안정성을 유지하려면 상당한 추가 노력과 전문 지식이 필요합니다.

DynamoDB는 처음부터 안정성과 부하 관리를 고려하도록 설계되어 있어 있어서 개발자들이 시스템의 성능과 확장성을 쉽게 예측하고 관리할 수 있게 해주며 서버 코드의 영향을 더 직관적으로 이해하고 최적화할 수 있게 해줍니다. 또한, 자동 수평확장 기능은 개발자가 시스템을 이해하는데 더 많은 에너지를 투입하는 것 보다 실제 비즈니스 가치에 집중할 수 있게 해줍니다.

## 마무리

지금까지 DynamoDB와 AWS에서 새롭게 발표한 RDBMS인 Aurora Limitless를 비교 분석해보았습니다. 신뢰성 있는 시스템 구축을 위해 필요한 <strong>파티셔닝과 복제</strong>는 두 시스템 모두 비슷한 철학을 가지고 설계했습니다.

이제는 RDBMS는 수직 확장이 용이하고 DynamoDB는 수평 확장이 용이하기 때문에 성능을 원한다면 키-밸류 데이터베이스를 써야 한다는 이야기가 옛말처럼 느껴지기도 합니다. 유명한 두 채팅 시스템인 디스코드와 슬랙은 서로 다른 컨셉의 데이터베이스를 사용하기 때문에 어느 한 쪽의 선택이 무조건적으로 나쁘다고 할 순 없다고 봅니다.

![](/img/medium/1-GjYc3tPmxHblS_qlPcnXIQ-24d6d3a97323.png)

저는 위에서 나열된 고려사항 중 <strong>❹ 성능의 불확실성</strong> 부분에서 Marc Brooker님의 의견에 공감하고 있습니다. 회사에서 저의 역할은 기술적 자아실현이 아닌 게임 서버 개발이며, 게임 서버의 가장 중요한 역할은 플레이 경험을 해치지 않는 것 입니다.

게임 서버의 특성상 플레이어가 본인의 정보를 조회하고 수정하는게 빈번하고 플레이어간 연결성 수준이 다소 작기 때문에 키-밸류 기반의 데이터베이스가 좋은 선택지가 될 수 있다고 느꼈습니다. Dynamo DB의 예측 가능성과 자동 확장 기능은 팀이 시스템 리서치나 최적화에 많은 공을 들이는 대신 컨텐츠 개발에 집중할 수 있도록 도와줄 것으로 기대합니다.

### 레퍼런스

- [1] Citus \| Postgres 분산 데이터베이스 A-Z 소개
- [2] [The architecture of a distributed SQL database, part 1: Converting SQL to a KV store](https://www.cockroachlabs.com/blog/distributed-sql-key-value-store/)
- [3] [When would you NOT choose DynamoDB where you’d typically use RDBMS?](https://www.reddit.com/r/aws/comments/11bpfen/when_would_you_not_choose_dynamodb_where_youd/)
- [4] [How Discord Stores Billions of Messages](https://discord.com/blog/how-discord-stores-billions-of-messages)
- [5] [Scaling Datastores at Slack with Vitess](https://slack.engineering/scaling-datastores-at-slack-with-vitess/)
- [6] [ADT 활용 예제1: MySQL Shard 데이터 재분배](https://tech.kakao.com/posts/325)
- [7] [LINE Manga 데이터베이스 샤딩 — 서버 엔지니어 편](https://engineering.linecorp.com/ko/blog/line-manga-server-side)
- [8] [DB분산처리를 위한 sharding](https://techblog.woowahan.com/2687/)
- [9] [Citus \| Postgres 분산 데이터베이스 A-Z 소개](https://medium.com/p/8f2fe3dd3428)
- [10] [데브시스터즈 — CockroachDB in Production](https://tech.devsisters.com/posts/cockroachdb-in-production/)
- [11] [Amazon Aurora PostgreSQL Limitless Database 정식 출시](https://aws.amazon.com/ko/blogs/korea/amazon-aurora-postgresql-limitless-database-is-now-generally-available/)
- [12] [Steam DB](https://steamdb.info/app/578080/charts/)
- [13] [Aurora PostgreSQL Limitless Database requirements and considerations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-reqs-limits.html)
- [14] [Amazon Aurora PostgreSQL Limitless Database is now generally available](https://aws.amazon.com/blogs/aws/amazon-aurora-postgresql-limitless-database-is-now-generally-available/)
- [15] [Creating a DB cluster that uses Aurora PostgreSQL Limitless Database](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-cluster.html)
- [16] [Aurora PostgreSQL Limitless Database requirements and considerations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-reqs-limits.html)
- [17] [Cassandra: Open Source Bigtable + Dynamo](https://www.slideshare.net/slideshow/cassandra-open-source-bigtable-dynamo/1786870#3)
- [18] [Distributed Transactions in Vitess](https://vitess.io/blog/2016-06-07-distributed-transactions-in-vitess/)
- [19] [Vitess — Two-Phase Commit](https://vitess.io/docs/20.0/reference/features/two-phase-commit/)
- [20] [Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service](https://www.usenix.org/system/files/atc22-elhemali.pdf)
- [21] [Splitting a shard in a DB shard group](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/limitless-shard-split.html)
- [22] [DynamoDB’s Best Feature: Predictability](https://brooker.co.za/blog/2022/01/19/predictability.html)
