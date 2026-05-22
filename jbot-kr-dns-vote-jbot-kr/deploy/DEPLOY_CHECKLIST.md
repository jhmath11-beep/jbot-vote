# vote.jbot.kr 배포 체크리스트

## 1. 서버 준비

추천 시작 구성:

- Ubuntu 24.04 LTS VPS
- Node.js 20 이상
- Nginx
- 방화벽 80, 443 허용
- 앱 위치: `/opt/jbot-vote`

## 2. 서버에 파일 올리기

서버에서 앱 폴더를 만듭니다.

```bash
sudo mkdir -p /opt/jbot-vote
sudo chown -R $USER:$USER /opt/jbot-vote
```

이 프로젝트 파일 전체를 `/opt/jbot-vote`에 업로드합니다.

## 3. 관리자 비밀번호 설정

`deploy/jbot-vote.service` 파일의 아래 값을 반드시 바꿉니다.

```text
Environment=ADMIN_PASSWORD=change-this-admin-password
```

예:

```text
Environment=ADMIN_PASSWORD=학교에서정한강한비밀번호
```

## 4. systemd 서비스 등록

```bash
sudo cp /opt/jbot-vote/deploy/jbot-vote.service /etc/systemd/system/jbot-vote.service
sudo systemctl daemon-reload
sudo systemctl enable jbot-vote
sudo systemctl start jbot-vote
sudo systemctl status jbot-vote
```

## 5. Nginx 연결

```bash
sudo cp /opt/jbot-vote/deploy/nginx-vote.jbot.kr.conf /etc/nginx/sites-available/vote.jbot.kr
sudo ln -s /etc/nginx/sites-available/vote.jbot.kr /etc/nginx/sites-enabled/vote.jbot.kr
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 가비아 DNS 설정

가비아 DNS 관리툴에서 아래 레코드를 추가합니다.

| 타입 | 호스트 | 값 |
|---|---|---|
| A | vote | 서버 공인 IPv4 주소 |

가비아 고객센터 안내 기준으로 DNS 레코드는 `My가비아 > 서비스 관리 > DNS 관리툴`에서 설정합니다.

## 7. HTTPS 적용

DNS가 서버로 연결된 뒤 Certbot으로 인증서를 발급합니다.

```bash
sudo certbot --nginx -d vote.jbot.kr
```

완료 후 아래 주소로 접속합니다.

```text
https://vote.jbot.kr
```

## 8. 운영 전 점검

- 관리자 비밀번호 변경 여부 확인
- 테스트 투표 생성
- 투표권 코드로 1회만 투표되는지 확인
- 무기명 투표에서 결과와 참여 확인표가 분리되는지 확인
- 결과 PDF 저장 확인
- `data/state.json` 백업 위치 확인

## 9. 백업

최소한 운영 전후로 아래 파일을 따로 보관합니다.

```text
/opt/jbot-vote/data/state.json
```

학교 실제 선거에 쓰기 전에는 서버 자동 백업 또는 수동 다운로드 절차를 정해두세요.
