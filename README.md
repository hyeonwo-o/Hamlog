# HamLog (Technical Blog)

Node.js(Express) 백엔드와 React(Vite) 프론트엔드로 구성된 기술 블로그 프로젝트입니다.  
복잡한 RDBMS 없이 **파일 시스템의 JSON 파일을 데이터 저장소로 사용**하여 가볍고 이식성이 뛰어난 것이 특징입니다.

## Architecture
- **Frontend**: `src/` (React + Vite)
- **Backend**: `server/` (Express API + 정적 파일 서빙)
- **Storage**: `server/data/` (JSON, 조회수·익명 방문 통계 분리 저장), `server/uploads/` (이미지 업로드)
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
- **방문 통계**: 실시간 접속자, 오늘·누적 순 방문자/페이지뷰, 최근 7일 집계
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
API와 Vite는 개발 환경에서 기본적으로 `127.0.0.1`에만 바인딩됩니다.

Tailscale 또는 LAN에 개발 서버를 의도적으로 공개하려면 임시 기본 계정을 사용하지 말고,
두 프로세스에 동일한 명시적 허용 플래그와 별도 비밀값을 전달해야 합니다.

```bash
# 예시는 실제 Tailscale IP와 충분히 긴 임의 값으로 바꿉니다.
HOST=100.64.0.10 HAMLOG_ALLOW_EXTERNAL_DEV=true \
  JWT_SECRET='<random-secret>' ADMIN_PASSWORD='<strong-password>' npm run server

VITE_DEV_HOST=100.64.0.10 HAMLOG_ALLOW_EXTERNAL_DEV=true \
  VITE_DEV_API_TARGET=http://100.64.0.10:4000 \
  JWT_SECRET='<random-secret>' ADMIN_PASSWORD='<strong-password>' npm run dev
```

`npm run dev -- --host 0.0.0.0`처럼 CLI로 호스트를 덮어써도 위 안전 검사를 우회할 수 없습니다.

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
- `HOST` (optional)
  - 개발 기본값은 `127.0.0.1`, production 기본값은 컨테이너 내부 통신을 위한 `0.0.0.0`
- `HAMLOG_ALLOW_EXTERNAL_DEV` (optional, default: `false`)
  - production이 아닌 서버를 loopback 밖에 열 때만 `true`로 지정
  - 이 경우 기본값이 아닌 `JWT_SECRET`, `ADMIN_PASSWORD`도 반드시 필요
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
- `ANALYTICS_SECRET` (optional)
  - 익명 방문자 식별자를 HMAC 처리하는 별도 비밀값. 미설정 시 `JWT_SECRET`을 사용합니다.
  - 값을 바꾸면 기존 방문자는 새 방문자로 집계되므로 운영 중에는 고정하는 것을 권장합니다.
- `ANALYTICS_TIME_ZONE` (optional, default: `Asia/Seoul`)
  - 오늘·일별 방문 통계의 날짜 기준 시간대
- `CORS_ORIGINS` (optional)
  - 허용할 Origin 목록을 콤마(`,`)로 구분
  - 예: `https://hamlog.com,https://www.hamlog.com`
- `RATE_LIMIT_LOGIN_MAX` (optional, default: `10`)
- `RATE_LIMIT_UPLOAD_MAX` (optional, default: `30`)
- `RATE_LIMIT_PREVIEW_MAX` (optional, default: `120`)
- `RATE_LIMIT_SEARCH_MAX` (optional, default: `180`)
- `RATE_LIMIT_COMMENT_MAX` (optional, default: `20`)
- `RATE_LIMIT_VIEW_MAX` (optional, default: `240`)
- `RATE_LIMIT_ANALYTICS_MAX` (optional, default: `1200`)
- `RATE_LIMIT_ANALYTICS_PUBLIC_MAX` (optional, default: `120`)
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
- `VITE_DEV_HOST` (optional, default: `127.0.0.1`)
  - 외부 주소를 지정하면 `HAMLOG_ALLOW_EXTERNAL_DEV=true`와 기본값이 아닌 관리자 비밀값이 필요
- `VITE_DEV_API_TARGET` (optional, default: `http://127.0.0.1:4000`)
  - 개발 프록시가 연결할 API 주소

## Visitor Analytics

공개 홈과 포스트 페이지는 1년 유효의 `HttpOnly` 익명 방문자 쿠키를 사용합니다. 원본 쿠키 ID와
IP는 통계 파일에 저장하지 않고, 서버 비밀값으로 만든 HMAC과 집계 수치만 저장합니다. 일별 데이터는
최근 90일을 보관하며 누적 방문자와 페이지뷰는 계속 유지합니다.

