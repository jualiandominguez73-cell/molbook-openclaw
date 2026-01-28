---
summary: "초보자 가이드: 설치부터 첫 메시지까지 (설정 마법사, 인증, 채널, 페어링)"
read_when:
  - 처음 설치하는 경우
  - 설치 → 온보딩 → 첫 메시지까지 가장 빠른 방법을 원하는 경우
---

# 시작하기

목표: **설치**부터 **첫 번째 채팅**까지 가능한 빠르게 진행합니다.

가장 빠른 채팅: Control UI를 열어보세요 (채널 설정 불필요). `moltbot dashboard`를 실행하고
브라우저에서 채팅하거나, 게이트웨이 호스트에서 `http://127.0.0.1:18789/`를 열어보세요.
문서: [Dashboard](/web/dashboard) 및 [Control UI](/web/control-ui).

권장 방법: **CLI 온보딩 마법사** (`moltbot onboard`) 사용. 다음을 설정합니다:
- 모델/인증 (OAuth 권장)
- 게이트웨이 설정
- 채널 (WhatsApp/Telegram/Discord/KakaoWork/...)
- 페어링 기본값 (보안 DM)
- 워크스페이스 부트스트랩 + 스킬
- 선택적 백그라운드 서비스

더 자세한 참조 페이지: [Wizard](/start/wizard), [Setup](/start/setup), [Pairing](/start/pairing), [Security](/gateway/security).

## 0) 사전 요구사항

- Node `>=22`
- `pnpm` (선택사항; 소스에서 빌드하는 경우 권장)
- **권장:** 웹 검색을 위한 Brave Search API 키.
  `moltbot configure --section web` 실행 (`tools.web.search.apiKey` 저장).
  [Web tools](/tools/web) 참조.

macOS: 앱을 빌드하려면 Xcode / CLT를 설치하세요. CLI + 게이트웨이만 사용하려면 Node만 있으면 됩니다.
Windows: **WSL2** (Ubuntu 권장) 사용. WSL2를 먼저 설치한 후 WSL 내에서 Linux 단계를 실행하세요. [Windows (WSL2)](/platforms/windows) 참조.

## 1) CLI 설치 (권장)

```bash
curl -fsSL https://molt.bot/install.sh | bash
```

설치 옵션 (설치 방법, 비대화형, GitHub에서): [Install](/install).

Windows (PowerShell):

```powershell
iwr -useb https://molt.bot/install.ps1 | iex
```

대안 (전역 설치):

```bash
npm install -g moltbot@latest
```

```bash
pnpm add -g moltbot@latest
```

## 2) 온보딩 마법사 실행 (서비스 설치 포함)

```bash
moltbot onboard --install-daemon
```

선택 항목:
- **로컬 vs 원격** 게이트웨이
- **인증**: OpenAI Code (Codex) 구독 (OAuth) 또는 API 키. Anthropic의 경우 API 키를 권장합니다.
- **제공자**: WhatsApp QR 로그인, Telegram/Discord 봇 토큰, KakaoWork 앱 키 등
- **데몬**: 백그라운드 설치 (launchd/systemd; WSL2는 systemd 사용)
  - **런타임**: Node (권장; WhatsApp/Telegram에 필요). Bun은 **권장하지 않음**.
- **게이트웨이 토큰**: 마법사가 기본적으로 생성하고 `gateway.auth.token`에 저장합니다.

마법사 문서: [Wizard](/start/wizard)

### 인증: 저장 위치 (중요)

- **권장 Anthropic 경로:** API 키 설정 (마법사가 서비스용으로 저장 가능).

- OAuth 자격 증명 (레거시 가져오기): `~/.clawdbot/credentials/oauth.json`
- 인증 프로필 (OAuth + API 키): `~/.clawdbot/agents/<agentId>/agent/auth-profiles.json`

헤드리스/서버 팁: 일반 머신에서 먼저 OAuth를 수행한 후 `oauth.json`을 게이트웨이 호스트로 복사하세요.

## 3) 게이트웨이 시작

온보딩 중 서비스를 설치했다면, 게이트웨이가 이미 실행 중이어야 합니다:

```bash
moltbot gateway status
```

수동 실행 (포그라운드):

```bash
moltbot gateway --port 18789 --verbose
```

대시보드 (로컬 루프백): `http://127.0.0.1:18789/`
토큰이 구성된 경우 Control UI 설정에 붙여넣으세요 (`connect.params.auth.token`으로 저장됨).

