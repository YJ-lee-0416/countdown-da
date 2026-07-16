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

[반응형 개선 로직 - 핵심]
이전 버전은 SVG 캔버스를 항상 780px 고정폭으로 그리고, 그 안에 실제 텍스트/박스보다
훨씬 넓은 좌우 여백을 두었음. <img> 태그는 style="width:100%;max-width:780px"로 렌더링되므로,
브라우저는 이 SVG를 "화면에 표시되는 폭"에 맞게 통째로 확대·축소함. 이때 불필요한 여백까지
포함해 780px 기준으로 축소·확대가 이뤄지다 보니, 실제 텍스트·박스가 차지하는 시각적 크기는
PC에서도 다소 작고 모바일에서는 더욱 작아지는 문제가 있었음.

이번 버전은 캔버스 폭 자체를 "실제 콘텐츠(텍스트/타이머 박스)가 필요로 하는 최소 폭 + 여백"
수준으로 타이트하게 줄임. 그 결과 이미지의 원본 가로세로 비율이 콘텐츠에 맞게 좁아지고,
<img>가 style에 따라 최대 780px까지 확대되어 표시될 때 실제 콘텐츠가 차지하는 시각적 크기가
전보다 커짐. 이는 기기(User-Agent) 판별 없이도 PC·모바일 모두에서 동일한 원리로 자연스럽게
더 크게 보이는 순수 반응형(CSS 확대·축소) 방식임.
*/

const START = new Date('2026-07-17T00:00:00+09:00');
const END = new Date('2026-07-18T00:00:00+09:00'); // 7월 17일 24시 = 7월 18일 00시

function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function escapeXml(str) {
  return str.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

// 한글/영문 혼용 텍스트의 대략적인 폭을 추정 (SVG 서버 렌더링 환경에는
// 실제 폰트 메트릭 측정 API가 없어, 문자 1개당 font-size의 약 1.05배로 근사함)
function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * 1.05;
}

export default function handler(req, res) {
  // 참고: Date 객체는 내부적으로 항상 UTC 절대시각을 저장하므로,
  // START/END처럼 +09:00을 명시한 값과 직접 비교하면 별도의 시간대 변환이 필요 없음.
  const now = new Date();

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

  // ── 디자인 규격 (기존 대비 확대) ──
  const subFont = 20;
  const headFont = 27;
  const boxSize = 78;
  const gap = 16;
  const valFont = 33;
  const lblFont = 13;
  const colonFont = 27;
  const sidePadding = 36; // 카드 좌우 최소 여백

  // 콘텐츠 폭 계산: 헤드 문구("단 하루! " + headText), 부제목, 박스 행 중 가장 넓은 값 기준
  const headFullText = `단 하루! ${headText}`;
  const headWidth = estimateTextWidth(headFullText, headFont);
  const subWidth = estimateTextWidth(subText, subFont);
  const boxRowWidth = units.length * boxSize + (units.length - 1) * gap;

  const contentWidth = Math.max(headWidth, subWidth, boxRowWidth);
  const canvasWidth = Math.round(contentWidth + sidePadding * 2);

  const boxY = 96;
  const canvasHeight = boxY + boxSize + 24;

  const startX = (canvasWidth - boxRowWidth) / 2;

  const boxesSvg = units.map((unit, i) => {
    const x = startX + i * (boxSize + gap);
    const colon = i < units.length - 1
      ? `<text x="${x + boxSize + gap / 2}" y="${boxY + boxSize / 2 + 8}" font-family="sans-serif" font-size="${colonFont}" font-weight="700" fill="#c3cbd3" text-anchor="middle">:</text>`
      : '';
    return `
      <rect x="${x}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="10" fill="#2196f3"/>
      <text x="${x + boxSize / 2}" y="${boxY + boxSize / 2 + valFont * 0.35}" font-family="sans-serif" font-size="${valFont}" font-weight="700" fill="#ffffff" text-anchor="middle">${unit[0]}</text>
      <text x="${x + boxSize / 2}" y="${boxY + boxSize - 8}" font-family="sans-serif" font-size="${lblFont}" font-weight="600" fill="rgba(255,255,255,0.85)" text-anchor="middle">${unit[1]}</text>
      ${colon}
    `;
  }).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
      <rect x="0.5" y="0.5" width="${canvasWidth - 1}" height="${canvasHeight - 1}" rx="14" fill="#ffffff" stroke="#e7ebef"/>
      <text x="${canvasWidth / 2}" y="40" font-family="sans-serif" font-size="${subFont}" font-weight="600" fill="#8a94a0" text-anchor="middle">${escapeXml(subText)}</text>
      <text x="${canvasWidth / 2}" y="72" font-family="sans-serif" font-size="${headFont}" font-weight="700" text-anchor="middle">
        <tspan fill="#111111">단 하루!</tspan>
        <tspan fill="#2196f3"> ${escapeXml(headText)}</tspan>
      </text>
      ${boxesSvg}
    </svg>
  `.trim();

  res.setHeader('Content-Type', 'image/svg+xml');
  res.status(200).send(svg);
}
