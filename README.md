# RemoteCon

터미널 세션을 모바일 브라우저에서 실시간으로 제어하는 도구입니다.

## 구조

```
remotecon (CLI)  ←→  Hub 서버  ←→  모바일 브라우저
```

- **remotecon CLI**: 터미널에서 실행. 셸을 열고 Hub 서버를 통해 모바일로 미러링.
- **Hub 서버**: Google OAuth 인증 및 WebSocket 중계. 별도 서버에 배포.
- **모바일 웹**: Hub 서버에 접속, Google 로그인 후 세션 목록 확인 및 제어.

---

## 설치 (사용자)

### 1. 소스코드 다운로드

```bash
git clone https://github.com/your-username/remotecon.git
cd remotecon
```

### 2. CLI 전역 설치

```bash
npm install -g ./packages/cli
```

### 3. 사용

```bash
# 현재 디렉토리명으로 세션 시작
remotecon

# 세션명 지정
remotecon my-project

# Google 계정으로 로그인 (첫 실행 시 자동으로 안내됨)
remotecon login

# 로그아웃
remotecon logout
```

모바일에서 `https://your-hub.railway.app` 접속 → Google 로그인 → 세션 목록 확인.

---

## Hub 서버 배포 (운영자)

### 1. 환경변수 설정

```bash
cd packages/hub
cp .env.example .env
# .env 파일 편집
```

| 변수 | 설명 |
|------|------|
| `GOOGLE_CLIENT_ID` | Google Web OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google Web OAuth 클라이언트 보안 비밀 |
| `GOOGLE_DEVICE_CLIENT_ID` | Google Device Flow 클라이언트 ID |
| `HUB_URL` | 배포된 Hub 서버의 공개 URL |
| `SESSION_SECRET` | 세션 암호화 키 (임의의 긴 문자열) |

### 2. Railway 배포

```bash
cd packages/hub
railway login
railway init
railway up
```

배포 후 Railway 대시보드에서 환경변수 설정.

### 3. CLI config.js 업데이트

`packages/cli/src/config.js`에서 배포된 값으로 업데이트:

```js
module.exports = {
  HUB_URL: 'https://your-hub.railway.app',       // ← 실제 배포 URL
  DEVICE_CLIENT_ID: 'your-device-client-id.apps.googleusercontent.com', // ← Google Cloud 값
};
```

업데이트 후 사용자들은 저장소를 다시 pull 받고 재설치:

```bash
git pull
npm install -g ./packages/cli
```

---

## Google Cloud 설정 (운영자, 최초 1회)

1. [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 생성
2. **API 및 서비스 > OAuth 동의 화면** 설정
3. **사용자 인증 정보 만들기**:
   - **웹 애플리케이션**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 획득
     - 승인된 리디렉션 URI: `https://your-hub.railway.app/auth/google/callback`
   - **TV 및 제한된 입력 기기**: `GOOGLE_DEVICE_CLIENT_ID` 획득