⚠️ **Bun 경고 (WhatsApp + Telegram):** Bun은 이러한 채널에서 알려진 문제가 있습니다.
WhatsApp 또는 Telegram을 사용하는 경우 **Node**로 게이트웨이를 실행하세요.

## 3.5) 빠른 확인 (2분)

```bash
moltbot status
moltbot health
moltbot security audit --deep
```

## 4) 첫 번째 채팅 표면 페어링 + 연결

### WhatsApp (QR 로그인)

```bash
moltbot channels login
```

WhatsApp → 설정 → 연결된 기기에서 스캔하세요.

WhatsApp 문서: [WhatsApp](/channels/whatsapp)

### Telegram / Discord / KakaoWork / 기타

마법사가 토큰/설정을 작성할 수 있습니다. 수동 설정을 선호하는 경우:
- Telegram: [Telegram](/channels/telegram)
- Discord: [Discord](/channels/discord)
- KakaoWork: [KakaoWork](/channels/kakao)

**Telegram DM 팁:** 첫 번째 DM은 페어링 코드를 반환합니다. 승인하세요 (다음 단계 참조) 그렇지 않으면 봇이 응답하지 않습니다.

## 5) DM 안전 (페어링 승인)

기본 태세: 알 수 없는 DM은 짧은 코드를 받고 승인될 때까지 메시지가 처리되지 않습니다.
첫 번째 DM에 응답이 없으면 페어링을 승인하세요:

```bash
moltbot pairing list whatsapp
moltbot pairing approve whatsapp <code>
```

페어링 문서: [Pairing](/start/pairing)

## 소스에서 (개발)

Moltbot 자체를 해킹하려면 소스에서 실행하세요:

```bash
git clone https://github.com/moltbot/moltbot.git
cd moltbot
pnpm install
pnpm ui:build # 첫 실행 시 UI 종속성 자동 설치
pnpm build
moltbot onboard --install-daemon
```

전역 설치가 없는 경우 이 저장소에서 `pnpm moltbot ...`를 통해 온보딩 단계를 실행하세요.

게이트웨이 (이 저장소에서):

```bash
node moltbot.mjs gateway --port 18789 --verbose
```

## 7) 종단 간 확인

새 터미널에서 테스트 메시지를 보내세요:

```bash
moltbot message send --target +15555550123 --message "Moltbot에서 보낸 안녕하세요"
```

`moltbot health`에서 "no auth configured"가 표시되면 마법사로 돌아가 OAuth/키 인증을 설정하세요 — 인증 없이는 에이전트가 응답할 수 없습니다.

팁: `moltbot status --all`은 가장 좋은 붙여넣기 가능한 읽기 전용 디버그 보고서입니다.
상태 프로브: `moltbot health` (또는 `moltbot status --deep`)는 실행 중인 게이트웨이에 상태 스냅샷을 요청합니다.

## 다음 단계 (선택사항이지만 좋음)

- macOS 메뉴 바 앱 + 음성 웨이크: [macOS app](/platforms/macos)
- iOS/Android 노드 (Canvas/카메라/음성): [Nodes](/nodes)
- 원격 액세스 (SSH 터널 / Tailscale Serve): [Remote access](/gateway/remote) 및 [Tailscale](/gateway/tailscale)
- 상시 가동 / VPN 설정: [Remote access](/gateway/remote), [exe.dev](/platforms/exe-dev), [Hetzner](/platforms/hetzner), [macOS remote](/platforms/mac/remote)

---

## 한국 사용자를 위한 채널

한국에서 Moltbot을 사용하는 경우 다음 채널을 권장합니다:

### KakaoWork (카카오워크)

기업용 메시징 플랫폼. 플러그인 설치:

```bash
moltbot plugins install @hanishkeloth/moltbot-kakao
```

설정:
```jsonc
{
  "channels": {
    "kakao": {
      "enabled": true,
      "appKey": "카카오워크_앱_키",
      "dmPolicy": "pairing"
    }
  }
}
```

문서: [KakaoWork](/channels/kakao)

### LINE (라인)

일본/대만/태국 시장을 위한 메시징 API:

```bash
moltbot plugins install @moltbot/line
```

문서: [LINE](/channels/line)

### Telegram (텔레그램)

한국에서도 인기 있는 메시징 앱:

문서: [Telegram](/channels/telegram)
