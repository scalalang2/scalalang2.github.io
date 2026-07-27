---
title: "CycleGAN — Unpaired 데이터를 학습하고 이미지 변환하기"
date: "2020-09-30T08:12:09.201Z"
slug: "cyclegan-unpaired-데이터를-학습하고-이미지-변환하기-6fca2f2cddd5"
description: "이번 포스팅에서는 이미 너무나도 유명한 CycleGAN 논문을 리뷰해보고자 한다. 본 글의 구성은 첫 째로 CycleGAN을 집필한 저자에 대해 소개하는 것으로 시작한다. 논문 저자는 CycleGAN 이후로도 2020년 현재까지 이미지 생성 모델…"
tags: []
---

이번 포스팅에서는 이미 너무나도 유명한 CycleGAN 논문을 리뷰해보고자 한다. 본 글의 구성은 첫 째로 CycleGAN을 집필한 저자에 대해 소개하는 것으로 시작한다. 논문 저자는 CycleGAN 이후로도 2020년 현재까지 이미지 생성 모델 분야에서 활발한 연구 활동을 하고 있고 주제가 흥미롭기 때문에 간략하게 소개한다. 두 번째로 논문에서 해결하고자 한 Unpaired 이미지 변환 문제에 대해 설명하고 이어서 해결 방법인 순환 일관성 손실 함수에 대해 다룬다. 그 다음 실험을 진행한 방식과 이 방법론으로 무엇을 할 수 있는지 서술하고 마지막으로 한계점에 대해 기술한 다음 글을 마친다.

> CycleGAN이 소개된 논문의 제목은 “Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks”로 2017년에 IEEE ICCV에 제출된 페이퍼이다[1].

### 구성

- 저자 소개
- Unpaired Image-To-Image Translation
- 순환 일관성 손실 함수 (Cycle Consistency Loss)
- 어디에 쓸 수 있을까?
- 실험 및 한계점
- 결론

## 저자 소개

이 논문의 공동 저자인 Jun-Yan Zhu와 Taesung Park은 논문을 집필 할 당시 UC 버클리 대학교 인공지능 연구실의 박사 과정 학생이었다. 제 1저자인 Jun-Yan Zhu는 현재 카네기 멜론 대학교의 연구 교수로 재직하면서 꾸준한 연구 활동을 하고 있다[2]. 특히 올해에만 CVPR, ICCV 등 컴퓨팅 비전 컨퍼런스에서 꾸준히 페이퍼를 제출하고 있는데 주로 생성 모델을 이용한 연구를 하고 있는 듯 하다. 이 중 간단한 스케치만 해도 바로 실사 이미지로 변환해주는 연구도 있는데 결과가 놀랍기 때문에 이 논문은 추후에 각잡고 읽어 볼 예정이다.

![](/img/medium/1-BnrYkjDU_0tLCHGuWmhGyw-5ebff79489a1.png "[그림 1] CycleGAN 저자의 2020년 연구 활동 내용")


## Unpaired Image-To-Image Translation

이 논문의 Introduction은 19세기 프랑스 인상파 화가인 클로드 모네의 이야기로 시작한다. 클로드 모네가 오늘날의 명성을 가지게 한 작품은 1873년에 그린 ‘아르장퇴유의 다리'이다. 이 작품은 외부 세계의 아름다움을 사실적으로 표현하는 고전주의에 반대하며 내면에서 느낀 아름다움을 표현하려고 한 인상주의 화풍의 시작을 알린 작품이다. 만약 클로드 모네가 프랑스 사람이 아니라 한국에서 태어나 한강을 바라보았다면 어떤 그림이 나왔을까? 클로드 모네의 화풍을 학습하는 딥러닝을 만들어서 서울의 한강을 인상주의 화풍으로 그려낼 수 있을까?

![](/img/medium/0-Lc_VYsrY9_bHYomV-86dda82ec55f.jpg "[그림 2] <1874> 아르장퇴유의 다리 - 클로드 모네")


