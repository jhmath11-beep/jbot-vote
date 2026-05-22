# JBOT 학교 전자투표 서버형 시제품

이 폴더는 `vote.jbot.kr`에 올리기 전 단계의 서버형 전자투표 시제품입니다.

## 실행

```powershell
npm start
```

실행 후 브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## 파일 구조

- `server.js`: Node 기본 HTTP 서버
- `public/index.html`: 사용자/관리자 화면
- `data/state.json`: 투표와 결과가 저장되는 데이터 파일
- `index.html`: 바탕화면에서 바로 열어보는 단일 파일 시제품 원본

## 관리자

- 초기 비밀번호: `jbot2026`
- 서버형 버전에서는 실행 환경변수 `ADMIN_PASSWORD`로 관리자 비밀번호를 지정할 수 있습니다.
- 예: `$env:ADMIN_PASSWORD='새비밀번호'; npm start`
- HTML 파일을 직접 여는 단일 파일 버전에서는 관리자 화면에서 비밀번호를 변경할 수 있습니다.

## 서버 API 구조

- 일반 사용자: 열린 투표 목록 조회와 투표 제출만 가능
- 관리자: 전체 투표 데이터 조회, 생성, 수정, 삭제, 백업/복원 가능
- 무기명 투표: 투표권 사용 여부와 투표 선택 내용이 분리되어 저장됨

## 배포 전 주의

이 버전은 서버형 구조 확인용입니다. 실제 학교 운영용으로 배포할 때는 HTTPS, 서버 관리자 계정, 자동 백업, 접속 로그 정책, 개인정보 처리 안내를 추가해야 합니다.

## vote.jbot.kr 배포 준비

배포용 파일은 `deploy` 폴더에 있습니다.

- `deploy/NETLIFY_SUPABASE_DEPLOY.md`: Netlify + Supabase 배포 순서
- `deploy/supabase_schema.sql`: Supabase 테이블 생성 SQL
- `deploy/jbot-vote.service`: Linux systemd 서비스 예시
- `deploy/nginx-vote.jbot.kr.conf`: Nginx 리버스 프록시 예시
- `deploy/DEPLOY_CHECKLIST.md`: 실제 배포 순서

이미 Netlify를 사용 중이라면 VPS 방식보다 `deploy/NETLIFY_SUPABASE_DEPLOY.md`의 Netlify + Supabase 방식을 먼저 권장합니다.

- Netlify 방식: 가비아 DNS에서 `vote` 호스트를 Netlify가 안내한 CNAME 값으로 연결
- VPS 방식: 가비아 DNS에서 `vote` 호스트의 A 레코드를 서버 공인 IP 주소로 연결
