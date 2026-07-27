---
title: "You Only Look Once — 다.. 단지 한 번만 보았을 뿐이라구!"
date: "2020-05-01T22:00:26.391Z"
slug: "you-only-look-once-다-단지-한-번만-보았을-뿐이라구-bddc8e6238e2"
description: "이번 포스팅에서는 객체 탐지(Object Detection)분야에서 많이 알려진 논문인 “You Only Look Once: Unified, Real-Time Object Detection (2016)”을 다룬다[1]. 줄여서 흔히 YOLO라고…"
tags: []
---

이번 포스팅에서는 객체 탐지(Object Detection)분야에서 많이 알려진 논문인 “You Only Look Once: Unified, Real-Time Object Detection (2016)”을 다룬다[1]. 줄여서 흔히 YOLO라고 부른다. 객체 탐지란 이미지가 주어지면 배경과 사물을 구분하고 어떤 사물인지 인지하는 것을 말한다. 아래 그림은 실제로 YOLO 모델을 통해 이미지에서 사물을 구분한 결과를 보여준다.

![](/img/medium/1-Rjm0QjZf2bckAS9E_BXubg-a106d693b651.png "[그림 1] YOLO v1을 이용하여 실제로 사물과 그림 안의 물체를 분류한 결과")


YOLO가 등장하기 이전에도 딥러닝 모델을 이용하여 객체 탐지를 수행하는 방법은 있었다. 대표적으로 DPM과 R-CNN이 존재하는데 YOLO는 기존 모델들 보다 더 높은 정확도를 추구하는 것이 아닌, 근접한 정확도를 가지면서 더 많은 양의 이미지를 처리할 수 있는 실시간 객체 탐지를 하고자 등장했다. YOLO는 2016년 처음 등장한 이후 업데이트 된 논문만 3편이 더 출시되어 YOLO라는 이름이 붙은 논문만 총 4편이 존재한다. 논문 제목은 각각 다르지만 보통 편의상 버전명을 붙여서 YOLOv\<버전명\>으로 부른다.

이번 포스팅에서는 YOLO v1의 논문 내용에 한정하여 YOLO의 심층신경망이 어떻게 객체를 탐지하는지 설명하는데 집중한다. 본격적인 내용을 시작하기에 앞서 본 글의 구성은 1장에서는 그동안 YOLO의 연구를 이끈 Joe Redmon에 대해 소개하고, 2장에서는 YOLO가 어떻게 동작하는지 설명한다. 이어서 3장에서는 YOLOv1부터 v3까지의 내용을 비교해본다. 마지막으로 결론과 다음 포스팅 주제에 대해 서술하고 마친다.

## 구성

- 조셉 레드몬, 비전 컴퓨팅 연구를 그만두다.
- You Only Look Once
- YOLO v1, YOLO v2, YOLO v3
- 결론

## 조셉 레드몬, 비전 컴퓨팅 연구를 그만두다.

조셉 레드몬은 워싱턴 대학교 산하의 PLSE 연구실(실제로는 그룹에 더 가까운 커뮤니티)에서 연구하고 있고 C기반의 DarkNet 프레임워크를 개발한 것으로 유명하다. 아마 YOLO가 속도를 추구하는 만큼 파이썬 기반의 프레임워크가 아닌 C로 작성하여 구현한 듯하다. 그는 2016년에는 YOLO v1을, 2017년에는 YOLO v2[2]를 발표하고 2018에는 개선한 버전인 YOLO v3[3]를 차례로 공개하였다. 이렇게 활발한 연구활동을 하던 그가 2020년 2월 21일, 더 이상 비전 컴퓨팅 연구를 하지 않겠다라고 선언했다[4].

![](/img/medium/1-8w8oh1BlcHscmQI-Quio4Q-8556f56e4c30.png "[그림 2] 조셉 레드몬의 2020년 2월 21일 트위터")


조셉 레드몬이 지금까지 진행한 연구가 공익적 목적보다는 군사적, 개인정보 침해로 활용될 가능성이 커서 잠정적으로 연구를 중단한다고 한다. 인공지능의 발전이 인류에 위협이 될 수 있다는 우려는 꾸준히 제기 되었다. 누군가는 “인공지능의 위협을 막는 방법은 다른 연구자가 발견할 것이기 때문에 우리는 걱정하지 않아도 된다.” 라고 했지만 조셉 레드몬은 그렇게 생각하지 않았다.

