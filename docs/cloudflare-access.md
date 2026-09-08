# Cloudflare Access 관리자 로그인

## 동작

`AUTH_MODE=cloudflare-access`에서는 앱 비밀번호 로그인과 기존 `token` 쿠키를 사용하지 않습니다.
관리자 화면은 `/admin/api/*`로 요청하여 Access의 경로 보호를 계속 거칩니다. 서버도 매 요청마다
`Cf-Access-Jwt-Assertion`의 RS256 서명, 팀 issuer, 앱 audience, 만료 시간, 사용자 신원을 검증합니다.
이메일 헤더만 신뢰하거나 브라우저에 별도 장기 관리자 토큰을 발급하지 않습니다.
공개 `/api/*`는 유지하며, 그 경로의 관리자 작업도 같은 서버 인증을 통과해야 합니다.

Access 공개키는 지정한 팀의 인증서 엔드포인트에서만 가져오고 제한된 시간 동안 캐시합니다.
인증 실패나 키 조회 장애 시 비밀번호로 자동 전환하지 않습니다. 로그아웃은 기존 앱 쿠키를 삭제한 뒤
`/cdn-cgi/access/logout`으로 이동하여 Access 세션도 종료합니다.

## 운영 전환 전 확인

1. 동일한 Access 앱이 `tech.hamwoo.co.kr/admin`과 `/admin/*`를 모두 보호해야 합니다.
   특히 `/admin/api/auth/me`에도 적용되어야 합니다. 인증하지 않은 브라우저로 직접 접속하여 확인합니다.
2. Allow 정책은 지정한 관리자 계정만 허용합니다. Everyone, 전체 이메일 도메인, Bypass 규칙은 사용하지 않습니다.
   이 앱의 인증을 통과한 사용자는 모두 HamLog 관리자입니다.
3. 공개 홈, 게시글, `/api/*`, 사이트맵과 RSS는 Access 로그인으로 막지 않습니다.
4. Cloudflare Tunnel 또는 방화벽으로 원본 우회 접근을 제한합니다. Docker 포트의 loopback 기본값을 유지합니다.
   서버의 JWT 검증은 우회 요청도 차단하지만, 서명 검증만으로 Access 정책 변경/토큰 폐기를 실시간 조회하지는 않습니다.
   따라서 관리자 API도 반드시 Access를 통과해야 합니다.
5. 관리자와 API는 같은 HTTPS 도메인에서 제공합니다. 프록시는 Access assertion 헤더를 서버에 전달해야 합니다.
6. `/admin*` 및 인증된 API 응답에 Cache Everything 규칙을 적용하지 않습니다. 앱은 인증 응답에 `no-store`를 설정합니다.

## 이 블로그의 설정값

GitHub Actions 배포에서는 저장소 Variables에 아래 세 값을 설정합니다. AUD와 팀 도메인은 비밀 키가 아닙니다.

```dotenv
AUTH_MODE=cloudflare-access
CLOUDFLARE_ACCESS_TEAM_DOMAIN=techhamwoo.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=10d251866cbee316730109479c55015a062851c97b14f5a7f14fa2eaf157d16b
```

Compose/수동 설치에서는 같은 값을 환경변수로 전달합니다. `ADMIN_PASSWORD`는 Access 모드에서 불필요합니다.
`JWT_SECRET`은 방문 통계 해시에도 사용하므로 기존 값을 유지합니다. 로컬 개발 및 기본 CI는 `AUTH_MODE=password`로
기존 로그인 테스트를 유지합니다. Access 검증 테스트는 격리된 테스트 키를 사용하며 실제 계정/토큰은 사용하지 않습니다.

Variables만 변경해도 이미 실행 중인 서버가 자동 변경되지는 않습니다. 새 코드 배포 후 아래를 확인합니다.

- 공개 `/api/auth/config`가 `cloudflare-access`를 반환하고, 홈과 게시글은 비로그인으로 읽힙니다.
- Access 로그인 후 앱 비밀번호 없이 에디터가 열리고 저장·이미지 업로드가 동작합니다.
- 비로그인 또는 만료된 토큰으로 관리자 API에 접근하면 거부됩니다.
- 로그아웃 후 관리자 화면 재접근 시 Access 인증을 거칩니다. IdP의 SSO 정책에 따라 재입력이 생략될 수 있습니다.

문제가 생기면 기존 컨테이너로 롤백합니다. 비밀번호 방식으로 되돌릴 경우 `AUTH_MODE=password`와 기존
`ADMIN_PASSWORD`를 함께 복구한 뒤 재배포합니다. 자동 비밀번호 fallback은 없습니다.

참고: [토큰 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[세션·로그아웃](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/).
