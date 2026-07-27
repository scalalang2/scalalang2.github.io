---
title: "CacheBlend | RAG기반 LLM 추론 속도 개선하기"
date: "2025-04-19T23:43:17.331Z"
slug: "cacheblend-rag기반-llm-추론-속도-개선하기-bdf8fa7c8e40"
description: "CacheBlend[1]는 EuroSys’2025에서 최우수 논문(Best Paper)로 선정된 두 개의 논문 중 하나입니다. CacheBlend은 기존 접근법과 비교하여 RAG, QA 태스크에서 TTFT(time-to-first-token)를…"
tags: []
---

[CacheBlend](https://arxiv.org/pdf/2405.16444)[1]는 EuroSys’2025에서 최우수 논문(Best Paper)로 선정된 두 개의 논문 중 하나입니다. CacheBlend은 기존 접근법과 비교하여 RAG, QA 태스크에서 <strong>TTFT(time-to-first-token)</strong>를 2.2–3.3배, 그리고 추론 처리량은 2.8–5배 개선했다고 주장합니다.

해당 논문의 저자는 [LMCache](https://lmcache.ai/)[2]라는 이름의 오픈소스를 개발했고, LMCache는 vLLM 위에서 동작하며 RAG 기반의 프롬프트를 처리할 때 추론 속도를 높이는데 도움을 줍니다.

![](/img/medium/1-yAfO-ZvgWNl_-7YD6UmR8A-ce3a0e256510.png "vLLM을 LMCache와 함께 사용할 때 TTFT가 큰 폭으로 개선된다고 소개하고 있습니다.")


> 본업이 아닌 취미로 논문을 읽는 사람의 시선에서 정리한 내용입니다. 혹시 알고 계신 것과 다른 내용이 있거나 궁금한 점이 있으시면 피드백 부탁드립니다.

> [Pangyoalto](https://medium.com/u/89ed5885f0af)님이 작년에 vLLM에 대해서 소개해주셨는데요.\
> 본 글과 함께 보시면 좋습니다.

[<strong>Efficient Memory Management for Large Language Model Serving with PagedAttention</strong>\
*해당 글은 필자의 블로그에 이미 발간된 글입니다.\
본 글은 Efficient Memory Management for Large Language Model Serving with PagedAttention(2023)…*medium.com](https://medium.com/rate-labs/efficient-memory-management-for-large-language-model-serving-with-pagedattention-01aacffe3b78 "https://medium.com/rate-labs/efficient-memory-management-for-large-language-model-serving-with-pagedattention-01aacffe3b78")[](https://medium.com/rate-labs/efficient-memory-management-for-large-language-model-serving-with-pagedattention-01aacffe3b78)

### Table Of Contents

- 트랜스포머(Transformer)
- KV 캐시
- 논문의 배경
- CacheBlend
- 성능 평가
- 마무리

## 트랜스포머(Transformer)

2017년 발표된 [Attention Is All You Need](https://research.google/pubs/attention-is-all-you-need/)[3] 논문으로 잘 알려진 트랜스포머는 대규모 언어 모델(LLM)의 핵심 컴포넌트입니다. 트랜스포머는 입력 시퀀스 내 모든 토큰쌍 간의 관계를 어텐션 매커니즘을 통해 계산합니다.

각 레이어에서는 들어온 입력에 대해 <strong>쿼리(Q), </strong>키(K), <strong>밸류(V)</strong> 벡터를 생성하고 이들 간 내적 연산을 통해 각 토큰이 얼마나 다른 토큰과 강하게 의미가 연결되는지 계산합니다.

![](/img/medium/1-CyCNFP2Nlv35eCndoUrbcA-255f30f77eaa.png "트랜스포머 구조")


![](/img/medium/1-UqfoFl9G-EWguxGxwn_hNw-ce22331b8b31.png "어텐션 계산 수식")


## KV 캐시

KV캐시[[4]](https://huggingface.co/blog/not-lain/kv-caching)[[5]](https://medium.com/@plienhar/llm-inference-series-4-kv-caching-a-deeper-look-4ba9a77746c8)[[6]](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/)는 LLM에서 토큰을 생성하는 <strong>디코더</strong>에서 추론 속도를 높이는 데 쓰입니다. 자기 회귀 언어 모델(Autoregressive LLM)은 문장의 다음 토큰을 생성하는데 모든 이전 토큰의 K, V벡터를 사용하는데요. 이 과정에서 일부 반복적인 어텐션 계산이 필요하며, 이것이 디코딩 성능에 큰 영향을 줍니다.

![](/img/medium/1-mSugAChiU_eZ_ogIhzu22w-7a182e726b0b.png)

인코더 과정에서의 Self-Attention과 달리, 디코더에서 t 번째 토큰의 어텐션 계산에 필요한 값은 이전 토큰들의 Key 벡터와 Value 벡터 뿐입니다. 이를 캐싱해서 불필요한 어텐션 계산 과정을 줄이면 <strong>시간복잡도가 2차함수 O(n²)에서 선형시간 O(n) 으로 줄어듭니다.</strong> (이때 n은 입력 시퀀스 길이)

![](/img/medium/1-TP4ZF0A3tbTz2IsjRJQ7Ug-0bc15afe52d7.png "KV 캐시를 활용한 계산 방법 / 행렬 차원은 고려하지 않고 대충 그린 그림입니다. [(그림 출처)](https://medium.com/@plienhar/llm-inference-series-4-kv-caching-a-deeper-look-4ba9a77746c8)")


위 그림은 어텐션 레이어 하나에 대해서 표현한 것이지만, 실제로는 모든 트랜스포머 레이어에서 KV 캐시를 저장해야 합니다. 임의의 층 L에서의 입력값은 L-1 층에서의 결과값인 W_O 의 어텐션 결과값이기 때문에 이전 토큰의 K/V 벡터를 캐싱한다는 것은이전 토큰의 어텐션 결과값을 캐싱한다는 의미 입니다. [(LLaMA 2–7B 모델은 32개의 트랜스포머 레이어를 가지고 있습니다)](https://arxiv.org/pdf/2312.04333)

KV캐시의 의미 자체는 디코딩 과정에서 나오는 K/V 벡터를 캐싱하는 것이지만, 이를 더 활용할 수 있는 방법이 있습니다. 예를 들어 LLM 에이전트에게 시스템 프롬프트를 사용하면 토큰을 생성할 때 항상 같은 K/V 벡터를 사용하게 되겠죠.

## 논문의 배경

<strong>RAG(Retrieval-Augmented Generation)</strong>란 LLM을 더 잘 사용하기 위한 방법론 중 하나입니다. RAG는 흔히 사용자의 질문에 더 잘 답변하기 위해 연관된 텍스트 청크를 [Milvus](https://medium.com/rate-labs/milvus-%EB%B2%A1%ED%84%B0-%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B2%A0%EC%9D%B4%EC%8A%A4-b26065c51c16) 혹은 [Google Vertex](https://cloud.google.com/vertex-ai?hl=ko)와 같은 검색엔진에서 찾은 다음 사용자 입력 앞단에 같이 덧붙여서 LLM에 입력으로 주는 방식으로 동작합니다.

LLM은 학습한 시점 이후부터는 새로 추가된 지식이 없기 때문에, 이미 과거가 되어버린 정보를 줄 수 있다는 단점이 있습니다. 주기적으로 다시 학습시키면 되겠지만 비용 부담이 크기 때문에 최근에는 RAG를 통해 이를 극복하고자 하는 시도가 많습니다.

![](/img/medium/0-26YnsfeB_3dxB1Ur-8612c42e796f.png "[Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997)")


[<strong>RAG의 짧은 역사 훑어보기(첫 논문부터 최근 동향까지)</strong>\
*해당 글은 필자의 블로그에 이미 발간된 글입니다.*medium.com](https://medium.com/rate-labs/rag%EC%9D%98-%EC%A7%A7%EC%9D%80-%EC%97%AD%EC%82%AC-%ED%9B%91%EC%96%B4%EB%B3%B4%EA%B8%B0-%EC%B2%AB-%EB%85%BC%EB%AC%B8%EB%B6%80%ED%84%B0-%EC%B5%9C%EA%B7%BC-%EB%8F%99%ED%96%A5%EA%B9%8C%EC%A7%80-53c07b9b3bee "https://medium.com/rate-labs/rag%EC%9D%98-%EC%A7%A7%EC%9D%80-%EC%97%AD%EC%82%AC-%ED%9B%91%EC%96%B4%EB%B3%B4%EA%B8%B0-%EC%B2%AB-%EB%85%BC%EB%AC%B8%EB%B6%80%ED%84%B0-%EC%B5%9C%EA%B7%BC-%EB%8F%99%ED%96%A5%EA%B9%8C%EC%A7%80-53c07b9b3bee")[](https://medium.com/rate-labs/rag%EC%9D%98-%EC%A7%A7%EC%9D%80-%EC%97%AD%EC%82%AC-%ED%9B%91%EC%96%B4%EB%B3%B4%EA%B8%B0-%EC%B2%AB-%EB%85%BC%EB%AC%B8%EB%B6%80%ED%84%B0-%EC%B5%9C%EA%B7%BC-%EB%8F%99%ED%96%A5%EA%B9%8C%EC%A7%80-53c07b9b3bee)

> <strong>번외</strong>
> 일반적으로 PostgreSQL의 성능 저하 이슈를 LLM에 물어보면, 쿼리를 최적화하세요. 설정을 점검하세요. 리소스를 확인하세요 등 잘 알려진 몇개의 답변밖에 하지 못합니다. 하지만, 내가 실제 사용하고 있는 쿼리, 실제 현재 컴퓨팅 자원 메트릭, 데이터베이스 로그 등을 함께 입력으로 제공하면 더 정확한 답변을 들을 수 있겠죠. [AWS 연구팀은 지금 말한 내용을 실제 구현하고 평가했습니다[6]](https://www.amazon.science/publications/panda-performance-debugging-for-databases-using-llm-agents).

본 포스팅의 주인공인 CacheBlend 논문에서는 RAG 환경에서 K/V 캐시를 재활용하는 방법을 제시합니다. 논문에서 제시한 해결책을 다루기 앞서 현재 K/V 캐시를 활용하는 두 가지 패턴의 문제점을 먼저 짚고 넘어갑니다.

### ① Prefix Caching
Prefix Caching이란 LLM 에이전트의 시스템 프롬프트처럼 무조건 반복적으로 사용되는 경우 사용합니다. Prefix Caching은 원래 LLM 추론 과정과 같은 연산을 하기 때문에 출력 텍스트 품질 손실이 없습니다. [vLLM](https://docs.vllm.ai/en/latest/), [SGLang](https://github.com/sgl-project/sglang), [RAGCache](https://arxiv.org/abs/2404.12457)[7] 시스템들이 이런 기법을 사용하고 있습니다.

하지만, RAG를 사용하게 되면 여러 텍스트 청크를 검색엔진에서 가져와서 붙이기 때문에 Prefix Caching을 사용할 수 없습니다. 예를 들어 <strong>`C1, C2`</strong> 두개의 문장을 가져왔다고 합시다. 문장 <strong>`C1 + C2`</strong>를 이어 붙여서 사용하면 2가지 문제가 있습니다.

1.  첫 문장인 <strong>C1</strong>은 트랜스포머 구조에서 Positional Embedding이 보존되는 반면, 그 다음에 등장하는 문장인 C2는 위치가 달라졌기 때문에 다시 계산해야 합니다. 따라서 K/V 캐시 전체를 다시 계산해야 하죠
2.  이를 무시하고 그냥 사용한다고 하면, C2의 캐시에는 C1의 문장을 포함한 어텐션 값이 없기 때문에 잘못된 답을 생산합니다. <strong>이 두가지 이유로 RAG에서는 Prefix Caching을 그대로 사용하기 어렵습니다.</strong>

아래 그림은 메시와 호날두의 피파 월드컵 통산 골 수를 비교하는 입력을 넣었을 때 두 선수의 기록을 각각 찾아서 이어붙인 사례를 보여줍니다. 두 문장의 K/V 캐시를 그냥 이어붙이면 답변을 제대로 못하는 것을 볼 수 있습니다. (메호대전을 언급하다니..)

![](/img/medium/1-qfsgQzt0JlWW4wyU78yCNg-957d7775e73d.png "그림 출처 : CacheBlend 논문")


> <strong>번외</strong>\
> RAGCache는 논문을 대충 훑어보기만 했는데요. 방법론 자체가 Prefix에 자주 등장하는 텍스트의 K/V 캐시를 더 메모리에 오래 상주시키자는 아이디어에서 출발합니다. CacheBlend와는 접근법이 많이 다르기 때문에 이정도로만 짧게 소개하겠습니다.

### ② Full KV reuse
논문에서는 <strong>PromptCache(MLSys’2024)</strong>[8] 논문의 접근법을 Full KV reuse라고 부르고 있습니다. PromptCache는 입력의 접두가(prefix)가 아니더라도 앞에 buffer라고 불리는 의미없는 더미 텍스트를 넣어서 텍스트 청크의 위치 정보는 보존하는 방법입니다.

하지만, 이 접근법은 문장과 문장사이의 어텐션은 무시하기 때문에 RAG에서는 사용하기 어렵습니다. CacheBlend 논문에서는 RAG 태스크를 수행할 때 이어 붙인 텍스트 청크가 증가할 수록 PromptCache 방법론의 F1-Score가 감소하는 것을 볼 수 있습니다.

![](/img/medium/1-ep9fbh28knYHSjgJvg6hQA-010e3df20bc8.png)

PromptCache(= Full KV reuse)의 답변 품질이 감소하는 이유는, 앞서 말했듯 <strong>문장과 문장 사이의 어텐션(cross chunk attention)</strong>을 무시하기 때문입니다.

![](/img/medium/1-g8O9LoVoLRTFZj87fk4qBw-484291ed8396.png "(a) KV 값을 처음부터 계산한 경우, (b) Full KV reuse를 사용한 경우")


> <strong>번외 1)</strong>
> RAG에서 텍스트 청크 개수가 많아지면 처음엔 성능이 증가하다가 이후 어느 순간 감소하는 것을 볼 수 있습니다. 이는 LLM이 초반부와 마지막에 있는 문장은 집중해서 보고, 문장 가운데에 있는 정보는 잃어버리는 경향이 있다는 스탠포드 및 UC Berkeley 연구진이 보고한 [Lost in the Middle[9]](https://arxiv.org/pdf/2307.03172) 문제와 관련이 있습니다.

> <strong>번외 2)</strong>
> CacheBlend는 PromptCache의 논문을 인용했지만, 사실 PromptCache 에서 해결하고자 하는 문제는 RAG가 아닌 템플릿화된 프롬프트에서 성능을 높이는 방법입니다. 이 둘을 직접 비교하긴 어려우나 제 개인적인 생각으로는 CacheBlend가 상위호환처럼 보이기는 합니다.

![](/img/medium/1-uhMFyZZnnlmyeSpMPS5jaw-456cd20acdfd.png "[출처 : PromptCache](https://arxiv.org/pdf/2311.04934)")


## CacheBlend

CacheBlend의 목표는 RAG 환경에서 성능과 레이턴시를 모두 챙길 수 있는 방법을 찾는 것입니다. 먼저 중요한 용어부터 정리하겠습니다.

![](/img/medium/1-R9rkMBDDgtJg2L7HyIf-eg-59710fda2ce0.png)

표에는 많은 기호가 적혀있지만 이 글을 보시는 분은 마지막 두 개의 표현에만 주목하시면 됩니다.

- <strong>KV deviation(= $\Delta_{kv}$)</strong> 는 전체를 다시 계산했을 경우와 K/V 캐시간의 절댓값 오차를 나타냅니다.
- <strong>Attention deviation(= $\Delta_{attn}$)</strong> 는 KV deviation과 마찬가지로 캐시 사용 없이 전체를 계산했을 때의 어텐션 값과 캐시를 이용한 경우의 어텐션 값 차이를 나타냅니다.

CacheBlend의 목적은 캐시 중 일부를 업데이트 하면서(KV_new), 실제로 계산했을 경우의 어텐션 값 차이를 최소화 하는 것입니다. 이를 통해 RAG 환경에서 여러 청크들의 KV 캐시를 재활용할 수 있습니다.

![](/img/medium/1-r0RHgnAqbM9VA-PhG2xbhQ-4927f55c8fbc.png)

이 말을 아래 그림에서 잘 표현해주고 있습니다. CacheBlend는 K/V 캐시 중에서 일부 벡터만 다시 계산하고 나머지 부분은 캐시를 그대로 사용합니다.

![](/img/medium/1-UUj6sWILE0_QdRX2wxvOKQ-c40403c4d3c0.png)

그럼 이제 중요한 질문이 떠오릅니다. <strong>어떤 토큰을 재계산할 지 어떻게 결정할까요?,</strong> 가장 좋은 건 $\Delta_{kv}$값을 가장 크게 만드는 <strong>범인</strong>을 찾아서 해당 벡터만 다시 계산하는 겁니다. 이 말을 달리하면, 다시 계산했을 때 $\Delta_{kv}$이 작아지는 토큰을 찾아서 업데이트해야 합니다. 제가 여기서는 범인이라고 표현했지만 논문에서는 이를 <strong>HKVD(High-KV-Deviation)</strong> 토큰 이라고 부릅니다.

HKVD를 구하려면 이를 비교할 수 있는 <strong>KV_full(전체 계산)</strong>값이 필요하기 때문에 우리는 휴리스틱한 접근법이 필요한데요. 논문 저자들은 트랜스포머에서 다음 두 가지 현상을 발견합니다.

### ① 한 레이어에서 HKVD 토큰을 다시 계산하면 $\Delta_{attn}$이 큰폭으로 감소한다.
아래 그림은 논문 저자들이 3개의 모델에 대해서 K/V 벡터를 재계산 할 비율 R%를 늘려가면서 $\Delta_{attn}$의 변화량을 관찰한 결과입니다.

![](/img/medium/1-xJM2nBUMl3MI5EuLbsnQzw-bfa70a59b925.png)

어림잡아 10-20% 정도만 재계산해도 $\Delta_{attn}$ 값이 큰 폭으로 감소하는 것을 볼 수 있습니다. 저자들은 이 현상의 근거를 [<strong>어텐션 희소성(attention sparsity)[10]</strong>](https://openai.com/index/sparse-transformer/)에서 찾았습니다 (높은 어텐션값은 일부 소수의 토큰에 집중된 경향이 있습니다)

### ② 레이어 간 HKVD토큰은 높은 상관관계를 가진다.
어떤 한 레이어에서 발견된 HKVD 토큰은 다음 레이어에서도 HKVD토큰인 경향이 매우 크다고 합니다. 논문 저자들은 이에 대한 근거로 인접한 레이어에서 각 토큰들의 $\Delta_{kv}$ 값의 [스피어만 상관계수](https://en.wikipedia.org/wiki/Spearman%27s_rank_correlation_coefficient)를 제시합니다.

쉽게 비유하자면, 중학교 시험에서 순위권 성적을 받은 학생이 고등학교에서도 순위권 성적을 받을 확률이 높은 것으로 이해하면 됩니다.

![](/img/medium/1-shLTApQB2uPxPZ16GCu1iw-58f2188ddda2.png)

뒤 두 사실을 근거로 논문 저자들은 첫 번째 레이어에서는 캐시를 사용하지 않고 정석대로 계산한 다음에 r%의 높은 성적($\Delta_{kv}$)을 받은 토큰들을 선택해서 모든 레이어에서 이 친구들만 재계산합니다.

하지만 수능이라는 단 한 번의 시험이 학업수행능력의 평가의 척도로 쓰인다면 조금 아쉬울 수 있겠죠. GPT 3.5의 LLM 레이어는 96개인 것으로 알려져 있습니다. 논문 저자들은 첫 번째 레이어에서만 상위권 학생을 고정시켜 버리면 통계적으로 조금 불안정한 값이 될 수 있다고 합니다.

그래서 <strong>점진적 필터링 스킴(gradual filtering scheme)</strong>을 추가로 사용하는데요. 첫 번째 레이어에서 모집하고자 하는 r%의 학생 보다 더 많은 수를 선발해서 이를 다음 레이어에서 점진적으로 줄여나갑니다.

![](/img/medium/1-tzpGdYEec73bGfPb3hFgZQ-59069bc7cea1.png)

논문의 핵심 아이디어가 이해하고 보면 생각보다 단순하죠? 논문에서는 <strong>｢5장. 시스템 디자인｣, ｢6장. 구현｣</strong> 에서 vLLM에 3000줄의 코드를 추가하면서 어떻게 이를 구현했는지 설명하는 내용이 있습니다. 본 글에서는 이 내용을 생략하였으니 해당 내용이 궁금하신 분들은 논문을 참고하시기 바랍니다.

## 성능 평가

CacheBlend의 평가 결과를 요약하면 3가지로 말할 수 있습니다.

<strong>TTFT 개선</strong> : 여러 모델과 태스크에 대해서 캐시를 전혀 사용하지 않는 것 대비 2.2–3.3x의 속도 개선

<strong>높은 퀄리티 유지 :</strong> PromptCache 대비 CacheBlend는 0.15 ~ 0.35 높은F1-Score 및 Rouge-L을 기록하고 있다. 캐시를 쓰지 않고 재계산 했을때의 성능과 비교하면 0.01–0.03의 품질 저하가 있지만 이는 수용할 수 있는 범위 이내이다.

<strong>높은 처리량 :</strong> CacheBlend는 3.3x ~ 5x 높은 처리량을 가진다. (RAG 환경에서의 성능 비교이기 때문에 어쩌면 당연한 결과입니다. 다른 방법론들은 RAG에서 가져오는 청크 크기가 클수록 TTFT가 선형적으로 느려질 것입니다)

![](/img/medium/1-7pcwKkGh8tKi6ACH2wNYNA-59f793e822d0.png "퀄리티는 유지하면서 TTFT는 개선했다 (청크 개수 = 6)")


![](/img/medium/1-uGZtDkknSgR_b9ydz3vjYw-29078eb64683.png "요청 수가 증가해도 타 모델 대비 안정적인 TTFT를 보여준다")


## 마무리

이번 글에서는 KV 캐시를 사용하는 <strong>자기회귀 언어 모델(Autoregressive LLM)</strong>에서 성능을 개선한 CacheBlend 논문을 다루었습니다. 사실 제가 LLM에 크게 관심이 있기 보단 상 받은 논문이니까 읽어나 보자는 마음으로 접근했는데요. 생각보다 많은 내용을 배웠고 또한 재밌게 읽었습니다.

본 스터디에는 N사에서 LLM 업무를 하시는 분이 계신데요. 이 분이 몇 달전에 [확산 모델 기반 LLM[11]](https://arxiv.org/pdf/2502.09992) 논문을 소개해 주신적이 있습니다. 실제로 확산 모델(Diffusion Model)연구의 권위자 분들이 창업한 [인셉션 랩스의 머큐리](https://www.inceptionlabs.ai/)를 이용해보시면 문장 생성 속도가 엄청 빠르다는 것을 체감할 수 있습니다.

![](/img/medium/1-pJAt6vgozQ7kP2MnZnGxJw-87326323ded8.png)

자동차의 가속능력을 평하기 위해서 <strong>제로백(정지 상태에서 시속 100km 가속에 걸리는 시간)</strong> 이라는 평가 지표를 많이 사용했었습니다. 전기차가 등장하기 이전에는 이것이 제조사의 능력을 평가하는 척도로 사용되었지만, 전기차라는 패러다임이 등장하고 나서는 왠만한 전기차는 내연기관의 제로백을 가뿐히 넘습니다.

[확산 모델 기반 LLM[11]](https://arxiv.org/pdf/2502.09992)로 패러다임이 옮겨가면, 이미 나온 제품들에는 위기가 오고, 이제 막 연구를 시작한 사람들에게는 기회가 올 수도 있습니다. 확산 모델 기반 LLM도 트랜스포머 구조를 이용하기 때문에 오늘 배운 CacheBlend가 적용될 수 있긴 하지만 자기회귀 모델에 적용했을 때와 비교해서 놀랄 만한 성능일지는 한 번 지켜봐야 할 것 같습니다.

### 레퍼런스

- [1] [CacheBlend: Fast Large Language Model Serving for RAG with Cached Knowledge Fusion](https://arxiv.org/pdf/2405.16444)
- [2] [LMCache](https://lmcache.ai/)
- [3] [Attention Is All You Need](https://research.google/pubs/attention-is-all-you-need/)
- [4] [KV Caching Explained: Optimizing Transformer Inference Efficiency](https://huggingface.co/blog/not-lain/kv-caching)
- [5] [Pierre Lienhart](https://medium.com/u/4e8bdd342794) \| [LLM Inference Series: 4. KV caching, a deeper look](https://medium.com/@plienhar/llm-inference-series-4-kv-caching-a-deeper-look-4ba9a77746c8)
- [6] [Panda: Performance debugging for databases using LLM agents](https://www.amazon.science/publications/panda-performance-debugging-for-databases-using-llm-agents)
- [7] [RAGCache: Efficient Knowledge Caching for Retrieval-Augmented Generation](https://arxiv.org/abs/2404.12457)
- [8] [Prompt Cache: Modular Attention Reuse for Low-Latency Inference](https://arxiv.org/pdf/2311.04934)
- [9] [Lost in the Middle: How Language Models Use Long Context](https://cs.stanford.edu/~nfliu/papers/lost-in-the-middle.arxiv2023.pdf)s
- [10] [Generative modeling with sparse transformers](https://openai.com/index/sparse-transformer/)
- [11] [Large Language Diffusion Models](https://arxiv.org/pdf/2502.09992)