## You Only Look Once

앞서 YOLO는 빠르게 이미지에서 객체를 탐지하는 모델이라고 설명했다. 이 논문을 요약해서 설명하면 세 가지 특징으로 정리할 수 있는데 이 모든게 논문 제목에서 모두 나타난다.

- <strong>You Only Look Once: 이미지 전체를 단 한번만 본다.</strong>\
  딥러닝 모델을 객체 탐지에 쓰인 모델은 YOLO 이전에 R-CNN 모델 등이 존재했다. 대표적으로 R-CNN과 비교하자면 R-CNN은 이미지에서 일정한 규칙으로 이미지를 여러장 쪼개서 CNN모델을 통과시키기 때문에 한 장의 이미지에서 객체 탐지를 수행해도 실제로는 수 천장의 이미지를 모델에 통과시킨다. 반면, YOLO는 이미지 전체를 말 그대로 단 한번만 본다.
- <strong>Unified: 통합된 모델을 사용한다.</strong>\
  다른 객체 탐지 모델 들은 다양한 전처리 모델과 인공 신경망을 결합해서 사용하지만, YOLO는 단 하나의 인공신경망에서 이를 전부 처리한다. 이런 특징 때문에 YOLO가 다른 모델보다 간단해 보인다.
- <strong>Real-time Object Detection: 실시간 객체 탐지</strong>\
  이 특징이 오늘 날 YOLO를 유명하게 만들었다. YOLO가 높은 성능으로 객체를 탐지하는 모델은 아니지만, 실시간으로 여러장의 이미지를 탐지할 수 있다. “빠르다”는 이름이 붙은 Fast R-CNN이 0.5 FPS(초당 프레임 수)의 성능을 가진 반면에 YOLO는 45 FPS의 성능을 가진다. 이는 영상을 스트리밍 하면서 동시에 화면 상의 물체를 부드럽게 구분할 수 있을 정도다.

### Region-based CNN(R-CNN) 시스템 모델

재차 설명하지만 YOLO는 빠르게 이미지를 탐지하는 것을 목표로 한다. 그 말은 학습 과정보다는 테스트 과정을 더 중요하게 본다는 뜻이다. 그렇기 때문에 다른 연구와 비교하여 볼 때도 학습 과정보다는 이미지가 주어졌을 때 이를 분류하는 테스트 과정을 보아야 한다. YOLO의 시스템 모델과 관련 연구의 차이를 이해하기 위해 R-CNN 모델의 테스트 과정을 대략적으로 살펴보자[4].

![](/img/medium/1-3YYd-HAwZnB6-u1npprr_A-8abcad1be137.png "[그림 3] R-CNN의 시스템 모델")


CNN 기반 모델이 이미지가 주어졌을 때 자동차인지, 비행기인지 분류하는데 높은 정확도를 보여주는 것은 많이 알려져 있다. R-CNN은 이 특징을 이용한다. 먼저 이미지가 주어졌을 때 선택적 탐색(Selective Search)알고리즘을 이용해 2000개의 리전을 생성하여 서브-이미지를 추출한다.

추출한 서브-이미지들은 매우 큰 합성곱 신경망(CNN)을 통과하여 특징을 추출하고 추출된 특징은 서포트 벡터 머신(SVM)을 통해 각 리전별로 클래스를 분류한다. R-CNN은 입력값으로 주어지는 건 이미지 하나이지만 CNN을 통과하는 건 2000개의 서브-이미지이다. 즉, 하나의 이미지를 2000번이나 본다.

### YOLO 시스템 모델

![](/img/medium/1-1TI6X-vN0WEmZxKXaFH8NA-ce8c0419bda1.png "[그림 4] YOLO 시스템 모델")


위 그림은 대략적인 구조를 나타내긴 하지만, 중요한 점은 YOLO의 감지 시스템은 R-CNN과는 달리 합성곱 신경망을 단 한 번 통과시킨다. 신경망의 결과로는 각 객체의 바운딩 박스와 해당 객체가 무엇인지 분류 확률을 출력한다. 최종적으로는 이 값을 Non-max suppression을 통해 리전을 결정한다.

