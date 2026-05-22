# Netlify + Supabase 배포 안내

이 방식은 별도 VPS를 사지 않고 Netlify의 정적 사이트와 Functions, Supabase 데이터베이스를 사용합니다.

## 1. Supabase 프로젝트 만들기

1. Supabase에 로그인합니다.
2. 새 프로젝트를 만듭니다.
3. 프로젝트 비밀번호와 지역을 설정합니다.
4. 프로젝트가 생성되면 `SQL Editor`로 이동합니다.
5. 이 파일을 열어 내용을 복사합니다.

```text
deploy/supabase_schema.sql
```

6. Supabase SQL Editor에 붙여넣고 실행합니다.

## 2. Supabase API 값 확인

Supabase 프로젝트에서 아래 위치로 이동합니다.

```text
Project Settings > API
```

아래 값을 복사해 둡니다.

```text
Project URL
service_role key
```

주의: `service_role key`는 절대 브라우저 코드에 넣으면 안 됩니다. Netlify 환경변수에만 넣습니다.

## 3. Netlify에 사이트 연결

Netlify에서 새 사이트를 만듭니다.

```text
Add new site > Import an existing project
```

GitHub 저장소를 연결한 뒤 설정은 아래처럼 둡니다.

```text
Build command: 비워둠
Publish directory: public
Functions directory: netlify/functions
```

이 프로젝트에는 `netlify.toml`이 들어 있어서 Netlify가 자동으로 인식할 수 있습니다.

## 4. Netlify 환경변수 설정

Netlify 사이트 설정에서 이동합니다.

```text
Site configuration > Environment variables
```

아래 3개를 추가합니다.

```text
ADMIN_PASSWORD=관리자비밀번호
SUPABASE_URL=Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=Supabase service_role key
```

환경변수 저장 후 다시 배포합니다.

## 5. Netlify 기본 주소에서 테스트

먼저 Netlify가 제공하는 기본 주소에서 테스트합니다.

```text
https://사이트이름.netlify.app
```

확인할 것:

- 관리자 로그인
- 투표 생성
- 투표권 코드 제출
- 중복투표 차단
- 결과 확인
- CSV/PDF 저장

## 6. vote.jbot.kr 연결

Netlify에서 도메인을 추가합니다.

```text
Site configuration > Domain management > Add a domain
```

아래 도메인을 추가합니다.

```text
vote.jbot.kr
```

Netlify가 안내하는 DNS 값을 확인합니다.

가비아 DNS 관리툴에서 보통 아래처럼 추가합니다.

| 타입 | 호스트 | 값 |
|---|---|---|
| CNAME | vote | Netlify가 안내한 주소 |

Netlify가 A 레코드를 안내하면 Netlify 화면에 나온 값을 그대로 따르세요.

## 7. HTTPS 확인

DNS가 연결되면 Netlify가 HTTPS 인증서를 자동으로 발급합니다.

최종 접속 주소:

```text
https://vote.jbot.kr
```

## 8. 운영 전 주의

- `SUPABASE_SERVICE_ROLE_KEY`는 외부에 공개하지 않습니다.
- 투표 전후로 Supabase의 `app_state` 내용을 백업합니다.
- 실제 선거 전에는 반드시 2~3명으로 테스트 투표를 진행합니다.
- 같은 시간에 매우 많은 사용자가 동시에 투표하는 경우에는 데이터 저장 방식을 JSON 1개에서 개별 투표 행 저장 방식으로 고도화하는 것이 좋습니다.