실시간 접속자는 화면이 활성화된 동안 전송되는 30초 heartbeat를 기준으로 최근 90초 이내 방문자를
계산합니다. 이 presence 정보는 프로세스 메모리에 있으므로 서버 재시작 때 초기화되고, 여러 서버
인스턴스 사이에서는 공유되지 않습니다.

공개 화면의 상단 네비게이션에는 누적 방문자와 실시간 접속자만 표시합니다. 오늘 수치와 페이지뷰,
최근 7일 내역은 인증된 관리자 대시보드에서만 조회할 수 있습니다.

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
컨테이너 프로세스는 root가 아닌 Node 사용자로 실행되며, 호스트의 4000번 포트는 기본적으로
`127.0.0.1`에만 열립니다. 같은 호스트의 reverse proxy가 아닌 곳에서 직접 연결해야 하는 명확한
이유가 있을 때만 `.env`의 `HAMLOG_BIND_ADDRESS`를 변경합니다. GitHub Actions 운영 배포는 같은
이름의 Repository Variable을 사용합니다.
Compose는 앱 실행 전에 마운트 권한을 제한적으로 준비합니다. 호스트 기본 그룹 ID가 1000이 아니면
`.env`의 `HAMLOG_DATA_GID`를 `id -g` 결과로 설정합니다.

`bash scripts/setup-server.sh`로 수동 재배포할 때도 기존 `hamlog` 컨테이너가 있으면 중단 전에
데이터를 검증하여 백업합니다. 기본 백업 위치는 `$HOME/hamlog-backups`, 보관 기간은 30일이며
`HAMLOG_BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `HAMLOG_BACKUP_HOOK`으로 기존 백업 정책을 그대로
지정할 수 있습니다. 데이터가 완전히 비어 있는 최초 설치만 `HAMLOG_ALLOW_EMPTY_BACKUP=true`를
명시해야 하며, 백업이나 검증이 실패하면 기존 컨테이너를 건드리지 않고 배포를 중단합니다.

파일 저장소의 쓰기 잠금은 단일 Node.js 프로세스 안에서만 유효합니다. 여러 컨테이너나
여러 호스트가 동시에 쓰는 구성에는 SQLite/PostgreSQL 같은 공유 데이터베이스를 사용해야 합니다.

## CI/CD (GitHub Actions)
`.github/workflows/docker-deploy.yml`
- `main` push 시 Docker 이미지를 빌드하여 GHCR에 업로드
- Self-Hosted Runner가 운영 서버에서 최신 이미지를 pull/run (포트 4000)
- 배포 전 `$HOME/hamlog-data`를 `$HOME/hamlog-backups`에 백업하고 30일간 보관
- 매일 03:17(KST)에 같은 백업을 실행하고 30일간 보관
- 운영 데이터 무결성, 압축 목록, SHA-256 재검증 중 하나라도 실패하면 백업과 배포를 중단
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
BACKUP_RETENTION_DAYS=30 \
  HAMLOG_VERIFY_DATA=true \
  bash scripts/backup-data.sh "$HOME/hamlog-data" "$HOME/hamlog-backups"
```

데이터 디렉터리가 없거나 비어 있으면 기본적으로 실패합니다. 완전한 최초 설치를 확인한 경우에만
`HAMLOG_ALLOW_EMPTY_BACKUP=true`를 명시할 수 있습니다.

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

저장소는 특정 외부 공급자로 데이터를 보내지 않습니다. 오프사이트 저장소와 자격 증명을 선택한 뒤,
self-hosted runner에 아래 계약을 따르는 실행 파일을 설치하고 Repository Variable
`HAMLOG_BACKUP_HOOK`에 그 **절대 경로**를 지정할 수 있습니다.

```text
backup-hook /absolute/path/hamlog-....tar.gz /absolute/path/hamlog-....tar.gz.sha256
```

훅은 업로드와 원격 체크섬 확인까지 성공했을 때 0을 반환해야 합니다. 설정된 훅이 없으면 외부 전송은
일어나지 않으며, 훅이 실패하면 로컬 백업은 보존되지만 해당 백업·배포 작업은 실패 처리됩니다.

## Recommended Branch Protection

GitHub의 `main`과 `develop`에 다음 보호 규칙을 적용하는 것을 권장합니다.

- Pull Request를 통한 변경만 허용
- 병합 전 최신 CI 상태 검사 필수
- 강제 푸시와 브랜치 삭제 금지
- `main`은 운영 환경 승인 또는 지정 관리자 병합만 허용