이제 YOLO 모델을 구성하는 각 컴포넌트를 설명하기 전에 몇가지 용어와 사실을 알고가면 좋다. 우선, YOLO는 지도학습이고 논문에서 사용한 PASCAL VOC 데이터 셋에는 물체에 대한 클래스 C와 위치 정보인 X, Y, WIDTH, HEIGHT가 트레이닝 셋으로 제공된다. 아래 그림은 학습 데이터로 제공된 이미지이다. 이 때 X, Y의 기준점은 좌측 위가 아닌 물체의 정중앙을 말한다.

![](/img/medium/1-_L_B8iP-P3Jm_kwLdj67Hw-b8188ef2e93f.png "[그림 5] PASCAL VOC(Visual Object Classes) 데이터 셋")


YOLO가 사용하고 있는 네트워크에 이미지를 통과하면 결과 값으로 SxS 그리드 셀의 클래스 정보 C와 예측된 바운딩 박스 B와 Confidence Score가 주어진다. 본 논문에서는 그리드 셀의 개수를 7개로, 각 셀마다 생성하는 바운딩 박스는 2개, 20개의 클래스를 탐지하는 모델을 테스트 했다. [그림 6]은 YOLO 네트워크의 결과를 보여준다.

![](/img/medium/1-9gnDERhMNGk2Z9FNnNyOaA-a68f5908647d.png "[그림 6] 이미지가 YOLO Model을 통과한 결과")


본 논문에서 제시하는 시스템은 이미지를 7 x 7 (S x S)의 그리드 셀로 나눈다. 이렇게 나눈 그리드 셀 중 물체의 중앙과 가장 가까운 셀이 객체를 탐지하는 역할을 한다. [그림 6]을 보면 7 x 7의 셀로 이미지가 나누어진 것을 알 수 있다. 각 셀은 <strong>바운딩 박스 B</strong>와 분류한 <strong>클래스의 확률인 C</strong>를 예측한다.

<strong>바운딩 박스</strong>부터 설명하자면, 바운딩 박스 B는 X, Y 좌표, 가로, 세로 크기 정보와 Confidence Score (Score)수치를 가지고 있다. Score는 B가 물체를 영역으로 잡고 있는지와 클래스를 잘 예측하였는지를 나타낸다. 본 논문에서는 Score를 간단하게 $\Pr(\mathrm{Object}) \cdot \operatorname{IOU}$로 정의하고 있는데, $\Pr(\mathrm{Object})$는 바운딩 박스 안에 물체가 존재할 확률이다. 만약 바운딩 박스가 배경만을 영역으로 잡고 있다면 Pr(Object)의 값이 0이므로 Score는 0이된다. IOU는 Intersection over Union의 약자로 학습 데이터의 바운딩 박스와 예측한 바운딩 박스가 일치하는 정도를 나타낸다. 아래 그림은 IOU를 계산하는 방법을 보여준다[5].

![](/img/medium/1-mNLT8UOfha5-Qvhk7OLhpA-4bab0aba1c42.png "[그림 7] Intersection over Union")


<strong>클래스 확률 C</strong>는 그리드 셀 안에 있는 그림의 분류 확률을 나타낸다. 기호로는 $\Pr(\mathrm{Class}_i \mid \mathrm{Object})$로 표현하며 B가 배경이 아닌 객체를 포함하는 경우의 각 클래스의 조건부 확률이다. B가 배경을 예측했다면 확률은 0이 된다. 최종적으로 클래스 조건부 확률 C와 각 바운딩 박스의 Confidence 예측 값을 곱하면 각 박스의 클래스별 Confidence Score 수치를 구할 수 있다.

- $\Pr(\mathrm{Class}_i \mid \mathrm{Object}) \cdot \Pr(\mathrm{Object}) \cdot \operatorname{IOU} = \Pr(\mathrm{Class}_i) \cdot \operatorname{IOU}$

### 네트워크 디자인 — Network Design

![](/img/medium/1-Xn6RgHiav56W-vJm_5uhsw-49c8d469843c.png "[그림 8] YOLO의 학습 네트워크 설계")