하나의 그림 작품에 사용된 화풍을 실사 이미지에 적용해 변환하는 문제는 특징이 겹치지 않은 서로 다른 이미지 집합을 <strong>(Unpaired Images)</strong> 학습해야 한다. CycleGAN의 선행연구격인 pix2pix[3]에서는 서로 비슷한 특징을 지닌 데이터를 학습한다. 정형적으로 작성하면 입력값 x와 출력값 y에 대해 어느 정도 유사성을 지닌 문제를 pix2pix에서 다루고 CycleGAN은 유사성이 없는 이미지를 학습하되 순환 일관성 손실 함수를 추가했다. 아래 [그림 3]은 Paired 이미지와 Unpaired 이미지의 차이점을 보여준다.

![](/img/medium/1-6MuaLU_dLt9LEZqUKF2YAA-5b9541e36fe7.png "[그림 3] Paired vs Unpaired Training Dataset")


Paired 데이터 셋에는 추상적이긴 하지만 x좌표값이 y좌표값에 어떻게 대응되는지 정보가 담겨져 있다. 반면 Unpaired 데이터 셋은 x좌표값과 y좌표값 사이에 대응되는 정보가 존재하지 않는다. 이미지 생성 모델에 대해서는 StyleTransfer, GAN, Condition GAN, BiGAN, CoGAN등 많은 방법론이 존재한다. CycleGAN이 다른 생성 모델과 다른 점은 Unpaired 데이터 셋을 학습한다는 것 그리고 순환 일관성 손실 함수(Cycle Consistency Loss Function)를 사용한다는 것이다. 이 방법론에서는 총 4개의 딥러닝 모델이 학습을 진행한다.

## 순환 일관성 손실 함수

![](/img/medium/1-YOhXT4gecyVgpMQHsrIvsw-1fe59a30f508.png "[그림 4] CycleGAN 아키텍처 개요")


GAN의 min-max 게임은 생성모델(G)이 생성한 이미지를 판별모델(D)이 진짜인지 가짜인지 여부를 찾는 방법으로 동작한다. 이 때 모델을 함수 G, D로 하고 G함수에서생성한 데이터를 X -\> Y맵핑으로 본다면 G(X)가 얼마나 Y와 가까운지 L1 Loss를 이용해서 계산한다. CycleGAN에서는 G(X)=Y에서 Y값을 다시 X로 복원하는 F(Y)=X 생성 모델과 이 값을 판별한 판별기 하나를 더 추가해서 총 4개의 딥러닝 네트워크를 사용한다. 이 때 X-\>Y, Y-\>X로 맵핑하는 것을 순환 일관성이라고 부른다. 이 아이디어는 언어 번역 등에서 사용되던 개념을 차용한 것이다. 위 [그림 4]를 보면 Dx, Dy, G, F 네 개의 함수가 등장한 것을 확인할 수 있다. 그리고 [그림 4]의 (b),(c)는 각각 X-\>Y, Y-\>X로 맵핑하는 동작 과정을 보여주며 X-\>Y는 forward consistency, Y-\>X는 backward consistency라고 부른다.

이 방법론과 StyleTransfer[4]가 다른점은 여러장의 이미지를 종합적으로 학습한다는 것이다. 클로드 모네의 단 하나의 작품이 아닌 한 작가의 화풍을 묘사하고자 여러장의 이미지를 학습할 때는 CycleGAN을 이용한다. 아래 [그림 5]는 순환 일관성 손실 함수의 수학적 정의이다. G(x)로 나온 y값을 다시 F(y)를 통해 원본 이미지로 복원하고 마찬가지로 F(y)로 나온 x값을 다시 G(x)를 통해 y로 복원한다. 이 원리를 이용해서 [그림 6]과 같이 전체 손실 함수를 정의한다. 빨간색 밑줄로 나타낸 람다값은 순환 일관성 손실의 영향력 정도를 결정하는 하이퍼파라미터이다.

![](/img/medium/1-U0rHnafonZ7H3GMb_wuLyw-1edcb670b042.png "[그림 5] 순환 일관성 손실 함수 (Cycle Consistency Loss)")


