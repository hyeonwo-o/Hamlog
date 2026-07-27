# HamLog (Technical Blog)

Node.js(Express) 백엔드와 React(Vite) 프론트엔드로 구성된 기술 블로그 프로젝트입니다.  
복잡한 RDBMS 없이 **파일 시스템의 JSON 파일을 데이터 저장소로 사용**하여 가볍고 이식성이 뛰어난 것이 특징입니다.

## Architecture
- **Frontend**: `src/` (React + Vite)
- **Backend**: `server/` (Express API + 정적 파일 서빙)
- **Storage**: `server/data/` (JSON, 조회수 분리 저장), `server/uploads/` (이미지 업로드)
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
- Node.js 24, npm 11

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

### 5) Data Integrity Check
`posts.json` 인덱스와 `server/data/posts/*.json` 개별 글 파일이 서로 맞는지 확인합니다.

```bash
npm run verify:data
```

## Environment Variables
### Backend (`server`)
- `PORT` (default: `4000`)
- `APP_VERSION` (optional)
  - `/api/health`에 노출할 배포 버전. 운영 GitHub Actions는 커밋 SHA 앞 7자를 자동 주입합니다.
- `HAMLOG_DATA_DIR` (optional, default: `server/data`)
  - JSON 저장 경로. 테스트는 실제 데이터를 보호하기 위해 `.tmp` 경로로 재지정합니다.
- `HAMLOG_UPLOAD_DIR` (optional, default: `server/uploads`)
  - 업로드 파일 저장 경로
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
- `RATE_LIMIT_SEARCH_MAX` (optional, default: `180`)
- `RATE_LIMIT_COMMENT_MAX` (optional, default: `20`)
- `RATE_LIMIT_VIEW_MAX` (optional, default: `240`)
- `TRUST_PROXY` (optional, default: `0`)
  - Express 앞에 신뢰할 수 있는 reverse proxy가 있을 때만 hop 수 또는 IP/subnet을 지정
  - 예: 프록시가 정확히 한 단계면 `1`, 직접 노출이면 `0`
- `GOOGLE_SITE_VERIFICATION` (optional)
  - Search Console의 HTML 태그 인증을 사용할 때 메타 태그 content 값
  - 예: Search Console이 `<meta name="google-site-verification" content="abc123" />`를 주면 `abc123`
- `NAVER_SITE_VERIFICATION` (optional)
  - 네이버 서치어드바이저 HTML 태그 인증의 content 값
- `DAUM_SITE_VERIFICATION` (optional)
  - 다음/카카오 검색 등록에서 HTML 메타 태그 인증을 사용할 때의 content 값
- `DAUM_WEBMASTER_PIN` (optional)
  - 다음 웹마스터도구 PIN 인증을 사용할 때 `/robots.txt`에 `DaumWebMasterTool: <PIN>` 형식으로 노출
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
- 발행 설정 열기: `Ctrl/Cmd+Enter`
- 미리보기 토글: `Alt+Shift+P`

본문에서 `/`를 입력하거나 툴바의 `/` 버튼을 누르면 수식, Mermaid 다이어그램, 유튜브, 링크 카드,
표와 2·3단 레이아웃 같은 고급 블록을 삽입할 수 있습니다.

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
`.env.example`을 복사한 뒤 `JWT_SECRET`, `ADMIN_PASSWORD`를 반드시 변경해야 합니다.
운영 컨테이너는 두 값이 없으면 시작하지 않습니다.

파일 저장소의 쓰기 잠금은 단일 Node.js 프로세스 안에서만 유효합니다. 여러 컨테이너나
여러 호스트가 동시에 쓰는 구성에는 SQLite/PostgreSQL 같은 공유 데이터베이스를 사용해야 합니다.

## CI/CD (GitHub Actions)
`.github/workflows/docker-deploy.yml`
- `main` push 시 Docker 이미지를 빌드하여 GHCR에 업로드
- Self-Hosted Runner가 운영 서버에서 최신 이미지를 pull/run (포트 4000)
- 배포 전 `$HOME/hamlog-data`를 `$HOME/hamlog-backups`에 백업하고 14일간 보관
- 새 컨테이너의 로컬 및 `SITE_URL` 공개 헬스 응답에서 커밋 버전을 확인
- 헬스체크 실패 시 직전 Docker 이미지로 자동 롤백
- 컨테이너 로그는 파일당 10MB, 최대 3개로 회전
- GitHub 호스티드 러너가 15분마다 홈·헬스 API를 외부에서 점검

외부 점검 주소를 바꾸려면 Repository Variable `PUBLIC_SITE_URL`을 설정합니다.
미설정 시 `https://tech.hamwoo.co.kr`을 사용합니다.

## Backup and Restore

운영 배포는 데이터와 업로드를 잠시 멈춘 뒤 일관된 `tar.gz` 백업과 SHA-256 체크섬을 생성합니다.
수동 백업도 같은 스크립트를 사용할 수 있습니다.

```bash
BACKUP_RETENTION_DAYS=14 \
  bash scripts/backup-data.sh "$HOME/hamlog-data" "$HOME/hamlog-backups"
```

복구 전에는 체크섬과 압축 파일을 먼저 검증합니다.

```bash
cd "$HOME/hamlog-backups"
sha256sum -c hamlog-YYYYMMDDTHHMMSSZ-SHA.tar.gz.sha256

docker stop hamlog
tar -xzf hamlog-YYYYMMDDTHHMMSSZ-SHA.tar.gz -C "$HOME/hamlog-data"
docker start hamlog
```

이 백업은 동일 호스트의 배포·데이터 손상 복구용입니다. 호스트 장애에 대비하려면
`$HOME/hamlog-backups`를 별도의 암호화된 오브젝트 스토리지나 백업 서버로 동기화해야 합니다.

## Recommended Branch Protection

GitHub의 `main`과 `develop`에 다음 보호 규칙을 적용하는 것을 권장합니다.

- Pull Request를 통한 변경만 허용
- 병합 전 최신 CI 상태 검사 필수
- 강제 푸시와 브랜치 삭제 금지
- `main`은 운영 환경 승인 또는 지정 관리자 병합만 허용