지금부터 YOLO가 이미지를 학습하고, 예측하는데 이용하는 전체 네트워크 디자인과 손실 함수(Loss Function)을 간단히 소개하고자 한다. 위 [그림 8]은 YOLO의 전체 네트워크 구조를 보여준다. YOLO는 24개의 Convolutional Layer(Conv Layer)와 2개의 Fully-Connected Layer(FC Layer)로 연결된 구조를 사용하고 있다. 설명을 쉽게 하기 위해서 논문에서 제공한 그림에서 크게 Pre-trained Network, Training Network 그리고 Reduction Layer 영역을 그려서 구분하였고 지금부터 각 영역을 소개한다.

### Pre-trained Network
주황색 테두리로 표현한 부분은 GoogLeNet을 이용하여 ImageNet 1000-class dataset을 사전에 학습한 결과를 Fine-Tuning한 네트워크를 말한다.이 네트워크는 20개의 Conv Layer로 구성되어 있다. 본 논문에서는 이 모델에서 88%의 정확도를 사전에 학습했다고 한다. 본래 ImageNet의 데이터 셋은 224x224의 크기를 가진 이미지 데이터이지만, 어째서인지 객체 감지를 학습할 때는 선명한 이미지 보다는 경계선이 흐릿한 이미지가 더 학습이 잘된다고 해서 Scale Factor를 2로 설정하여 이미지를 키워 448 x 448 x 3의 이미지를 입력 데이터로 받는다.

### Reduction Layer
보통 네트워크는 깊을 수록 더 많은 특징을 학습하기 때문에 정확도가 높아지는 경향이 있다. 하지만 Conv Layer를 통과할 때 사용하는 Filter 연산이 수행시간을 많이 잡아 먹기 때문에 무작정 네트워크를 깊게 쌓기에는 부담이 된다. 이 문제를 해결하기 위해 ResNet, GoogLeNet 등의 기법이 제안되었는데 [그림 8]에 오렌지 색 테두리로 된 영역에서는 GoogLeNet의 기법을 응용 하여 연산량은 감소하면서 층은 깊게 쌓는 방식을 이용하였다.

### Training Network
[그림 8]에 파란색 영역인 Training Network는 Pre-trained Network에서 학습한 feature를 이용하여 Class probability와 Bounding box를 학습하고 예측하는 네트워크이다. 우리가 이전에 YOLO의 예측 모델은 $S \times S \times (B \cdot 5 + C)$ 개의 파라미터를 결과로 출력한다고 이야기 했다. PASCAL VOC 데이터 셋은 20개 클래스를 제공하기 때문에 C의 값은 20이다. 그리드 셀은 7개로 정의 하였으므로 모두 계산하면 총 결과값은 1470개의 값이 출력된다.

### 손실 함수 — Loss Function

YOLO는 마지막 Training Network를 학습하기 위해 손실 함수를 설계하기 전에 몇 가지 원칙을 만들었다.

1.  이미지를 분류하는 classifier 문제를 바운딩 박스를 만드는 regression문제로 생각한다.
2.  바운딩 박스를 잘 그렸는지 평가하는 Localization Error와 박스 안의 물체를 잘 분류했는지 평가하는 Classification Error의 패널티를 다르게 평가한다. 특히, 박스 안의 물체가 없는 경우에는 Confidence Score를 0으로 만들기 위해 Localization Error 에 더 높은 패널티를 부과한다.
3.  많은 바운딩 박스중에 IOU 수치가 가장 높게 생성된 바운딩 박스만 학습에 참여한다. 이는 바운딩 박스를 잘 만드는 셀은 더욱 학습을 잘하도록 높은 Confidence Score를 주고 나머지 셀은 바운딩 박스를 잘 만들지 못하더라도 나중에 Non-max suppression을 통해 최적화 하기 위함이다[6].

YOLO는 1번 원칙을 지키기 위해 Loss Function 에서 Sum-Squared Error(SSD)를 이용한다. 그리고 2번 원칙을 만족하기 위해서 $\lambda_{coord}$와 $\lambda_{noobj}$ 두 개의 변수를 이용한다. 본 논문에서는 $\lambda_{coord}$ = 5, $\lambda_{noobj}$ = 0.5로 설정하였다. 아래 [그림 9]는 YOLO의 Loss Function을 보여준다.

![](/img/medium/1-tET4LVYKpTiM7m6ITv15zA-2aec5f8a6465.png "[그림 9] YOLO Training Network의 Loss Function")


위 Loss Function에서 각 기호가 나타내는 의미는 아래와 같다.

