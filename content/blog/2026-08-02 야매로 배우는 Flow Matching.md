---
title: "야매로 배우는 Flow Matching"
date: "2026-08-02"
description: "Flow Matching의 핵심 아이디어와 확산 모델과의 차이를 야매로 정리해봅니다."
draft: true
---


최근 생성 모델 분야를 보면, 많은 연구들이 Flow Matching을 이용하는 모습을 심심찮게 발견할 수 있습니다. 제가 봤던 논문 중에서 하나를 공유해볼게요. CVPR 2026에서 발표된 메타와 브라운 대학의 연구인 [LLaMo](https://cvpr.thecvf.com/virtual/2026/poster/38091)는 텍스트 프롬프트로 3D 인간의 모션 데이터를 생성하는 방법을 다루는데요. 인간의 모션을 연속적인 잠재 공간으로 인코딩 하고, 경량 **Flow-Matching** head를 붙이는 방식을 제안합니다.

![](/img/blog/image1.png "LLaMo: Scaling Pretrained Language Models for Unified Motion Understanding and Generation with Continuous Autoregressive Tokens")

오늘 글에서는 이 [Flow Matching](https://arxiv.org/abs/2210.02747)에 대해 다뤄보겠습니다. 평소라면 논문을 직접 파보면서 내용을 이해하려고 했겠지만.. Flow Matching 논문은 내츄럴 본 수포자인 제가 이해할 수 있는 레베루가 아니라서, 대신 [스탠포드 대학의 오픈 강의인 CME 296](https://cme296.stanford.edu/)에서 설명해준 [Flow Matching 영상 강의](https://www.youtube.com/watch?v=agN3AlfGFrk)를 통해 배웠습니다.

오늘 제목을 야매로 배우는 Flow Matching이라고 지었는데요. 수학적인 내용은 제가 이해한 내용까지만 다루고 최대한 직관적인 설명 위주로 전개해보겠습니다.

## INDEX
1. 코드에서 시작하기
2. 생성 모델을 왜 확률 분포로 정의할까?
3. Diffusion Model
4. Flow Model
5. Flow Matching
6. Flow Matching의 의의
7. 마무리

## 코드에서 시작하기
이번 글은 Flow Matching의 동작 원리를 보여주는 간단한 PyTorch 코드에서 부터 출발합니다. 이론에서 출발해서 코드가 아닌, 거꾸로 코드에서 출발해서 이론으로 달려봅시다.

![](/img/blog/image2.png "Flow Matching 논문 Figure 4. 가우시안 분포에서 샘플링해서 체크보드 모양으로 이동하는 모습을 보여준다.")

위 그림은 논문에서 Flow Matching이 왜 Diffusion 보다 나은지 보여주기 위해서 사용한 자료로, 초기 분포(= 가우시안 분포)에서 체크보드 데이터 분포의 모양으로 이동하는 모습을 보여줍니다. 우선 이 체크보드 분포부터 정의해봅시다.

**1️⃣ 학습 데이터 정의**

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

`sample_checkerboard` 함수는 2개의 값을 가진 1차원의 $x_1,x_2$ 벡터를 파라미터 개수 만큼 반환합니다. 이 샘플 결과를 시각화 하면 아래 문양으로 보입니다.

![](/img/blog/image3.png)

**2️⃣ 신경망 레이어**

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

**3️⃣ Flow Matching 학습**

학습 루프 자체는 평범하고, 코드 중간에 손실 함수를 보시면 코드와 계산이 굉장히 간단합니다. 저는 처음에 이걸 보면서 "아니 논문은 나한테 꽤 어려운데 결론이 이거라고?" 라는 생각을 했습니다.

$$
L_{CFM} = E_{t,x_{1},x} [||u_{t}^\theta(x) - x_{1}   - x_{0}||^2]
$$

```python
training_steps = 5000
batch_size = 1024

model = VelocityField().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=2e-3)
losses = []

for _step in range(training_steps.value):
    x_0 = torch.randn(batch_size.value, 2, device=device)
    x_1 = sample_checkerboard(batch_size.value).to(device)
    t = torch.rand(batch_size.value, 1, device=device)

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

**4️⃣ 데이터 생성 단계**

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

## 생성 모델을 왜 데이터 분포로 정의할까?