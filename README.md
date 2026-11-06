# sysmon

Claude Code 입력창 바로 위에 디스크·메모리·CPU 사용량을 띄우는 모드(mod)입니다. 2초마다 갱신되고, 디스크는 30초마다 갱신됩니다.

```
디스크 ███████░ 95% · 23GB 남음   메모리 ██████░░ 83% · 39.7/48GB   CPU ███░░░░░ 36%
```

데스크톱 앱에서는 막대가 그래픽으로 그려집니다. 사용률이 75% 이상이면 노란색, 90% 이상이면 빨간색으로 바뀝니다.

macOS 전용입니다. 다른 OS에서는 각 값이 `—`로 표시됩니다.

## 설치

터미널 세션의 프롬프트에서:

```
/plugin install sysmon --marketplace jarvis-kim/claude-mods-sysmon
```

`Add marketplace?`에 `y`를 누르고 범위(user 권장)를 고르면 바로 적용됩니다.

셸에서:

```bash
claude plugin install sysmon --marketplace jarvis-kim/claude-mods-sysmon
```

데스크톱 앱에서는 `/plugin`이 동작하지 않습니다. 프롬프트 옆 **+** → **Plugins** → **Add marketplace**에 `jarvis-kim/claude-mods-sysmon`를 입력한 뒤 **Add plugin**을 누르세요.

## 측정 방식

| 항목 | 명령 | 계산 |
| --- | --- | --- |
| 디스크 | `df -Pk /` | APFS 컨테이너 크기 대비 남은 공간. 볼륨 자체의 Used 열은 쓰지 않습니다 |
| 메모리 | `vm_stat`, `sysctl hw.memsize` | active + inactive + speculative + wired + compressed − purgeable − file-backed. Activity Monitor의 "사용된 메모리"와 같은 방식입니다 |
| CPU | `iostat -n 0 -w 2` (상주 프로세스 1개) | 100 − idle% |

디스크 용량은 Finder처럼 1000 단위(GB)로, 메모리는 Activity Monitor처럼 1024 단위로 표시합니다.

## 개발

```bash
claude plugin validate .
claude plugin test .
```

- `hooks/register.tsx`: 훅(세션 시작 시 수집 시작, 입력창 위 밴드 렌더링)과 수집 로직
- `hooks/parse.ts`: 명령 출력 파서
- `hooks/format.ts`: 표시 문자열과 막대(텍스트·SVG)
- `types/index.d.ts`: `$.state` 계약
- `tests/`: 파서와 밴드 렌더링 테스트