![](/img/medium/1-3NhlseVlCbvuf9Vg3rXKCQ-05e960537b86.png "[그림 6] CycleGAN의 전체 손실 함수")


## 어디에 쓸 수 있을까?

국내 지도앱을 쓰면서 여기서 쓰이는 이미지는 컴퓨터가 생성한 걸까 아니면 사람이 직접 그린걸까? 궁금했던 적이 있었다. 이 논문에서는 CycleGAN에서 위성 사진을 지도로 그리고 지도를 위성 사진으로 변환하는 것을 제안된 모델을 이용해서 생성한 결과를 보여준다.

![](/img/medium/1-mo7xlhBW74JL9_HZ_vtwhA-6cdaa3c6e4ab.png "[그림 7] Map <-> Photo 이미지 변환 예시")


이 뿐만 아니라 말을 얼룩말로, 계절, 화풍 등을 변환할 수 있다. 아래 [그림 8]은 사용된 두 개의 생성 모델을 이용해서 이미지를 변환한 결과이다. 결과를 보면 클로드 모네의 작품을 사진으로 복원하기도 하고 사진을 클로드 모네의 작품으로 변환하기도 한다. forward consistency, backward consistency를 위해 생성 모델을 두 개를 생성 했으니 양방향으로 변환이 가능하다. 이 외에도 자율주행 분야에서 실사 이미지를 식별이 쉬운 그림으로 변환하는데에 적용할 수도 있다.

![](/img/medium/1-_cMIohqpawh4oDpqdA2gyA-4f0376bebc0e.png "[그림 8] 작품, 객체, 배경 변환 예시")


## 실험 및 한계점

많은 생성 모델 논문의 실험처럼 AMT(Amazon Mechanical Turk)와 FCN Score를 이용해 실험을 진행했다. 전자는 설문조사 방식이고 후자는 YOLO와 같이 객체 탐지 모델을 사용해서 변환된 이미지에서 사물을 얼마나 잘 인지하는지를 이용한다. AMT는 사람의 손을 타는 반면 후자의 실험방식은 자동화된 모델을 이용하기 때문에 혼자서도 쉽게 사용할 수 있다. 아래 [그림 9]를 보면 모두 CycleGAN에서 좋은 결과를 보여준다는 것을 알 수 있다.

![](/img/medium/1-GxDIwGavlkE-mIXAEyWdlw-df1894614ba5.png "[그림 9] AMT와 FCN Score")


CycleGAN이 모두 좋은 성능을 보여준 것은 아니다. CycleGAN은 사진의 낮을 밤으로 바꾸는 등의 색상이나 질감은 잘 적용하지만 객체의 모양 자체를 바꿀수는 없다. 아래 [그림 10]을 보면 사과를 오렌지로 바꾸거나 강아지를 고양이로 바꾸는 작업에 대해서는 원하는 결과가 나오지 않는다는 것을 알 수 있다. 생성 모델 자체가 여러 장의 데이터를 학습해서 분위기만 바꾸는 데에 초점을 맞추기 때문이다. 또한 학습에 이용된 데이터 셋 자체의 분포가 불균형하기 때문에 발생하는 문제도 있다. 이미지넷에 제공된 데이터에는 말을 타고 있는 사람의 이미지는 존재하지 않기 때문에 사람과 말을 구분하지 못하고 사람도 얼룩으로 만들었다.

![](/img/medium/1-VFCH5rhLQH6IhjHLidDXkQ-ec10495f6c70.png "[그림 10] CycleGAN의 실패 케이스")


### 레퍼런스

[1] [Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://ieeexplore.ieee.org/document/8237506)\
[2] [Jun-Yan Zhu’s Homepage](https://www.cs.cmu.edu/~junyanz/)\
[3] [Image-to-Image Translation with Conditional Adversarial Networks, CVPR 2017](https://arxiv.org/abs/1611.07004)\
[4] [내가 찍은 사진을 명화처럼 만들어준다?](https://medium.com/curg/a-neural-algorithm-of-artistic-style-3c7e98644ca2)
