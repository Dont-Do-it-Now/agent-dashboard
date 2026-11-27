# Codex status line 설정

Codex의 `/statusline` 편집기는 Agent Dashboard의 레이아웃을 편집하지 않습니다. Agent Dashboard provider가 읽는 설정 파일에서 프리셋을 선택합니다.

Windows 기본 경로:

```text
%APPDATA%\agent-dashboard\codex-statusline.json
```

파일을 만들고 다음처럼 지정합니다.

```json
{
  "preset": "detailed"
}
```

지원 값은 `compact`, `normal`, `detailed`입니다. 설정을 바꾼 뒤 Codex TUI를 재시작하면 적용됩니다.

- `compact`: 모델, context, 5시간/7일 quota, 상태
- `normal`: 모델/사용량 줄과 작업공간, 세션 시간, burn rate, Todo 상태, agent 상태를 두 줄로 표시
- `detailed`: normal에 Git branch, 도구 상태, 재시작 방식, Codex 버전을 추가해 두 줄로 표시

Git branch는 workspace에서 읽고, 세션 시간은 provider가 해당 thread를 처음 본 시각부터 계산하며, burn rate는 Codex 누적 토큰으로 계산합니다. Codex가 제공하지 않는 Todo와 도구 상태는 숨기지 않고 `—`로 표시합니다. 자동 재시작은 statusline provider가 새 turn을 dispatch할 수 없으므로 지원하지 않으며 `Retry: manual`로 표시합니다.