- S : 그리드 셀의 크기를 의미한다. 행렬 이기 때문에 전체 그리드 셀의 개수는 S² 가 된다.
- B : S_i 셀의 바운딩 박스를 의미한다.
- x, y, w, h : 바운딩 박스의 좌표 및 크기를 의미한다.
- C : 각 그리드 셀이 구분한 클래스와 같다.
- 주황색 1번 기호 : 5로 설정된 $\lambda_{coord}$ 변수로서 Localization 에러에 5배 더 높은 패널티를 부여하기 위해서 사용한다. 예로 보면 5번 테두리에서 분류에 따른 오차는 가중치가 존재하지 않는 반면에 바운딩 박스의 에러에는 5배 더 높은 패널티가 부여되어 있다.
- 연두색 2번 기호 : 처음 보는 기호라 조금 당황스러웠는데, if문과 동일한 역할을 한다. i번째 셀의 j번 바운딩 박스만을 학습하겠다는 의미로 사용하지만 모든 셀에 대해서 바운딩 박스 학습이 일어나지 않고 각 객체마다 IOU가 가장 높은 바운딩 박스인 경우에만 패널티를 부과해서 학습을 더 잘하도록 유도한다.
- 파란색 3번 기호 : 해당 셀에 객체가 존재하지 않는 경우, 즉 배경인 경우에는 바운딩 박스 학습에 영향을 미치지 않도록 0.5의 가중치를 곱해주어서 패널티를 낮춘다.
- 노란색 4번 기호 : 2번 기호와는 반대의 경우로 i번째 셀과 j번째 바운딩 박스에 객체가 없는 경우에 수행 한다는 의미이다.
- 남색 6번 기호 : 바운딩 박스와는 상관 없이 각 셀마다 클래스를 분류하기 위한 오차이다.

위 Loss Function을 이용해서 네트워크를 학습한 뒤, 예측을 하면 각 셀마다 여러 장의 바운딩 박스가 생기게 된다. 그 중 물체의 중심에 있는 셀이 보통 Loss Function의 연두색 2번 기호에 해당하기 때문에 물체의 중심을 중심으로 그려진 바운딩 박스는 Confidence Score가 더 높게 나오고, 물체의 중심으로 부터 먼 셀이 만드는 바운딩 박스는 Score가 작게 나오게 된다. 그리고 최종적으로 여러 개의 바운딩 박스를 합치는 Non-max suppression 과정을 거쳐 이미지의 객체를 탐지할 수 있게 된다.

![](/img/medium/1-947T5c0fggxuGkeAlEZEKw-4a32b76feac5.png "[그림 10] Non-max suppression가 수행되기 전과 수행된 후")


### 성능 — Performance

YOLO의 논문에서는 객체 탐지를 수행하는 모델인 DPM, R-CNN, Fast R-CNN, Faster R-CNN과 YOLO 원래 네트워크에서 설계를 간소화 해서 사용하여 정확도를 포기하고 성능을 높인 Fast-YOLO 등의 모델의 정확도(mAP)와 초당 프레임 수(FPS)를 비교하였다. 여기서 mAP는 mean Average Precision의 약자로 객체 탐지 분야에서 성능을 평가하기 위해 사용하는 수치이다. [그림 11]은 PASCAL VOC 2007의 데이터 셋을 학습하여 mAP와 FPS를 나타낸 수치이다.

![](/img/medium/1-iIyKYjpuZ1Q19M10YiCNeg-4c12dc930b7a.png "[그림 11] YOLO 모델의 퍼포먼스")


위 표를 보면 YOLO는 63.4 mAP를 가지며 초당 45장의 이미지를 처리 할 수 있다. 그리고 네트워크를 경량화 하여 개발한 Fast YOLO는 정확도는 조금 포기했지만 155 FPS의 성능을 보여준다. YOLO가 가장 정확도가 높은 모델은 아니지만 이 논문이 작성될 당시에는 가장 빠른 처리속도를 가진 모델이고 영상에서도 프레임이 끊기지 않고 부드럽게 객체를 탐지할 수 있다. 표를 보는 것보다 아래 영상을 통해 직접 느껴보는 것을 추천한다.

