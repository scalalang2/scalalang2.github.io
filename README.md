## 개인 블로그

### Quick Links
- [Hugo로 Github Page 설정하기](https://gohugo.io/hosting-and-deployment/hosting-on-github/)

### 새로운 글 발행하기
- `content/<language>/posts/` 경로에 새로운 마크다운 파일 생성하기
- 그리고 깃허브에 푸시만 하면 자동으로 빌드 후 웹사이트가 업데이트 된다. 세상 참 편리해졌다.

### 새로운 코드 스타일 입히기
[연관 이슈](https://github.com/adityatelange/hugo-PaperMod/issues/1241)

```sh
hugo gen chromastyles --style modus-vivendi --highlightStyle 'bg:#474733' > assets/css/extended/modus-vivendi.css
```

아래 내용으로 `config.toml` 수정
```toml
 pygmentsUseClasses = false
# ...
[params.assets]
  disableHLJS = true
# ...
[markup.highlight]
  noClasses = false
  # anchorLineNos = true
  codeFences = true
  guessSyntax = true
  # lineNos = true
  style = "monokai"
```