---
title: "3D Gaussian Splatting 대충이라도 이해해보기"
date: "2025-01-04T10:07:55.897Z"
slug: "3d-gaussian-splatting이-게임-개발의-패러다임을-바꿀-수-있을까-bf7bc66d7ae4"
description: "2023년 8월, 컴퓨터 그래픽스 최대 학회인 SIGGRAPH에서 발표된 하나의 논문이 학계에서 굉장히 많은 관심을 받고 있습니다."
tags: []
---

### 3D GS가 게임 개발의 새로운 패러다임이 될 수 있을까

2023년 8월, 컴퓨터 그래픽스 최대 학회인 SIGGRAPH에서 발표된 하나의 논문이 학계에서 굉장히 많은 관심을 받고 있습니다.

![](/img/medium/1-KZ7qEQjJErplS2aAy5QITw-8c694eeb47cc.png)

[3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079)

이 논문에서 풀고자 하는 문제는 이미지 데이터를 3D 물체 혹은 공간으로 재구성 하는 겁니다.

<div class="video-embed"><iframe src="https://www.youtube.com/embed/oeJbalGBVzw?feature=oembed" title="Embedded media" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>

Gaussian Splatting 데모 영상

이미지로부터 3D를 복원하는 문제는 오래전부터 연구되어온 분야입니다. 대표적으로 다양한 각도에서 촬영된 이미지로 Point Cloud를 복원하는 <strong>SfM(Structure from Moiton)</strong>은 이스라엘 바이츠만 과학 연구소의 [Shimon Ullman](https://en.wikipedia.org/wiki/Shimon_Ullman)교수님이 이미 1979년도에 발표했습니다.

2010년도 부터 딥러닝 기반의 AI가 급속도로 발전하기 시작했고, 2020년에는 UC 버클리에서 3D공간을 딥러닝 모델로 해석하는 [NeRF(Neural Radiance Field)](https://www.matthewtancik.com/nerf)가 등장합니다.

![](/img/medium/1-svRJgJ2vLfi662mVMmntIw-39fc6c8e0c17.png)

[NeRF의 구조도](https://www.matthewtancik.com/nerf)

NeRF는 지금까지 Google Research를 비롯한 많은 곳에서 적극적으로 연구하기 시작하면서 발전해왔는데요. 그러던 중 2023년 8월에 Gaussian Splatting이 SIGGRAPH에 발표되면서 그동안 NeRF가 주도해온 연구 패러다임을 한 번 깨고 이제는 거의 양분하는 것 처럼 보입니다.

Gaussian Splatting을 특히 주목할 만한 건 <strong>① 이 친구는 딥러닝 모델이 아니라는 점</strong>과 <strong>② NeRF에 비해 연산 효율이 좋아서 고해상도(1080p)로 높은 FPS로 실시간 렌더링이 가능하다는 점</strong>입니다. 이번 글에서는 Gaussian Splatting에 대해 알아보고 이것이 게임 개발의 패러다임을 어떻게 바꾸게 될지 상상해보는 시간을 가져보겠습니다.

![](/img/medium/1-KrqP65f7yxWo0eHI4B9VyA-0e22f1f2d587.png)

[Evaluation of Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)

> <strong>Disclaimer</strong>
> 우선 저는 그래픽스 전문가가 아니기 때문에 설명이 부족한 부분이 많습니다. 이 글은 저와 같이 그래픽스 관련 개념이 생소하신 분들이 3D GS를 입문할 때 보시기에 적당할 거라고 기대하고 있습니다.

### INDEX

- NeRF (Neural Radiance Field)
- 3D Gaussian Splatting
- Rasterization
- Optimization
- Evaluation
- Mesh로 변환해서 이용하기
- 레퍼런스

## NeRF (Neural Radiance Field)

NeRF는 다양한 각도에서 촬영한 이미지를 학습해서 3D 공간 정보를 가지고 있는 신경망을 말합니다. 네트워크 자체는 간단한 Fully-connected Network로 구성되어 있으며 <strong>3D 공간의 위치 좌표(x, y, z)</strong>와 <strong>카메라가 사물을 바라보는 각도</strong>가 입력으로 주어지고 출력으로는 해당 점의 색상을 반환합니다.

![](/img/medium/1-E9GnILb77xHaAilz5IchvQ-4602e636c051.png)

NeRF 학습 구조도 [1]

위 그림은 논문에 삽입된 그림으로 NeRF의 동작을 잘 보여주고 있습니다. 카메라에서 Ray를 보내 3D의 위치에 대한 색상을 얻어서 Volume Rendering 기법으로 최종적으로 2D 화면에 투영될 색상을 결정합니다.

잘 생각해보면 <strong>1920 x 1080 크기</strong>의 이미지는 대략 200만개의 픽셀 정보를 가지고 있습니다. 게다가 Ray가 지나가면서 공간 좌표에 대해 추론(Inference)해야 하기 때문에 렌더링 과정이 비효율적이라는 단점이 있습니다.

[<strong>AI와 게임 개발 / 3D 생성 모델 연구 맛보기</strong>\
*NeRF에서 DreamFusion 까지*medium.com](https://medium.com/rate-labs/%ED%8F%89%EB%B2%94%ED%95%9C-%EC%84%9C%EB%B2%84-%EA%B0%9C%EB%B0%9C%EC%9E%90%EC%9D%98-3d-%EC%83%9D%EC%84%B1-%EB%AA%A8%EB%8D%B8-%EC%97%B0%EA%B5%AC-%EB%A7%9B%EB%B3%B4%EA%B8%B0-dream-fusion-by-google-11c3370920ae "https://medium.com/rate-labs/%ED%8F%89%EB%B2%94%ED%95%9C-%EC%84%9C%EB%B2%84-%EA%B0%9C%EB%B0%9C%EC%9E%90%EC%9D%98-3d-%EC%83%9D%EC%84%B1-%EB%AA%A8%EB%8D%B8-%EC%97%B0%EA%B5%AC-%EB%A7%9B%EB%B3%B4%EA%B8%B0-dream-fusion-by-google-11c3370920ae")[](https://medium.com/rate-labs/%ED%8F%89%EB%B2%94%ED%95%9C-%EC%84%9C%EB%B2%84-%EA%B0%9C%EB%B0%9C%EC%9E%90%EC%9D%98-3d-%EC%83%9D%EC%84%B1-%EB%AA%A8%EB%8D%B8-%EC%97%B0%EA%B5%AC-%EB%A7%9B%EB%B3%B4%EA%B8%B0-dream-fusion-by-google-11c3370920ae)

## 3D Gaussian Splatting

게임을 좋아하시는 분들은 3D 그래픽을 폴리곤으로 이루어진 Mesh로 표현한다는 사실을 아실겁니다. 3D 데이터를 표현하는 방법 중에 3차원 공간 전체를 점들의 집합으로 표현하는 <strong>포인트 클라우드(Point Cloud)</strong>가 있습니다. 이는 자율주행차의 눈 역할을 하는 라이다(LiDAR) 센서가 세상을 인식하는 방식이기도 합니다.

![](/img/medium/1-DhyvTuotg-GoK1gDWmPMDg-b01cbd8fff36.png)

출처 : [https://ouster.com/downloads/sample-lidar-data](https://ouster.com/downloads/sample-lidar-data)

이미지로부터 포인트 클라우드와 실제 카메라의 위치를 계산하는 방법은 오래전부터 연구되어 왔습니다. OpenMVG[2] 오픈소스를 이용하면 이 과정을 쉽게 구현할 수 있습니다. 하지만 포인트 클라우드는 공간 표현이 불연속적이며, 엘리어싱 및 holes를 만드는 문제가 있습니다.

<strong>3D GS(Gaussian Splatting)</strong>은 포인트 클라우드를 확장한 개념으로 각 좌표에 존재하는 포인트는 점이 아닌 3차원 가우시안 분포를 가집니다.

![](/img/medium/1-mkRwZp3r5wNQKxl1wD6krA-97ab61cb7c62.png)

source: [(1)](https://en.wikipedia.org/wiki/Gaussian_function), [(2)](https://math.stackexchange.com/questions/2580887/is-there-any-graphical-explanation-of-multivariate-gaussian), [(3)](https://www.researchgate.net/figure/sualization-of-a-3D-Gaussian-model-a-Uncertainty-ellipsoid-for_fig5_231212225), 아이디어 출처 : [xoft 블로그](https://xoft.tistory.com/49)

그리고 포인트 클라우드 처럼 여러 좌표에 값을 가지고 있기 때문에 아래 그림과 닮은 데이터를 얻게 됩니다.

![](/img/medium/1-URxFwtUHiz8YCK_NZXypRA-ba6733cc2d77.png)

3차원 공간에 3개의 3D Gaussian이 존재하고 있다.

3D GS 내용을 본격적으로 탐구하기 전에 이렇게 표현된 결과물이 렌더링된 결과를 보겠습니다. 아래 그림은 <strong>2024년 게임 개발자 컨퍼런스(GDC)</strong>에서 사진으로 사물을 스캔하는 앱인 [KIRI Engine](https://apps.apple.com/us/app/kiri-engine-3d-scanner-lidar/id1577127142) 개발사 발표의 한 장면입니다[3].

![](/img/medium/1-MMm2vZBCJUijvzUsjkGWVw-545708db04f2.png)

이 그림은 Mesh와 3D GS로 표현된 객체를 확대했을 때의 차이를 보여줍니다. Mesh는 폴리곤 면이 드러나는 반면, 3D GS는 타원체의 집합으로 나타납니다. 본 논문은 사진을 입력 데이터로 사용해 이러한 3차원 객체를 효과적으로 표현하는 타원체 집합을 찾는 것을 목표로 합니다.

처음에 3D GS는 딥러닝 방식이 아니라고 언급했습니다. 대신, <strong>경사 하강법(Gradient Descent)</strong>을 통해 파라미터를 최적화하여 사물을 잘 표현하는 가우시안을 얻습니다. 경사 하강법은 딥러닝 이전부터 존재했던 최적화 이론의 기법이므로 논문에서는 이 과정을 <strong>‘학습’</strong>이 아닌 <strong>‘최적화’</strong> 단계로 표현합니다

![](/img/medium/1-btuSw3GuCn7Y1wgdvUG_OQ-053d73c01103.png)

3D GS 전체 구조도 [4]

손실 함수를 정의하고, 오차를 미분하여 파라미터를 조정하는 방식은 딥러닝의 기본 원리와 유사하기 때문에 완전히 낯설지는 않으실 거라고 생각합니다.

카메라가 방향으로 보일 법한 이미지를 3D GS 과정을 거쳐서 만들고 이를 원본 이미지와 비교하는 손실 함수를 정의한 뒤 경사하강법으로 Loss가 최적화 되는 3D Gaussian을 찾습니다.

## Rasterization

### ① 가우시안 도형을 2차원으로 투영시키기
3차원 가우시안 정보는 (0, 0)을 원점으로 가지는 <strong>공분산 행렬 Σ</strong>로 표현합니다. 정규분포 *N*(*μ*, *σ²*)의 파라미터가 평균과 분산을 가지는데, 차원이 2개 이상인 가우시안 분포에서는 공분산으로 표현합니다.

```python
import numpy as np
import matplotlib.pyplot as plt
```
from scipy.stats import multivariate_normal\
\
```python
mean = np.array([0, 0, 0])
cov = np.array([[1, 0.5, 0.3],
```
[0.5, 2, 0.2],\
[0.3, 0.2, 1]])\
\
num_points = 1000\
points = np.random.multivariate_normal(mean, cov, num_points)\
pdf_values = multivariate_normal.pdf(points, mean=mean, cov=cov)\
\
...\
\
plt.show()

![](/img/medium/1-bLpt2sDCqmiSBEQ0rN6ATQ-05dd46dc670a.png)

### 공분산 행렬 Σ 로 시각화한 3차원 가우시안 데이터

우리는 이제 이 가우시안 정보로 2차원으로 투영시켜서 이미지로 만든다음 원본과 비교해서 손실 값을 계산해야 합니다.

![](/img/medium/1-ntFNnxJM_mSGGecXxypK_w-54de7a953279.png)

수식은 2001년에 발표된 <strong>EWA Volume Splatting[5]</strong> 논문에서 소개된 내용입니다. 3D GS 논문은 이를 사용했다고만 간단히 언급했습니다.

![](/img/medium/1-7S27cZJZIiTklH1rtYNkPg-68242ee1fcf7.png)

source : EWA Volume Splatting [5]

- <strong>W :</strong> (0,0)을 원점으로 가진 가우시안 분포를 카메라의 위치를 원점으로 하는 곳으로 선형변환 하는 행렬입니다.
- J : <strong>자코비안(Jacobian)</strong>행렬로 비선형 변환된 값을 국소적으로 선형 변환으로 근사하는 역할을 합니다. 자세한 내용은 공돌이의 [<strong>수학 정리 노트[6]</strong>](https://angeloyeo.github.io/2020/07/24/Jacobian.html#google_vignette)에 소개되어 있습니다.
- 마지막 W^T 및 J^T는 공분산 행렬의 Key Property중 하나로 결과값의 대칭성을 유지하는 역할을 합니다.

![](/img/medium/1-RkXfHpDj-AqClzkal6j48w-fae0dfa54b05.png)

Jacobian 행렬의 기하학적 의미

> Jacobian term이 붙은게정확히 어떤 의미를 가지는지는 제 역량이 부족해서 제대로 이해하지 못했습니다. 수식의 유도 과정은 [다음 글[7]](https://qiita.com/scomup/items/f8632151712828e9625d)에서 더 자세히 설명되어 있습니다.

이렇게 <strong>변환된 행렬 Σ’</strong> 에 대해 3번째 행과 열을 버린 <strong>2 x 2 행렬</strong>을 공분산으로 사용해서 2차원 가우시안으로 이용합니다.

### ② 공분산 행렬을 타원체로 다루기
공분산 행렬은 항상 <strong>정부호 행렬(고윳값이 항상 양수)</strong>이어야 합니다. 아래 코드를 보면 음수의 고윳값을 가지는 행렬은 애초에 함수를 통과하지 못하는 걸 볼 수 있습니다.

import numpy as np\
\
```python
cov = np.array([[1, 2], [2, 1]])
eigenvalues = np.linalg.eigvals(cov)
```
print(egeinvalues) \# [3, -1]\
\
np.random.multivariate_normal(mean=[0, 0], cov=cov, size=1000)\
\# Error : covariance is not symmetric positive-semidefinite.

3D GS는공분산 행렬의 각 원소들을 <strong>Graident Descent</strong>로 학습하기 때문에 자칫 <strong>대칭성</strong>이나 <strong>정부호 행렬의 성질</strong>을 잃어버릴 수 있습니다. 3D GS는 이 문제를 해결하기 위해 직관적인 방법을 사용하는데 가우시안을 타원체의 도형으로 취급하는 겁니다. 이 타원체는 <strong>Rotation Matrix(R)</strong>와 <strong>Scaling Matrix(S)</strong>로 표현합니다.

![](/img/medium/1-BsJK23EzlEJF8TKUyoyq1w-c217d093109c.png)

회전을 표현하는 쿼터니언과 Scaling Matrix로 타원체를 표현하고 있다.

R과 S두 행렬을 가지고 <strong>행렬 Σ</strong>는 아래 수식으로 표현합니다. 위에서 Σ를 어떻게 2차원에 투영시키는지 다루었었는데요. 그 때 사용합니다.

![](/img/medium/1-VKtUeWXx8eBWfoXDQISCvw-9044301d2638.png)

수식을 잘 보면 <strong>주성분 분석(PCA)</strong>에서 공분산 행렬의 <strong>고윳값 분해</strong>와 의미가 같다는 걸 알 수 있습니다.

![](/img/medium/1-iXMjeQyA6nT6W-Bg90qKxA-e9e7721c4c4b.png)

(2)는 고유값 분해의 정의입니다. 고유벡터를 모아둔 행렬 V는 A가 대칭행렬인 경우에는 그 역행렬이 <strong>V^T</strong>입니다. 위 수식에서 S는 대각 행렬이기 때문에 SS^T는 각 원소에 제곱한 값입니다.

다시 말하면 위 수식은 타원체의 모양을 잘 나타내는 <strong>주축 방향(= 고유 벡터)</strong>와 주축 방향으로의 <strong>타원체의 크기(=고윳값)</strong>를 결정한다고 볼 수 있습니다.

![](/img/medium/1-m9PFq5UkHsssB9IXc7ekNQ-d4e9b6d9e8b4.png)

[source : 주성분 분석(PCA) — 공돌이의 수학 노트](https://angeloyeo.github.io/2019/07/27/PCA.html#google_vignette)

> <strong>쿼터니언</strong>\
> 물체의 회전이라는 건 각 Pitch, Roll, Yaw 각 축에 대해 회전한 정도로 표현할 수 있는데요. 이를 직접 사용하는 오일러 각은 연산도 비효율적이며 짐벌 락(Gimbal Lock)현상이 발생하기 때문에 게임 개발할 때는 흔히 회전을 <strong>쿼터니언</strong>으로 변환시켜서 사용하곤 합니다. 위 수식에서 R은 쿼터니언에서 사용하는 행렬로 i, j, k, r 4개의 변수를 가지고 있습니다.

> 유명한 [*수학 채널 3Blue1Borwn*](https://www.youtube.com/watch?v=d4EgbgTm0Bg) 에서 쿼터니언에 대해 다룬 적이 있습니다.

![](/img/medium/1-LWzqte3Cf50nnnOLD66IWw-89c9d5ba1941.png)

[[source](https://www.researchgate.net/figure/a-Pitch-yaw-and-roll-angles-of-an-aircraft-with-body-orientation-O-u-v-original_fig7_348803228)]

③ Spherical Harmonics \| 색상 표현하기 \
사물은 바라보는 방향에 따라 보이는 색상이 다릅니다.<strong> 이를 (2)에서 정의한 타원체에 표현시키기 위해서 </strong>구면 조화 함수(Spherical Harmonics)를 사용하는데요. 이는 언리얼 엔진에서 광원 효과를 주는 볼류메트릭 라이트맵[8]의 원리이기도 합니다.

![](/img/medium/1-JCxufrbXs9iYMpuDJg1Fag-7a8e6850d600.png)

흠.. 대학원 양자역학이요..?

먼저 X축, Y축으로 이루어진 평면 좌표계 대신 구면좌표계라는 개념이 있습니다. 이 좌표계는 두개의 각도 <strong>θ, Ψ</strong>로 구체에서 특정 방향의 값을 표현하는데요. 이 때 반지름은 무시합니다. <strong>구면 조화 함수(Spherical Harmonics)</strong>는 이 두개의 각도를 입력받아서 특정 값을 반환하는 함수입니다.

![](/img/medium/1-3Bw1JzsW50nROyHY6o-0ng-fae86f855abf.png)

source : [Spherical Coordinates](https://mathworld.wolfram.com/SphericalCoordinates.html)

![](/img/medium/1-DkZNXw8xxshdlEhH7-thaA-4e456ca81c31.png)

[https://en.wikipedia.org/wiki/Spherical_harmonics](https://en.wikipedia.org/wiki/Spherical_harmonics)

위 함수가 구면 조화 함수입니다. 파라미터 중에 l과 m은 각운동량 양자수니 자기 양자수니 하는 알 수 없는 말을 합니다. 허허.. <strong>우리는 저 수식은 머릿속에서 지워버리고 결과만 살펴보겠습니다.</strong>

![](/img/medium/1-dkbctHf-9V8eI1H1Sj4bVA-c734b9594237.png)

source : [Efficient HRTF Representation Using Compact Mode HRTFs](https://www.researchgate.net/figure/Real-part-of-a-set-of-spherical-harmonics-mapped-to-the-surface-of-a-sphere-The-colour_fig1_345372557)

위 구면체들의 집합은 구면조화 함수의 l과 m에 따른 변화된 모습입니다. 우측 그림을 보면 제가 파랑색에 화살표로 표시했는데요. 이는 이 함수의 결과값이 파랑색이라는게 아니라 비슷한 값을 반환한다는 의미입니다.

최종적으로 색상을 결정할 때는 이 구면조화 함수들의 결과값에다가 가중치를 곱해서 합산한 값이 됩니다.

![](/img/medium/1-3SsXUEnpSZzFV8qs4xH3mA-24a0de700efa.png)

완전히 같진 않지만 의사 코드를 작성해보면 아래와 비슷합니다. 실제 논문 저자들이 [구현한 코드](https://github.com/graphdeco-inria/gaussian-splatting/blob/54c035f7834b564019656c3e3fcc3646292f727d/utils/sh_utils.py#L57-L112)를 보면 L=3 까지만 사용하고 있습니다. 위 변수에서 C1, C2, …, Cn을 <strong>SH Coefficient</strong> 라고 부릅니다.

import numpy as np\
\
```python
def spherical_harmonics_color(coefficients, theta, phi):
Y00 = 0.5 * np.sqrt(1 / np.pi)
Y1m1 = np.sqrt(3 / (4 * np.pi)) * np.sin(theta) * np.sin(phi)
Y10 = np.sqrt(3 / (4 * np.pi)) * np.cos(theta)
Y11 = np.sqrt(3 / (4 * np.pi)) * np.sin(theta) * np.cos(phi)
```
\
color = (\
coefficients[0] * Y00 +\
coefficients[1] * Y1m1 +\
coefficients[2] * Y10 +\
coefficients[3] * Y11\
)\
\
return color

### 그런데 이걸 왜 이렇게 하는 걸까요?

푸리에 변환을 들어보신 분들은 임의의 신호를 주기함수들의 합으로 분해할 수 있다는 걸 아실겁니다. 푸리에 변환은 서로 직교하는 기저 함수들의 선형 결합으로 표현합니다. 어떤 벡터A 를 기저 벡터의 선형 결합으로 표현하는 것과 같은 느낌입니다.

![](/img/medium/1-Od2klXam3JO29J-NB_2-3g-95f60b54bf05.png)

벡터를 기저들의 선형 결합으로 표현하기

![](/img/medium/0-NYZUDEHsc6oe7OV0-dc8f896f0601.png)

[source](https://www.nti-audio.com/ko/%EC%A7%80-%EC%9B%90/%EC%B8%A1%EC%A0%95-%EB%85%B8%ED%95%98%EC%9A%B0/%EB%B9%A0%EB%A5%B8-fourier-%EB%B3%80%ED%99%98-fft)

위키피디아의 설명을 보면 구면조화함수는 3차원 공간에서 구면 표면 위의 함수를 표현하는 데 사용되는 <strong>직교 기저 함수 집합</strong>이라고 설명하고 있습니다. 이는 푸리에 급수와 유사한 방식으로 작동하여, 구면 위의 복잡한 함수를 더 단순한 기저 함수들의 가중 합으로 분해할 수 있게 해준다고 합니다[9].

3차원 물체가 색상을 결정하는 많은 독립적인 변수들이 있을거에요. 추상적으로 해석하면 <strong>광원의 위치, 그림자, 빛을 반사하는 정도, 표면 특성</strong> 등이 있을텐데 이것이 색상을 결정하는 정도를 가중치로 매겨서 합산한다고 이해하면 좋을 것 같습니다.

> Since the spherical harmonics form <strong>a complete set of orthogonal functions and thus an orthonormal basis, </strong>each function defined on the surface of a sphere can be written as a sum of these spherical harmonics. This is similar to periodic functions defined on a circle that can be expressed as a sum of circular functions (sines and cosines) via Fourier series.

## ④ Tile-based Rasterization
Rasterization은 그래픽스에서 벡터 정보를 픽셀로 변환하는 과정을 말합니다. 위에서 우리는 <strong>(1) 타원체를 2차원으로 투영시키는 방법, </strong>(2) 구면체 도형을 표현하는 방법<strong>과 </strong>(3) 색상을 표현하는 방법을 개별적으로 다루었다면 이제 이 정보들을 모아서 최종적으로 2D 픽셀 정보를 결정하는 방법을 다룹니다.

![](/img/medium/1-sjiEzXs3hhYJ1qVfHbXYcg-c86e42645799.png)

- <strong>CullGaussian</strong> 함수는 카메라 시야에 들어오는 정보 이외의 가우시안 정보들을 제거합니다. view frustum 보면 너무 가깝거나 완전히 먼 가우시안 정보도 함께 제거합니다.
- <strong>ScreenspaceGaussians(M, S, V)</strong>는 위에서 (1)에서 다루었던 3차원 가우시안을 2차원으로 투영시킨 시킨 결과값 M’, S’을 반환합니다.
- <strong>CreateTiles(w,h)</strong>는 이미지를 16x16의 타일로 나누는데요. 이는 GPU에서 병렬처리하는 단위로 사용하기 위함입니다.
- <strong>DuplicateWithKeys, SortByKeys</strong>는 가우시안 정보를 깊이(depth)를 기준으로 정렬해서 가까이 있는 사물에 더 많은 색상을 반영하도록 합니다.
- 마지막으로 <strong>BlendInOrders</strong> 에서 가우시안 집합을 블렌딩 해서 픽셀의 색상을 결정하는데요. 이는 NeRF에서 볼류메트릭 렌더링의 원리와 유사합니다.

![](/img/medium/1-CvVCRRSnVAdcIzIK5iYEHQ-1455ff08c096.png)

source : Stanford Seminar — [Perception-Rich Robot Autonomy with Neural Environment Models](https://www.youtube.com/watch?v=eHr_jA8HnkA)

## Optimization

이번에는 가우시안 정보의 2D 이미지 변환에서 <strong>학습 최적화 단계</strong>를 다룹니다. 딥러닝 기본 개념을 아신다면 <strong>Gradient Descent 원리</strong>에 익숙하실 것이므로, 이 부분을 더 쉽게 이해하실 수 있을 것입니다.

![](/img/medium/1-l9oagxtY-w8PbLQJDP1P7A-2c1884253a30.png)

- <strong>SfM(Structure from Motion)</strong>은 전통적으로 사용하는 이미지에서 포인트 클라우드를 얻어내는 기법입니다. 여기서 얻어낸 포인트 정보를 초기 좌표 정보로 활용합니다.
- <strong>InitAttributes()</strong> 에서 <strong>가우시안 정보 Σ</strong> (회전 행렬 R, 크기 변환 행렬 S)와 색상을 결정할 <strong>SH Coefficient 계수, </strong>그리고 <strong>불투명도 A</strong>를 임의를 초기화 합니다. 이 정보는 아래의 <strong>Adam Optimizer</strong>에 의해 전부 학습될 겁니다.

지금부터 굉장히 집중해서 봐야할 내용이 있는데요. <strong>IsRefinementIteration</strong> 조건문으로 특정 주기마다 <strong>① Pruning</strong>과 <strong>② Densification</strong> 과정을 진행합니다. 논문에서는 이 주기를 단순히 100번째 iteration마다 실행합니다.

### ① Pruning
지나치게 투명해서(a \< ε) 정보로써 의미가 없거나, 지나치게 큰 경우에는 가우시안을 삭제합니다. 논문에서는 ε값을 1/255로 설정했습니다.

### ② Densification
Densification은 말 그대로 밀집도 있게 만드는 과정입니다. 아래는 기하학적 특징을 잘 담지 못하는 <strong>Under Reconstruction</strong> 과 가우시안의 영역이 너무 큰 <strong>Over Reconstruction</strong>의 상황을 보여주는데요. 연구자들은 이 두 상황을 모두 가우시안의 위치에 대한 Loss값의 Gradient인 <strong>▽p</strong> 로 찾을 수 있다고 보았습니다.

이 값이 정해진 임계값 $τ_p(0.0002)$ 보다 크면 가우시안들이 최적화되지못하고 위치를 계속 변경하려고 한다고 봤습니다. 그래서, 크기에 대한 임계값 $τ_s$보다 크면 가우시안을 1.6x로 줄인 다음 분할하고 작다면 하나 더 복제합니다.

![](/img/medium/1-QY7zW7eG7uIRz5YILUGMFQ-9254c23c8ef9.png)

source : [4]

## Evaluation

3D GS는 이미지의 유사도를 평가 지표에 있어서는 3개의 데이터셋에 대해 대부분 SOTA의 성능을 보여주었습니다. 여기서 더욱 눈여겨 볼 사실은 Mip-NeRF360은 학습 시간이 거의 2일에 걸쳐서 하는 반면, 3D GS는 7K iteration에서는 6분, 30K에서는 30~40분 정도만 소요했습니다. 다만, 가우시안이 보통 1M~5M개 정도 형성된다고 하고 GPU를 병렬로 쓰기 때문에 메모리를 상대적으로 많이 사용합니다. 아마 이런 부분은 후속 연구가 진행되면서 빠르게 개선되지 않을까 싶습니다.

![](/img/medium/1-1RzsjWP_e-v6p4DbseumTw-c3e172ba8af0.png)

![](/img/medium/1-q0vbfO2hMqn_y56C-SRUWw-df23c44f198d.png)

source : [4]

다음으로는 논문에서 저자들이 도입한 기법들이 꽤 많은데요. 각각의 기법을 비활성화 한 상태로 실험을 진행했을 때 본인들이 내린 결정들이 좋은 결정들이었는지는 평가합니다. 평가에 사용된 메트릭은 PSNR 점수 입니다.

![](/img/medium/1-j3tI_uDo1odmwhz_K78qQw-78ab10d5c3e6.png)

- Random Init은 <strong>SfM(Structure from Motion)</strong>에서 얻은 포인트 클라우드 정보를 사용하지 않고 무작위로 생성한 결과입니다.
- No-Split, No-Clone은 Densification 전략을 의미합니다.
- No-SH는 Sphericial Harmonics를 사용하지 않는 경우입니다.
- Isotropic은 공분산에서 모든 분산의 값이 동일한 경우를 말하는데요. 공분산 행렬에서 모든 파라미터를 최적화 대상으로 결정하는게 옳은 판단이었는지 확인했습니다.

![](/img/medium/1-VDMotVo2jyX66zIPUMWkBg-9464f0e001b2.png)

논문에서는 이 내용을 더욱 정성적으로 설명해줍니다. 예를 들어 배경이 뭐가 어떻고, 사물이 어떻게 보이고 등을 사진과 함께 설명하고 있는데요. 여기서는 결론만 말하면 모든 결정사항을 다 적용한 Full 버전이 가장 성능이 좋았습니다.

### Mesh로 변환해서 사용하기

실제로 몇몇 영상[(1)](https://www.youtube.com/watch?v=xdDzChfFY_A), [(2)](https://www.youtube.com/watch?v=4xTEyz9bx5E)과 [구현체](https://github.com/xverse-engine/XV3DGS-UEPlugin)를 보면 <strong>언리얼 엔진</strong> 혹은 <strong>유니티</strong>에서 렌더링 할 수 있도록 플러그인들은 개발이 된 것 같습니다. 그래도 사실 게임 개발에서는 Mesh가 필요합니다.

AI들이 이동할 때 최적 경로 계산에 활용되는 <strong>(1) Navigation Mesh</strong>이 없고 (2) 맵이 넓은 경우에는 멀리있는 사물은 대충 표현하고 카메라와 가까이 있는 건 디테일 하게 표현하는 LOD 기법들이 사용되곤 하는데요. 3D GS로는 사물의 형태를 유지하면서 미세하게 조정하기에는 어려워 보입니다.

![](/img/medium/1-jgZ_JVuN1F-kefRN7bN9IA-0ddf4fcfa886.png)

[[source]](https://3dstudio.co/3d-lod-level-of-detail/)

\(3\) 물리엔진에 의한 충돌이나 레이 캐스팅, 그리고 (4) 물리 기반 렌더링 기법등을 사용할 수 없기 때문에 3D GS 자체로는 그대로 사용하기 어렵고 Mesh로 한 번 변환시켜 줘야 하는데요.

이 글을 작성하는 시점에서 가장 최근 연구를 찾아보니 <strong>CVPR 2024</strong>에서 3D GS를 Mesh로 SuGaR[1]가 있습니다. 이걸 이용하면 게임 엔진에서 사용해볼 수 있을 것 같습니다.

![](/img/medium/1-xUq1dMOlvU7uUHj88qMgwg-d2dc2057fefc.png)

### 마무리

이 글에서는 Gaussian Splatting이라는 혁신적인 기술을 소개했습니다. 비록 학계에서는 이미 상당한 주목을 받은 주제라서 이미 발행된 좋은 아티클들이 많았습니다. 조금 늦었지만, 그래도 이 글이 저와 같이 그래픽스 분야가 생소하신 분들에게 새로운 시각으로 내용을 이해하는데 도움을 줄 수 있길 기대합니다.

제 역량이 된다면 다음 글에서는 실제로 이를 사용해서 게임 엔진에 올려보는 튜토리얼을 준비해보겠습니다.

## 레퍼런스

- [1] [Representing Scenes as Neural Radiance Fields for View Synthesis — ECCV 2020](https://www.matthewtancik.com/nerf)
- [2] [open Multiple View Geometry library. Basis for 3D computer vision and Structure from Motion.](https://github.com/openMVG/openMVG)
- [3] [Use 3D Gaussian Splatting In Game Development, What The Internet Doesn’t Tell You \| GDC Talk](https://www.youtube.com/watch?v=zTwHmxfKvOs)
- [4] [3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
- [5] [EWA Volume Splatting](https://www.cs.umd.edu/~zwicker/publications/EWAVolumeSplatting-VIS01.pdf)
- [6] [자코비안 행렬의 기하학적 의미 — 공돌이의 수학 정리 노트](https://angeloyeo.github.io/2020/07/24/Jacobian.html#google_vignette)
- [7] [Reconstruct 3D from images! Implementing bundle adjustment in Python](https://qiita.com/scomup/items/f8632151712828e9625d)
- [8] [Unreal Engine — Volumetric Lightmap](https://dev.epicgames.com/documentation/en-us/unreal-engine/volumetric-lightmaps-in-unreal-engine)
- [9] [Spherical Harmonics — Wikipedia](https://en.wikipedia.org/wiki/Spherical_harmonics)
- [10] [SuGaR: Surface-Aligned Gaussian Splatting for Efficient 3D Mesh Reconstruction and High-Quality Mesh Rendering : CVPR 2024](https://anttwo.github.io/sugar/)
