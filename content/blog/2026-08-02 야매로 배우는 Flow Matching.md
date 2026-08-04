---
title: "야매로 배우는 Flow Matching"
date: "2026-08-02"
description: "Flow Matching의 핵심 아이디어와 확산 모델과의 차이를 야매로 정리해봅니다."
draft: true
---


최근 생성 모델 분야를 보면, 많은 연구들이 Flow Matching을 이용하는 모습을 심심찮게 발견할 수 있습니다. 제가 최근에 봤던 논문중에선 다음 사례가 있습니다. CVPR 2026에서 발표된 메타와 브라운 대학의 연구인 [LLaMo](https://cvpr.thecvf.com/virtual/2026/poster/38091)는 텍스트 프롬프트로 3D 인간의 모션 데이터를 생성하는 방법을 다루는데요. 인간의 모션을 연속적인 잠재 공간으로 인코딩 하고, 경량 **Flow-Matching** head를 붙이는 방식을 제안합니다.

![](/img/blog/image1.png "LLaMo: Scaling Pretrained Language Models for Unified Motion Understanding and Generation with Continuous Autoregressive Tokens")

그리고 재미있게도 Stable Diffusion 1 & 2가 DDPM 방식의 Diffusion 학습 방식으로 구현했다면, 2024년에 발표한 [Stable Diffusion 3](https://arxiv.org/pdf/2403.03206)는 여전히 이름에는 Diffusion이 들어가 있지만 모델 학습에서는 Rectified Flow라고 불리는 Flow Matching을 사용합니다. 

![](/img/blog/image5.png "Scaling Rectified Flow Transformers for High-Resolution Image Synthesis")

이번 글에서는 이 [Flow Matching](https://arxiv.org/abs/2210.02747)에 대해 다뤄보겠습니다. 평소라면 논문을 직접 파보면서 내용을 이해하려고 했겠지만.. Flow Matching 논문은 내츄럴 본 수포자인 제가 이해할 수 있는 레베루가 아니라서, 대신 [스탠포드 대학의 오픈 강의인 CME 296](https://cme296.stanford.edu/)에서 설명해준 [Flow Matching 영상 강의](https://www.youtube.com/watch?v=agN3AlfGFrk)를 통해 배웠습니다.

오늘 제목을 야매로 배우는 Flow Matching이라고 지었는데요. 수학적인 내용은 제가 이해한 내용까지만 다루고 최대한 직관적인 설명 위주로 전개해보겠습니다. 

## INDEX
1. 코드에서 시작하기
2. 생성 모델이란?
3. Diffusion Model
4. Flow Model
5. Flow Matching
6. 마무리

## 코드에서 시작하기
이번 글은 Flow Matching의 동작 원리를 보여주는 PyTorch 코드에서 출발합니다. 평소라면 이론으로 시작해서 코드 구현 순서로 서술했을텐데요. 오늘은 거꾸로 코드에서 출발해서 이론적인 이야기로 들어가보겠습니다.

![](/img/blog/image2.png "Flow Matching 논문 Figure 4. 가우시안 분포에서 샘플링해서 체크보드 모양으로 이동하는 모습을 보여준다.")

위 그림은 논문에서 Flow Matching이 왜 Diffusion 보다 나은지 보여주기 위해서 사용한 자료로, 초기 분포(= 가우시안 분포)에서 체크보드 데이터 분포의 모양으로 이동하는 모습을 보여줍니다. 먼저 우리가 찾고싶은 체크보드 데이터 분포부터 정의해봅시다.
 
**① 학습 데이터 정의**

```python
def sample_checkerboard(count: int) -> torch.Tensor:
    """4 x 4 칸 중 교차하는 8개 칸에서 균일 표본을 만든다."""
    cells = torch.cartesian_prod(torch.arange(4), torch.arange(4))
    occupied_cells = cells[(cells.sum(dim=1) % 2) == 0]
    cell = occupied_cells[torch.randint(len(occupied_cells), (count,))]
    return -4 + 2 * (cell + torch.rand(count, 2))

checkerboard_samples = sample_checkerboard(4000)
print(checkerboard_samples.shape)

# Output: torch.Size([4000, 2])
```

`sample_checkerboard` 함수는 2차원 좌표 $(x^{(1)}, x^{(2)})$로 이루어진 샘플을 `count`개 생성합니다. 이 샘플 결과를 시각화 하면 아래 문양으로 보입니다.

![](/img/blog/image3.png)

**② 신경망 레이어**

다음에는, 간단한 레이어 구조를 가진 신경망을 하나 정의합니다. 이 모델은 데이터에 해당하는 변수 $x$를 입력받고 시간 변수인 $t$를 추가로 받습니다. 여기서 $t$는 Diffusion Model의 시간 개념과 동일한데요. 더 자세한 뒤에서 다루겠습니다.

```python
class VelocityField(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(3, 256),
            nn.SiLU(),
            nn.Linear(256, 256),
            nn.SiLU(),
            nn.Linear(256, 256),
            nn.SiLU(),
            nn.Linear(256, 2),
        )

    def forward(self, x, t):
        return self.network(torch.cat((x, t), dim=1))
```

**③ Flow Matching 학습**

학습 과정은 우리가 이미 알고 있는 가우시안 분포에서 초기 노이즈이자 출발점인 $x_0$을 하나 뽑고, 타게 데이터 분포에서 도착점 $x_1$을 뽑습니다. 그리고 0~1 사이의 시간 $t$를 선택한 다음 두 점 사이를 직선으로 보간한 위치 $x_t$를 계산합니다.

$$
x_t = (1 - t)x_0 + tx_1
$$

루프 자체는 많이 보던 모습인데요. 재밌는 점은 코드 중간에 손실 함수를 보시면 코드와 계산이 굉장히 간단합니다. 사실 Flow Matching 논문 내용 자체는 이 수식을 유도하기 위한 여정인데요. 결과만 놓고보면 엄청 단순하죠?

$$
L_{CFM} = E_{t,x_{1},x} [||u_{t}^\theta(x) - (x_{1} - x_{0})||^2]
$$

```python
training_steps = 5000
batch_size = 1024

model = VelocityField().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=2e-3)
losses = []

for _step in range(training_steps):
    x_0 = torch.randn(batch_size, 2, device=device)
    x_1 = sample_checkerboard(batch_size).to(device)
    t = torch.rand(batch_size, 1, device=device)

    # 손실 함수 정의
    x_t = (1 - t) * x_0 + t * x_1
    target_velocity = x_1 - x_0
    loss = (model(x_t, t) - target_velocity).square().mean()

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    losses.append(loss.item())
model.eval()
```

**④ 데이터 생성 단계**

데이터를 생성할 때는 시간 $t: 0 \rightarrow 1$와 함께 데이터 $x$를 모델 입력으로 넣고 출력 결과를 $x$에 더합니다. 이를 반복적으로 수행하면서 노이즈에서 시작했던 분포가 점점 원하는 타겟 분포에 가까워 집니다.

$$
\hat{x_1} = x_0 + \int_0^1 u_t^{\theta}(x)dt
$$

누군가는 이를 상미분방정식(ODE)을 풀기위한 [오일러 메서드](https://en.wikipedia.org/wiki/Euler_method)라고 하는데요. 일단 여기서는 ODE를 풀기 위한 방법이라고만 이해하고 넘어갑니다.

```python
@torch.no_grad()
def generate(initial_points: torch.Tensor, steps: int = 100):
    """배운 ODE dx/dt = v_theta(x, t)를 Euler 방법으로 적분한다."""
    x = initial_points.to(device)
    trajectory = [x.cpu()]
    dt = 1 / steps
    for time in torch.linspace(0, 1 - dt, steps, device=device):
        t = torch.full((len(x), 1), time, device=device)
        x = x + dt * model(x, t)
        trajectory.append(x.cpu())
    return x.cpu(), torch.stack(trajectory)

initial_samples = torch.randn(2000, 2)
generated_samples, trajectories = generate(initial_samples)
```

![](/img/blog/image4.png)

지금까지는 실제 동작하는 코드를 기준으로 Flow Matching이 동작하는 모습을 간단하게 소개했습니다. 지금부터는 본격적으로 논문 내용을 <u>**제가 이해한 부분만**</u> 설명해보겠습니다.

## 생성 모델이란?
먼저 생성 모델이라는게 뭘까요? 정확히는 생성 모델이 문제를 어떻게 정의하는지 알 필요가 있습니다. 

![](/img/blog/image6.png "[MIT 6.S184 Flow Matching and Diffusion Models](https://www.youtube.com/watch?v=GCoP2w-Cqtg&list=PL57nT7tSGAAUDnli1LhTOoCxlEPGS19vH)")

생성 모델에서 흔히 다루는 데이터인 이미지, 영상, 단백질 구조 등 데이터의 표현이나 다루는 차원은 조금씩 다르지만, 우리는 이를 어떻게든 $z \in \mathbb{R}^d$ 벡터로 변환할 수 있습니다.

![](/img/blog/image7.png "[Stanford CME296 Diffusion & Large Vision Models | Spring 2026 | Lecture 3 - Flow matching](https://www.youtube.com/watch?v=agN3AlfGFrk)")

생성 모델에서는 우리가 우리가 원하는 데이터가 아직 발견되지 않은 분포 $P_{data}$에서 샘플링 된다고 봅니다. 그 중에서 우리가 이 세상에서 발견해서 수집할 수 있는 학습 데이터는 해당 분포에서 관측한 표본인 셈이죠. Diffusion, Score Matching 부터 Flow Matching 까지 생성 모델들은 우리가 잘 다루기 쉬운 가우시안 정규 분포 $P_{noise}$를 데이터의 분포인 $P_{data}$로 이동시키는 것으로 문제를 정의합니다.

![](/img/blog/image8.png "[Stanford CME296 Diffusion & Large Vision Models | Spring 2026 | Lecture 3 - Flow matching](https://www.youtube.com/watch?v=agN3AlfGFrk)")

사실 교수님이 하시는 말씀을 옮겨오긴 했는데, 저는 이게 직관적으로 받아들여지진 않았습니다. 어떤 원리로부터 도출된 결과라기 보다는 수학의 공리처럼 뇌를 비우고 받아들여야 하나의 전제에 가까운 것으로 보이더라구요. 

그래서 이를 다시 말해보겠습니다. 일단 $d$차원의 벡터를 무작위로 샘플링 해본다고 합니다. 사실 이 벡터 공간의 대부분은 아무 의미 없는 노이즈 공간입니다. 그래서 이를 아무리 열심히 샘플링 해도 대부분은 노이즈가 나오겠죠. 근데 아주 우연히 어느 날 랜덤으로 데이터를 뽑던 중에 우연치 않게 고양이 이미지 데이터가 나왔다고 해봅시다. 가능성은 거의 없지만 가능한 일이긴 하죠?

그래서 이 무한한 공간 어딘가에 고양이, 강아지, 곰 등의 이미지 데이터가 숨어있으며, 이 이미지들은 실제로 공간 전체에 흩어져 있는 게 아니라 강아지에 가까운 사진은 서로 비슷한 영역에 뭉쳐있고, 고양이에 가까운 사진은 서로 비슷한 영역에 모여있다고 봅시다. 바로 이런 영역에 최적화된 데이터 분포를 $P_{data}$라고 부르고 생성모델은 이 영역을 찾는 일입니다.

## Diffusion Model
Diffusion Model은 예전에 제가 작성한 [이전 글](/p/AI와-게임-개발-3D-생성-모델-연구-맛보기/)에서 다룬 적이 있습니다. 여기서는 Diffusion Model의 간단한 아이디어만 다루겠습니다.

**Diffusion Model**은 $P_data$의 표본이자 현실 세계에서 관측한 데이터에 노이즈를 점진적으로 추가해서 우리가 <u>다루기 쉬운 분포인</u> 가우시안 노이즈로 만듭니다. 

이 때 신경망이 각 단계에서 데이터에 추가된 노이즈를 추정하도록 학습해서 근사하면, 노이즈에서 시작해서 노이즈를 제거하면서 새로운 이미지를 생성하는 아이디어가 Diffusion Model이고 이를 실용적으로 사용할 수 있게끔 완성한 대표적인 연구가 [DDPM(Denoising Diffusion Probabilistic Models
)](https://arxiv.org/abs/2006.11239)입니다.

![](/img/blog/image9.png "Diffusion Models: A Comprehensive Survey of Methods and Applications")

> Flow Matching도 기존에 존재하던 Flow Model 접근 방식을 신경망에서 실용적으로 사용할 수 있게 완성했다는 점에서 DDPM과 결을 같이합니다.

## Flow Model
Flow Model은 2010년대부터 Normalizing Flow를 이용해서 단순한 분포를 복잡한 분포로 바꾸는 방식입니다. 여기서는 유체역학, 전자기학 등 물리학에서 쓰인 Flow와 Vector Field의 개념을 이용하는데요. 먼저 용어부터 정리하고 갑시다.

**궤적(Trajectory)** 은 $x_{0} \rightarrow x_{t}$ 로 시간에 따라 변화하는 무언가를 말합니다. 여기서 $x$는 $\mathbb{R}^d$로 d차원의 벡터입니다.

{{< flow-viz kind="trajectory" >}}

**벡터장(Vector Field)** 은 $u_t : \mathbb{R}^d  \rightarrow \mathbb{R}^d$ 로 표기하고, 벡터를 입력으로 해서 벡터를 반환합니다. 이 결과가 말하는 건 $(x,t) \rightarrow u_t(x)$ 시간 $t$ 시점에 $x$가 가야할 방향을 제시해주는 역할을 하고, 대표적인 예시로 중력이 있습니다.

{{< flow-viz kind="field" >}}

Flow Model은 시간 $t$에서 점의 위치를 알아낼 수 있는 함수 $X_t$가 존재할 때, 상미분방정식(ODE)을 이용해서 다음 문제를 풀고자 합니다.

$$
\frac{dX_{t}}{dt} = u_{t}(X_{t}) \qquad X_{0} = x_{0}
$$

> ODE(Ordinary differential equation)는 미분이 포함된 방정식을 말합니다. 예를 들어, $x(t) = t^2$이라는 함수를 미분하면 $2t$가 나오는 건 자명하죠. 상미분방정식은 미분의 결과가 주어졌을 때 원래 $x$가 무슨 함수였는가를 풀이하는 겁니다. $\frac{dx}{dt} = 2t$라는 방정식이 주어졌을 때 원래의 $x$를 찾는데 정보가 충분하지 않기 때문에 $x(0)=3$ 이라는 추가정보가 있어야 하고 이 식을 ODE Solver로 찾아내면 $x(t) = t^2 + 3$이라는 결과가 나옵니다.

우리가 거리를 시간으로 미분하면 속도가 된다는 건 알고 있잖아요? 저는 위 식의 정의를 그 의미와 유사하게 받아들였습니다. **위치 $X_t$를 시간 $t$에 대해 미분한 순간속도**로 벡터장 $u_t(X_t)$는 그 시각, 위치에서 가젹야 할 속도와 방향을 알려줍니다. 
 
**연속 방정식(continuity equation)** 

연속 방정식(continuity equation)은 질량이나 전하 같은 물리량이 사라지거나 새로 생기지 않고 보존된 채 이동하는 모습을 수학식으로 모델링하는 방정식입니다. 유체역학에서 질량 보존의 법칙을 표현할 때 쓴다는데요. 갑자기 연속 방정식이 왜 등장하냐면, 우리의 목표는 가우시안 분포에서 확률 질량은 유지한 채 분포를 이동시키는 것이기 때문입니다.

![](/img/blog/image8.png "[Stanford CME296 Diffusion & Large Vision Models | Spring 2026 | Lecture 3 - Flow matching](https://www.youtube.com/watch?v=agN3AlfGFrk)")

벡터장은 입자의 이동만을 설명할 뿐 밀도의 이동을 설명하진 않아요. 연속 방정시은 확률밀도가 이동한다는 관점에서 다시 표현한 식입니다. 먼저, 벡터장의 [발산(Divergence)](https://angeloyeo.github.io/2019/08/25/divergence.html)이란 개념이 있습니다.

발산은 벡터장 내에서 임의의 한 점 $(x,y)$의 매우 작은 공간 안에서 벡터장이 퍼져 나오는지 아니면, 모여서 없어지는지의 정도를 측정하는 연산자입니다. 발산은 $\frac{\partial f}{\partial x}$로 표기하며 벡터장을 위치의 변화량에 대해 한 번 더 미분한 값입니다. 

이해하기 쉽게 1차원 벡터를 기준으로 보겠습니다. 위치 x의 변화량을 기준으로 설명하기 때문에 이 점에는 왼쪽 오른쪽 두군데서 유량이 들어올 수 있죠? 이게 들어오는 값이 더 크면 발산이 0보다 작다고 할 수 있고, 나가는 유량이 더 많으면 발산이 0보다 크다고 할 수 있습니다.

![](/img/blog/image10.png)

우리는 다 차원을 다루고 있기 때문에 이 발산을 $n$차원으로 일반화 하면 아래 수식으로 정의할 수 있습니다.

$$
div(f) = \nabla \cdot f = \sum_{i=1}^n \frac{\partial f_i(x)}{\partial x_i}
$$

- $\nabla \cdot u > 0$ : 주변으로 퍼져 나감
- $\nabla \cdot u < 0$ : 한곳으로 모임
- $\nabla \cdot u = 0$ : 질량이 보존됨

우리는 확률 밀도를 이동시키는 것이기 때문에, 질량이 사라지면 안됩니다. 이런 관계를 정의한 것이 연속방정식이고 아래 처럼 표현할 수 있습니다.

$$
\frac{\partial p_t}{\partial t}(x) = -\nabla \cdot (p_tu_t)(x)
$$

![](/img/blog/image11.png)

이 수식이 이제 Flow Model이 풀고싶은 방정식입니다. 이 문제를 풀기 위해서 Flow Matching 이전에 했던 방식은 Maximum Likelihood로 푸는 방법이었습니다.

$$
\frac{d}{dt}log p_t(x) = -\nabla \cdot u_t(x)
$$

연속방정식을 위 수식으로 정의한 다음, 학습단계에서 최대 우도 계산을 위해서 상미분방정식을 시뮬레이션 하면서 아래 값을 계산합니다.

$$
\text{log }p_1^\theta(x_1) = \text{log }p_0(x_0) + \int_0^1 -\nabla \cdot u_t^{\theta}(x)dt
$$

이게 Flow Matching 이전에 사용되던 Continuous Normalizing Flow의 최대우도 학습 방식입니다 이 방식은 계산 비용이 너무 크다는 단점이 있습니다.

이제 여기서 교수님은 쿨하게 과거에 쓰이던 방식이기 때문에, 깊게 다루지 않는다고 선언하고 넘어갔기 때문에 우리도 여기서 너무 힘들여서 이해하진 않겠습니다. 어차피 내츄럴 본 수포자인 제가 이해하려면 너무 먼 길을 가야하거든요.

## Flow Matching
Flow Matching의 핵심 아이디어는 목표 값을 확률 분포인 $p$가 아니라, 특정 시점 $t$에서의 목표 벡터장을 직접 학습한다는 점입니다. 즉, 결과물인 $p_1$을 비교해서 Loss를 구성하는 게 아니라 중간 시간에서 이 점이 나아갈 방향을 알려주는 벡터를 비교하는 Loss로 정의해서 푼다는 점이 특징입니다. 

$$
\mathcal{L}_{FM}(\theta) = \mathbb{E} [||u_t^{\theta}(x_t) - u_t^{target}(x_t)||^2]
$$

근데 문제가 있습니다. 일단 우리가 벡터장 $u_t(x_t)$를 모른다는 겁니다. 하지만 우리는 수집한 데이터로 $P_{data}$ 에서 데이터 샘플 하나 $x_1$를 얻을 수 있기 때문에, 이걸로 조건부 확률 경로 $p_t(x|x_1)$을 설계할 수 있습니다.

가장 단순하게는 가우시안 분포인 $N(0,I)$로부터 초기 노이즈인 $x_0 \sim N(0,I)$를 샘플링합니다. 그리고 우리가 데이터셋에서 샘플링한 $x_1$를 가지고 직선으로 보간 할 수 있습니다.

$$
x_t = (1 - t)x_0 + tx_1
$$ 

이 수식을 다시 시간으로 미분하면, 샘플의 속도는 다음과 같이 나오기 때문에 조건부 목표 속도를 쉽게 얻을 수 있습니다.

$$
\frac{dx_t}{dt} = x_1 - x_0
$$

이런 조건부 확률을 고려한 Loss를 다시 한 번 정리하면 다음처럼 정의가 됩니다.

$$
\mathcal{L}_{CFM}(\theta) = \mathbb{E} [||u_t^{\theta}(x_t) - u_t(x_t|x_1)||^2]
$$

## 마무리
