---
description: "입력 폼에 항목과 빈 값 검사를 추가한다"
---

`${input:feature}`가 `quiz`면 `public/quiz.html`, `activity`면 `public/activity.html`에 `${input:field}`를 레이블로 쓰는 필수 입력란을 추가한다. 그 외 값이면 수정하지 않는다.
공통 폼 검사에 연결해 빈 값이나 공백만 있으면 제출을 막고 입력란 아래에 항목 이름을 포함한 오류를 표시한다.
검사를 통과하면 새 항목의 이름과 입력값을 기존 결과 목록에 함께 표시한다.
