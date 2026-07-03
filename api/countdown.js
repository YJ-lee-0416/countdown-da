/*
[최종본] 스페셜딜 실시간 카운트다운 배너 - Vercel 서버리스 함수 버전
플랫폼: Vercel (무료 Hobby 플랜)

경로 규칙: 이 파일이 "api/countdown.js"에 위치하면
  https://[프로젝트명].vercel.app/api/countdown 주소로 응답함

동작 방식:
- 요청이 들어온 "그 순간" 기준으로 D-day를 계산해 SVG 이미지를 그려서 반환함
- 고객이 상세페이지를 열거나 새로고침할 때마다 정확한 잔여시간이 반영됨
- 단, 페이지를 열어둔 채 가만히 보고 있는 동안 초 단위로 저절로 움직이지는
  않음 (오늘의집 편집기가 스크립트 실행을 차단하는 구조적 한계로 인해
  불가피함 — 별도 안내 참고)

원본 배너(Special_Deal_Countdown_Banner_Embed_MIN.html)의 디자인 규격을
그대로 재현함: 흰 배경, 테두리, 모서리 14px, 파란색(#2196f3) 타이머 박스,
회색(#8a94a0) 부제목, 파란색 강조("단 하루!") 헤드 문구

※ 폰트 제약: SVG는 외부 CDN 폰트(Pretendard)를 안정적으로 로드하지
   못하는 환경이 많아 시스템 기본 sans-serif로 대체함. 원본 대비
   글꼴 디테일에는 차이가 있을 수 있음
*/

const START = new Date('2026-07-16T15:00:00+09:00');
const END = new Date('2026-07-17T23:59:00+09:00');

function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function escapeXml(str) {
  return str.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

export default function handler(req, res) {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // 행사 종료 후: 1x1 투명 이미지를 반환하여 배너를 사실상 숨김 처리
  if (now >= END) {
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(transparentPng);
  }

  const phase = now < START ? 'before' : 'during';
  const target = phase === 'before' ? START : END;
  const diffSec = Math.max(0, Math.floor((target - now) / 1000));

  // 초 단위 표기를 없애는 대신, 전체를 "분" 단위로 반올림한 뒤
  // 일/시간/분으로 재환산하여 59→60분, 23→24시간 같은 반올림 오류를 방지함
  const totalMinutes = Math.round(diffSec / 60);
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;

  const subText = phase === 'before'
    ? '스크랩하고 특가 알림 받아보세요!'
    : '한정 특가 놓치지 마세요!';
  const headText = phase === 'before'
    ? '스페셜딜 시작까지'
    : '스페셜딜 종료까지';

  const units = [
    [pad(d), '일'],
    [pad(h), '시간'],
    [pad(m), '분'],
  ];

  // 레이아웃 계산 (원본 CSS 비율을 780px 고정폭 기준으로 환산)
  const boxSize = 64;
  const gap = 12;
  const totalBoxWidth = units.length * boxSize + (units.length - 1) * gap;
  const startX = (780 - totalBoxWidth) / 2;
  const boxY = 92;

  const boxesSvg = units.map((unit, i) => {
    const x = startX + i * (boxSize + gap);
    const colon = i < units.length - 1
      ? `<text x="${x + boxSize + gap / 2}" y="${boxY + boxSize / 2 + 8}" font-family="sans-serif" font-size="22" font-weight="700" fill="#c3cbd3" text-anchor="middle">:</text>`
      : '';
    return `
      <rect x="${x}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="10" fill="#2196f3"/>
      <text x="${x + boxSize / 2}" y="${boxY + 34}" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">${unit[0]}</text>
      <text x="${x + boxSize / 2}" y="${boxY + 52}" font-family="sans-serif" font-size="11" font-weight="600" fill="rgba(255,255,255,0.85)" text-anchor="middle">${unit[1]}</text>
      ${colon}
    `;
  }).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="780" height="180" viewBox="0 0 780 180">
      <rect x="0.5" y="0.5" width="779" height="179" rx="14" fill="#ffffff" stroke="#e7ebef"/>
      <text x="390" y="38" font-family="sans-serif" font-size="16" font-weight="600" fill="#8a94a0" text-anchor="middle">${escapeXml(subText)}</text>
      <text x="390" y="66" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">
        <tspan fill="#111111">단 하루!</tspan>
        <tspan fill="#2196f3"> ${escapeXml(headText)}</tspan>
      </text>
      ${boxesSvg}
    </svg>
  `.trim();

  res.setHeader('Content-Type', 'image/svg+xml');
  res.status(200).send(svg);
}
