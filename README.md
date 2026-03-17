# HamLog (Technical Blog)

Node.js(Express) 백엔드와 React(Vite) 프론트엔드로 구성된 기술 블로그 프로젝트입니다.  
복잡한 RDBMS 없이 **파일 시스템의 JSON 파일을 데이터 저장소로 사용**하여 가볍고 이식성이 뛰어난 것이 특징입니다.

## Architecture
- **Frontend**: `src/` (React + Vite)
- **Backend**: `server/` (Express API + 정적 파일 서빙)
- **Storage**: `server/data/` (JSON), `server/uploads/` (이미지 업로드)
- **Prod Serving**: 백엔드가 `dist/` 정적 자산을 서빙하고 SPA fallback을 제공합니다. (`server/app.js`)

## Tech Stack
- **Frontend**: React, Vite, TypeScript
- **Styling**: TailwindCSS
- **State**: Zustand
- **Editor**: Tiptap (Headless WYSIWYG)
- **Backend**: Node.js(Express), JWT(Auth cookie)
- **Infra**: Docker, GitHub Actions, Self-Hosted Runner(옵션)

## Key Features
- **Admin 글쓰기/관리**: Tiptap 기반 편집, 이미지 업로드/붙여넣기, 미리보기
- **자동 목차(TOC)**: 글 본문의 `h1/h2/h3` 기반 TOC 생성 + 스크롤 스파이
- **검색/필터링**: 카테고리/태그/검색 기반 탐색
- **SEO**: 메타/OG, 라우트 기반 메타 주입, 사이트맵/RSS
- **보안**: JWT 인증(쿠키), CORS 제어, Rate Limit, 링크 프리뷰 SSRF 방어

## Local Development
### Prerequisites
- Node.js 20+ 권장

### 1) Install
```bash
npm ci
```

### 2) Run (Dev)
터미널 2개를 사용합니다.

```bash
# API server (http://localhost:4000)
npm run server
```

```bash
# Vite dev server (http://localhost:5173)
npm run dev
```

Vite는 기본적으로 `/api`, `/uploads`를 `http://localhost:4000`으로 프록시합니다. (`vite.config.ts`)

### 3) Build
```bash
npm run build
```

### 4) Test
```bash
npm run test
```

## Environment Variables
### Backend (`server`)
- `PORT` (default: `4000`)
- `JWT_SECRET`
  - production에서는 **필수**
- `ADMIN_PASSWORD`
  - production에서는 **필수**
- `CORS_ORIGINS` (optional)
  - 허용할 Origin 목록을 콤마(`,`)로 구분
  - 예: `https://hamlog.com,https://www.hamlog.com`
- `RATE_LIMIT_LOGIN_MAX` (optional, default: `10`)
- `RATE_LIMIT_UPLOAD_MAX` (optional, default: `30`)
- `RATE_LIMIT_PREVIEW_MAX` (optional, default: `120`)
- `COOKIE_SAME_SITE` (optional: `lax`, `strict`, `none`)
  - 미설정 시 `CORS_ORIGINS`가 있으면 `none`, 아니면 `lax`
- `COOKIE_SECURE` (optional: `true`, `false`)
  - 미설정 시 HTTPS 요청 또는 `SameSite=None`일 때 `true`

관리자 프론트엔드와 API가 서로 다른 Origin에 있다면 `CORS_ORIGINS`를 반드시 설정해야 하며,
대부분의 경우 쿠키는 `SameSite=None; Secure`가 필요합니다. 현재 서버는 이 경우를 자동으로 맞추도록 되어 있습니다.
같은 Origin에서 `http://<ip>:4000/admin`처럼 직접 접속하는 환경은 기본적으로 `Secure`를 끄고 동작합니다.

### Frontend (`vite`)
- `VITE_API_BASE_URL` (optional)
  - 기본값은 `'/api'`이며, dev에서는 Vite proxy로 백엔드에 연결됩니다.

## Editor Guide (Admin)
### Shortcuts
- 저장: `Ctrl/Cmd+S`
- 초안 저장: `Ctrl/Cmd+Shift+S`
- 발행: `Ctrl/Cmd+Enter`
- 미리보기 토글: `Alt+Shift+P`

### Autosave
편집 중 자동 저장본이 남아있으면 관리자 화면에서 **복구/삭제**가 가능합니다.

## TOC Placement (Post Page)
포스트 읽기 화면은 큰 화면에서만 우측에 TOC를 표시합니다.  
현재 정책은 `2xl` 이상에서만 TOC 사이드바가 나타나도록 되어 있습니다. (`src/pages/PostPage.tsx`)

## Docker
### docker-compose (추천)
```bash
docker compose up -d --build
```

`docker-compose.yml`은 아래를 볼륨으로 마운트합니다.
- `./server/data:/app/server/data`
- `./server/uploads:/app/server/uploads`

환경변수는 `.env`를 사용합니다. (`docker-compose.yml`)

## CI/CD (GitHub Actions)
`.github/workflows/docker-deploy.yml`
- `main` push 시 Docker 이미지를 빌드하여 GHCR에 업로드
- Self-Hosted Runner가 운영 서버에서 최신 이미지를 pull/run (포트 4000)
