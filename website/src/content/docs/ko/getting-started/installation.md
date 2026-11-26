---
title: 설치
description: agent-dashboard 설치 방법
sidebar:
  order: 1
---

## 요구 사항

- **Claude Code** v1.0.80 이상
- **Node.js** 18 이상

## 플러그인 마켓플레이스에서 설치 (권장)

Claude Code 내에서 다음 커맨드를 순서대로 실행하세요:

```
/plugin marketplace add Dont-Do-it-Now/agent-dashboard
/plugin install agent-dashboard
/agent-dashboard:setup
```

## 수동 설치

Git을 사용하여 직접 설치할 수도 있습니다:

```bash
git clone https://github.com/Dont-Do-it-Now/agent-dashboard.git ~/.claude/plugins/agent-dashboard
/agent-dashboard:setup
```

## 다음 단계

설치가 완료되면 [빠른 시작](/ko/getting-started/quick-start/) 가이드를 참고하여 첫 설정을 진행하세요.
