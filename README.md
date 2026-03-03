# RemoteCon v2

터미널 세션을 모바일 브라우저에서 실시간으로 제어하는 도구.

```
remotecon CLI  ←→  Hub 서버 (Express + SQLite)  ←→  React 웹 (모바일/데스크탑)
```

## 주요 기능

- Google OAuth 인증 (모바일 웹 + CLI Device Flow)
- 다중 세션 탭 (독립 WebSocket + xterm.js)
- 세션 녹화/재생 (asciicast v2, gzip 압축)
- 웹훅 알림 (정규식 패턴 매칭 → HTTP POST)
- Tokyo Night 테마

---

## 모노레포 구조

```
packages/
  hub/          Express 백엔드 (SQLite, WebSocket 중계, REST API)
  web/          React + Vite 프론트엔드
  cli/          CLI 클라이언트 (node-pty, Device Flow OAuth)
```

---

## 빠른 시작

### 1. 의존성 설치

```bash
git clone https://github.com/your-username/remotecon.git
cd remotecon
npm install
```

### 2. Hub 서버 실행

```bash
cd packages/hub
cp .env.example .env
# .env 파일 편집 (아래 환경변수 표 참고)
npm run dev
```

### 3. 프론트엔드 개발 서버

```bash
# 별도 터미널에서
npm run dev:web
```

Vite dev server가 `http://localhost:5173`에서 실행되고, API/WS 요청은 Hub(`:3000`)으로 프록시됩니다.

### 4. CLI 사용

```bash
npm install -g ./packages/cli

remotecon              # 현재 디렉토리명으로 세션 시작
remotecon my-project   # 세션명 지정
remotecon --record     # 녹화 활성화
remotecon login        # Google 인증
remotecon logout       # 로그아웃
remotecon ls           # 활성 세션 목록
remotecon webhooks     # 웹훅 목록
remotecon webhooks add <name> <pattern> <url>
remotecon webhooks rm <id>
```

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google Web OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google Web OAuth 클라이언트 보안 비밀 |
| `GOOGLE_DEVICE_CLIENT_ID` | Google Device Flow 클라이언트 ID |
| `HUB_URL` | Hub 서버 공개 URL |
| `SESSION_SECRET` | 세션 암호화 키 |
| `SQLITE_PATH` | SQLite DB 경로 (기본: `./data/remotecon.db`) |

---

## API

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | `/health` | - | 헬스체크 |
| GET | `/auth/google` | - | OAuth 시작 |
| GET | `/auth/google/callback` | - | OAuth 콜백 |
| POST | `/auth/logout` | session | 로그아웃 |
| GET | `/api/me` | session | 현재 사용자 |
| GET | `/api/sessions` | session | 세션 목록 |
| POST | `/api/sessions` | Bearer | 세션 등록 (CLI) |
| DELETE | `/api/sessions/:id` | session | 세션 강제 종료 |
| POST | `/api/ws-token` | session | WS 토큰 발급 |
| GET | `/api/recordings` | session | 녹화 목록 |
| GET | `/api/recordings/:id/data` | session | 녹화 데이터 |
| DELETE | `/api/recordings/:id` | session | 녹화 삭제 |
| GET | `/api/webhooks` | session | 웹훅 목록 |
| POST | `/api/webhooks` | session | 웹훅 생성 |
| PUT | `/api/webhooks/:id` | session | 웹훅 수정 |
| DELETE | `/api/webhooks/:id` | session | 웹훅 삭제 |

### WebSocket

- `/ws/terminal?sessionId=<id>` — CLI 연결 (Authorization: Bearer)
- `/ws/session/<id>?token=<token>` — 브라우저 연결 (단기 토큰)

Binary 프레임: PTY 데이터. Text 프레임: JSON `{ type, ... }` (input, resize, status, session_info).

---

## 배포 (Railway)

```bash
cd packages/hub
railway login
railway init
railway up
```

`railway.toml`이 빌드 시 웹 프론트엔드를 자동으로 빌드합니다. Railway 볼륨을 `SQLITE_PATH`에 마운트하면 DB가 영속됩니다.

---

## Google Cloud 설정

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 생성
2. OAuth 동의 화면 설정
3. 사용자 인증 정보:
   - **웹 애플리케이션**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
     - 승인된 리디렉션 URI: `https://<hub-url>/auth/google/callback`
   - **TV 및 제한된 입력 기기**: `GOOGLE_DEVICE_CLIENT_ID`

---

## 데이터베이스

SQLite (better-sqlite3). 테이블: `users`, `sessions`, `recordings`, `webhooks`, `webhook_logs`. 서버 시작 시 자동 마이그레이션.

인메모리에는 WebSocket 객체, scrollback 버퍼, 진행 중 녹화 프레임, 컴파일된 RegExp 캐시를 보관합니다.

---

## 기술 스택

- **Hub**: Express 5, Passport.js, better-sqlite3, ws
- **Web**: React 18, Vite, React Router v6, Zustand, xterm.js
- **CLI**: node-pty, Google Device Flow OAuth