[https://www.youtube.com/watch?v=MPU2HistivI&t=76s](https://www.youtube.com/watch?v=MPU2HistivI&t=76s)

## YOLO v1, YOLO v2, YOLO v3

지금까지 YOLO v1에 대한 기본적인 개념을 소개했다. YOLO는 2016년에 처음 발표된 이후 v4 버전까지 공개되었는데 v4는 저자가 다르므로 우리는 조셉 레드몬이 작성한 v1~v3 버전의 YOLO가 어떤 차이점이 있는지 대략적으로 정리하고 넘어가고자 한다.

## YOLO v2

YOLO v2는 2017년 CVPR 컨퍼런스에서 “YOLO9000: Better, Faster, Stronger”라는 이름으로 논문이 발표되었다. YOLO v1이 20개의 이미지를 분류하는 모델을 소개했다면 v2는 논문 제목 그대로 무려 9000개의 이미지를 탐지하면서 분류할 수 있는 모델을 개발하였다. 또한 Batch Normalization, Direct Location Prediction, Multi-Scale Training기법을 도입해서 FPS와 mAP를 높였다. 이 때 논문이 발표될 당시만 하더라도 YOLO v2는 가장 빠르면서 정확한 모델이었다.

## YOLO v3

YOLO v3는 v2버전을 더욱 개량한 것이다. 현재는 거의 모든 영역에서 사용되는 ResNet의 Residual Block이 v2버전에서는 존재하지 않았다. 그래서 레이어 신경망 층이 최근에 나온 연구보다는 상대적으로 얇았는데, v3에서는 이 기법을 사용해서 106개의 신경망 층을 구성하였다.

## YOLO v1의 한계점

결론 파트에서는 논문에서 소개된 YOLOv1의 한계점에 대해서 서술하자면, YOLO의 접근법은 객체 탐지 모델의 FPS를 높였지만 너무나도 작은 물체에 대해서는 탐지가 잘 되지 않는다는 단점이 있다. 그 이유는 Loss Function에서 바운딩 박스 후보군을 선정할 때 사물이 큰 객체는 바운딩 박스간의 IOU의 값이 크게 차이나기 때문에 적절한 후보군을 선택할 수 있는 반면, 작은 사물에 대해서는 약간의 차이가 IOU의 결과값을 뒤짚을 수 있기 때문이라고 진단하였다. 이 문제는 YOLO의 후속 버전에서 어느 정도 개선되었다.

그리고 YOLO가 데이터를 제공받고 바운딩 박스를 학습하기 때문에 사물이란 무엇인지, 그리고 이상한 비율로 되어있는 물체라던지, 일반화된 지식이 있어야 구별할 수 있는 학습은 하지 못한다는 점이 있다.

## 결론

이번 포스팅에서는 YOLO v1에 대해서 간단하게 소개했었다. YOLO 자체가 다른 모델보다 뛰어난 속도를 보여주기 위해 탄생한 만큼 여러 객체 탐지 모델의 접근법을 정리해보고 속도를 비교해보는게 더 의미있는 포스팅이라는 생각은 들지만, 객체 탐지 분야의 논문을 읽는게 처음인 만큼 이번에는 YOLO가 객체 탐지를 어떻게 하고 있는지에 더 초점을 맞추어서 작성하였다.

다음 포스팅 주제는 YOLO v2와 YOLO v3에서 개선된 부분을 다루어 보고, 객체 탐지 분야에서 자주 쓰이는 Selective Search, Non-max suppression 알고리즘을 정리하여 소개해보려고 한다.

## Reference

- [[1] You Only Look Once: Unified, Real-Time Object Detection](https://arxiv.org/abs/1506.02640), 2016
- [[2] YOLO9000: Better, Faster, Stronger](https://arxiv.org/abs/1612.08242), 2017
- [[3] YOLOv3: An Incremental Improvement](https://pjreddie.com/media/files/papers/YOLOv3.pdf), 2018
- [[4] Rich feature hierarchies for accurate object detection and semantic segmentation](https://arxiv.org/abs/1311.2524), 2013
- [[5] Abnormal Water Quality Monitoring Based on Visual Sensing of Three-Dimensional Motion Behavior of Fish](https://www.researchgate.net/publication/335876570_Abnormal_Water_Quality_Monitoring_Based_on_Visual_Sensing_of_Three-Dimensional_Motion_Behavior_of_Fish)
- [[6] Non-max suppression](https://towardsdatascience.com/non-maximum-suppression-nms-93ce178e177c)
