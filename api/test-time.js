/*
[2번 검증] 동적 생성 이미지 - Vercel 서버리스 함수 버전
플랫폼: Vercel (무료 Hobby 플랜, 카드 등록 불필요, GitHub 계정만 있으면 배포 가능)

이 파일의 배포 경로 규칙(Vercel 고유 규칙):
- 이 파일을 프로젝트 최상위의 "api" 폴더 안에 "test-time.js"라는 이름으로 두면
  자동으로 다음 주소에서 실행됨:
  https://[프로젝트명].vercel.app/api/test-time

- 파일 확장자가 .svg가 아니어도 무방함. 브라우저와 오늘의집 편집기는
  실제 파일 확장자가 아니라 서버가 응답하는 Content-Type 헤더를 보고
  이미지 여부를 판단하기 때문임 (아래 코드에서 image/svg+xml로 지정함)
*/

export default function handler(req, res) {
  // 요청이 들어온 바로 이 순간의 시각을 계산 (한국 시간 기준)
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  const pad = (n) => String(n).padStart(2, '0');
  const timeText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="780" height="120">
      <rect width="780" height="120" rx="14" fill="#2196f3"/>
      <text x="390" y="70" font-family="sans-serif" font-size="40" font-weight="700"
            fill="#ffffff" text-anchor="middle">
        동적 생성 시각: ${timeText}
      </text>
    </svg>
  `.trim();

  // 캐시 없이 매 요청마다 새로 계산되도록 헤더 설정 (Cloudflare 버전과 동일한 목적)
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).send(svg);
}
