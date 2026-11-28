/**
 * 후임 로봇 TASS JR.의 '오늘 브리핑' 계산 (화면과 음성 서버가 같이 쓴다).
 * 날짜는 회사 기준인 한국 시간으로 계산한다.
 */

export type BriefOrder = { status: string; dueDate: string | null; itemName: string };
export type BriefSchedule = { title: string };
export type BriefFile = { status: string };
export type BriefRow = { key: string; icon: string; label: string; detail?: string; href: string; urgent?: boolean };
export type Briefing = { rows: BriefRow[]; lines: string[]; speech: string };

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 한국 시간 하루의 시작·끝 (일정 조회용) */
export function kstDayRange(ymd: string) {
  return {
    start: new Date(`${ymd}T00:00:00+09:00`).toISOString(),
    end: new Date(`${ymd}T23:59:59+09:00`).toISOString(),
  };
}

function dayDiff(dateStr: string | null, todayYmd: string): number | null {
  const m = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = todayYmd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !t) return null;
  return Math.round(
    (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(+t[1], +t[2] - 1, +t[3])) / 86400000
  );
}

export function buildBriefing(orders: BriefOrder[], schedules: BriefSchedule[], files: BriefFile[], todayYmd: string): Briefing {
  const open = orders.filter((o) => o.status !== '완료');
  const withDays = open
    .map((o) => ({ o, d: dayDiff(o.dueDate, todayYmd) }))
    .filter((x): x is { o: BriefOrder; d: number } => x.d !== null);
  const overdue = withDays.filter((x) => x.d < 0).sort((a, b) => a.d - b.d);
  const today = withDays.filter((x) => x.d === 0);
  const soon = withDays.filter((x) => x.d >= 1 && x.d <= 3).sort((a, b) => a.d - b.d);
  const waiting = files.filter((f) => f.status === '견적중');

  const rows: BriefRow[] = [];
  const lines: string[] = [];
  const say: string[] = ['선배님! 막내 TASS JR. 오늘 브리핑 들어갑니다~'];

  if (today.length) {
    rows.push({ key: 'today', icon: '⏰', label: `오늘 납기 ${today.length}건`, detail: today.map((x) => x.o.itemName).slice(0, 2).join(', '), href: '/orders', urgent: true });
    lines.push(`오늘 납기 ${today.length}건! ${today[0].o.itemName}`);
    say.push(`오늘 납기가 ${today.length}건 있어요! ${today[0].o.itemName}${today.length > 1 ? ' 외' : ''}요.`);
  }
  if (overdue.length) {
    rows.push({ key: 'overdue', icon: '🚨', label: `납기 지난 수주 ${overdue.length}건`, detail: `${overdue[0].o.itemName} (${-overdue[0].d}일 지남)${overdue.length > 1 ? ' 외' : ''}`, href: '/orders', urgent: true });
    lines.push(`납기 지난 수주가 ${overdue.length}건 있어요`);
    say.push(`납기 지난 수주가 무려 ${overdue.length}건이나 있어요, 얼른 챙겨야 해요!`);
  }
  if (soon.length) {
    rows.push({ key: 'soon', icon: '📦', label: `3일 안에 납기 ${soon.length}건`, detail: soon.map((x) => `${x.o.itemName}(D-${x.d})`).slice(0, 2).join(', '), href: '/orders' });
    lines.push(`3일 안에 납기 ${soon.length}건이에요`);
    say.push(`3일 안에 납기 ${soon.length}건이요.`);
  }
  if (schedules.length) {
    rows.push({ key: 'sched', icon: '🗓', label: `오늘 일정 ${schedules.length}건`, detail: schedules.map((s) => s.title).slice(0, 2).join(', '), href: '/calendar' });
    lines.push(`오늘 일정: ${schedules[0].title}${schedules.length > 1 ? ` 외 ${schedules.length - 1}건` : ''}`);
    say.push(`오늘 일정은 ${schedules.map((s) => s.title).slice(0, 2).join(', ')}${schedules.length > 2 ? ' 등' : ''}이에요.`);
  }
  if (waiting.length) {
    rows.push({ key: 'est', icon: '📄', label: `회신 기다리는 견적서 ${waiting.length}건`, href: '/estimates' });
    lines.push(`회신 기다리는 견적서 ${waiting.length}건 있어요`);
    say.push(`회신 기다리는 견적서도 ${waiting.length}건 있어요.`);
  }
  if (rows.length === 0) {
    lines.push('오늘은 급한 일 없어요 👍');
    say.push('오늘은 급한 일 하나도 없어요! 커피 한 잔 하셔도 돼요~');
  }
  say.push('오늘도 화이팅!');

  return { rows, lines, speech: say.join(' ') };
}

/** 음성 캐시용 짧은 열쇠 (브리핑 내용이 바뀌면 달라짐) */
export function briefingKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
