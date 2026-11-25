import * as xlsx from 'xlsx';
import { PROCESS_STEPS } from './estimateFiles';

export type ParsedEstimate = {
  projectName: string;
  /** 파일 안에서 공사명을 찾았는지 (못 찾으면 파일 이름으로 대신함) */
  projectNameFound: boolean;
  partnerName: string | null;
  quantity: number;
  amount: number | null;
  estimateDate: string | null;
  deliveryTerm: string | null;
  docNo: string | null;
  /** 파일에 ■/□ 공정 표시가 있으면 진행할 공정 목록, 없으면 null */
  processSteps: string[] | null;
};

type Cell = { text: string; raw?: unknown };
type Line = Cell[];

const squash = (s: string) => s.replace(/\s+/g, '');

const CHECKED = '■☑✅✔✓▣◼';
const STEP_MARK_RE = new RegExp(`([${CHECKED}□☐◻])\\s*(${PROCESS_STEPS.join('|')})`, 'g');

// 칸 맨 앞의 "1." 같은 번호와 라벨 뒤 "(Work Name):" 같은 영문 표기·콜론까지 라벨로 본다
// 글자 사이 띄어쓰기("공 사 명")를 허용
const spaced = (word: string) => word.split('').join('\\s*');
const label = (...words: string[]) =>
  new RegExp(`^\\s*(\\d+\\s*[.)]\\s*)?(${words.map(spaced).join('|')})\\s*(\\([^)]*\\))?\\s*[:：]?`, 'i');

const LABELS = {
  project: label('공사명', '건명', '프로젝트명'),
  partner: label('업체명', '수신처', '수신', '거래처'),
  delivery: label('납품기한', '납기일', '납기:', '예상제작기간', '제작기간', 'delivery'),
  docNo: label('문서번호'),
  total: label('최종합계', '총합계', '합계금액', '견적금액', '발주금액'),
  // "문서번호 : TA250910-2 일자 : 2025-09-10" 처럼 한 칸 가운데 있는 일자도 찾는다
  date: /(^|\s)(작\s*성\s*|견\s*적\s*)?일\s*자\s*[:：]?/,
};

// 다른 항목의 라벨 — 값 칸이 비어 있을 때 옆 라벨을 값으로 잘못 읽지 않도록 여기서 멈춘다
const LABELISH = /^(\d+[.)])?(담당자|연락처|메일|업체명|상호|일자|작성일자|문서번호|납품기한|지불조건|결제|유효기간|비고|대표|등록번호|tel\.?|fax)/i;
const isLabelish = (t: string) => LABELISH.test(squash(t)) || /^(tass|타스)$/i.test(squash(t));

/** 라벨 칸 다음에 오는 값 (같은 칸 안에 붙어 있으면 그 뒤 글자) */
function valueAfter(lines: Line[], re: RegExp, accept: (c: Cell) => boolean = (c) => !!c.text.trim()): Cell | null {
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const m = line[i].text.match(re);
      if (!m) continue;
      const rest = line[i].text.slice((m.index ?? 0) + m[0].length).trim();
      if (rest && accept({ text: rest })) return { text: rest };
      for (let j = i + 1; j < line.length; j++) {
        if (isLabelish(line[j].text)) break;
        if (accept(line[j])) return line[j];
      }
    }
  }
  return null;
}

function toDateString(cell: Cell | null): string | null {
  if (!cell) return null;
  if (typeof cell.raw === 'number' && cell.raw > 30000 && cell.raw < 80000) {
    // 엑셀 날짜 일련번호 → YYYY-MM-DD
    return new Date(Date.UTC(1899, 11, 30) + Math.round(cell.raw) * 86400000).toISOString().slice(0, 10);
  }
  const t = cell.text;
  let m = t.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/); // 엑셀 기본 m/d/yy
  if (m) return `20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

function toAmount(cell: Cell | null): number | null {
  if (!cell) return null;
  if (typeof cell.raw === 'number') return cell.raw > 0 ? cell.raw : null;
  const digits = cell.text.replace(/[^\d]/g, '');
  const n = digits ? Number(digits) : 0;
  return n > 0 ? n : null;
}

function findSteps(lines: Line[]): string[] | null {
  const all = lines.map((l) => l.map((c) => c.text).join(' ')).join('\n');
  const checked = new Set<string>();
  let found = false;
  for (const m of all.matchAll(STEP_MARK_RE)) {
    found = true;
    if (CHECKED.includes(m[1])) checked.add(m[2]);
  }
  return found ? PROCESS_STEPS.filter((s) => checked.has(s)) : null;
}

const normName = (s: string) => s.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|\s+/g, '').toLowerCase();

/** 파일 이름·공사명·수신처에서 거래처 DB 이름을 찾는다 (가장 긴 이름 우선) */
export function guessPartner(texts: string[], partnerNames: string[]): string | null {
  const hay = texts.filter(Boolean).map(normName).join('|');
  let best: string | null = null;
  let bestLen = 0;
  for (const name of partnerNames) {
    const n = normName(name);
    if (n.length < 2 || /^(타스|tass)/i.test(n)) continue; // 우리 회사 이름은 제외
    if (hay.includes(n) && n.length > bestLen) {
      best = name;
      bestLen = n.length;
    }
  }
  return best;
}

/** 공사명을 못 찾았을 때 파일 이름을 제목으로 다듬는다 (예: 250910_세방_견적서_상차작업대.pdf → 상차작업대) */
export function titleFromFileName(fileName: string, partnerName: string | null): string {
  let base = fileName.replace(/\.[^.]+$/, '');
  base = base.replace(/^\d{4,8}[_\-\s.]*/, '');
  base = base.replace(/견적\s*의\s*건|견적\s*서|견적|타스|TASS/gi, ' ');
  if (partnerName) {
    const core = partnerName.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').trim();
    for (const n of [partnerName, core]) if (n) base = base.split(n).join(' ');
  }
  base = base.replace(/[_]+/g, ' ').replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return base || fileName.replace(/\.[^.]+$/, '');
}

/** 엑셀 품목 표에서 품목이 하나뿐이면 그 수량을 쓴다 */
function quantityFromRows(rows: unknown[][]): number {
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const headerIdx = rows.findIndex((r) => r.some((v) => squash(text(v)) === '수량') && r.some((v) => squash(text(v)).includes('품명')));
  if (headerIdx < 0) return 1;
  const header = rows[headerIdx];
  const qtyCol = header.findIndex((v) => squash(text(v)) === '수량');
  const nameCol = header.findIndex((v) => squash(text(v)).includes('품명'));
  const items: number[] = [];
  // 품목 표 범위의 칸만 본다 (오른쪽 계산용 칸의 "합계" 머리글에서 멈추지 않도록)
  const lastCol = Math.max(qtyCol, nameCol) + 3;
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r].slice(0, lastCol);
    if (row.some((v) => /최종합계|NEGO|소계|특기사항/.test(squash(text(v))) || ['합계', '#'].includes(squash(text(v))))) break;
    const name = text(row[nameCol]).trim();
    const q = Number(String(row[qtyCol] ?? '').replace(/[^\d.]/g, ''));
    if (name && q > 0) items.push(q);
  }
  return items.length === 1 ? Math.round(items[0]) : 1;
}

/** 줄 단위 텍스트(엑셀 행 / PDF 줄)에서 견적 정보를 뽑는다 */
export function extractFromLines(lines: Line[], fileName: string, partnerNames: string[], quantity = 1): ParsedEstimate {
  const projectName = valueAfter(lines, LABELS.project)?.text.trim() || '';

  // 받는 곳: "업체명/수신" 칸 값, 또는 "OOO 귀하" 줄
  const partnerCell = valueAfter(lines, LABELS.partner)?.text.trim() || '';
  const recipientText = lines
    .map((l) => l.map((c) => c.text).join(' '))
    .find((t) => /귀\s*하/.test(t))
    ?.replace(/귀\s*하.*$/, '')
    .trim() || '';

  const partnerName = guessPartner([partnerCell, recipientText, fileName, projectName], partnerNames);
  const amount = toAmount(valueAfter(lines, LABELS.total, (c) => /\d/.test(c.text) || typeof c.raw === 'number'));
  // 일자 라벨 옆에 없으면 문서 윗부분에서 처음 나오는 날짜
  const date =
    toDateString(valueAfter(lines, LABELS.date, (c) => !!toDateString(c))) ||
    toDateString(lines.slice(0, 15).flat().find((c) => !!toDateString(c)) ?? null);
  const deliveryTerm = valueAfter(lines, LABELS.delivery)?.text.trim() || null;
  const docNo = valueAfter(lines, LABELS.docNo)?.text.replace(/\s+(작\s*성\s*)?일\s*자.*$/, '').trim() || null;

  return {
    projectName: projectName || titleFromFileName(fileName, partnerName),
    projectNameFound: !!projectName,
    partnerName,
    quantity,
    amount,
    estimateDate: date,
    deliveryTerm,
    docNo,
    processSteps: findSteps(lines),
  };
}

/** 엑셀 견적서 읽기 */
export function parseWorkbook(data: ArrayBuffer, fileName: string, partnerNames: string[]): ParsedEstimate {
  const wb = xlsx.read(data, { type: 'array', cellDates: false });
  let best: { lines: Line[]; rows: unknown[][] } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) continue;
    const texts = xlsx.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
    const raws = xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    const lines: Line[] = texts.map((row, r) =>
      row
        .map((t, c) => ({ text: String(t ?? ''), raw: raws[r]?.[c] }))
        .filter((cell) => cell.text.trim() !== '')
    );
    const hasProject = lines.some((l) => l.some((c) => LABELS.project.test(c.text)));
    if (!best || hasProject) best = { lines, rows: raws };
    if (hasProject) break;
  }
  if (!best) return extractFromLines([], fileName, partnerNames);
  return extractFromLines(best.lines, fileName, partnerNames, quantityFromRows(best.rows));
}

type PdfItem = { str: string; x: number; y: number; w: number; h: number };

/** PDF 글자 조각을 줄(같은 높이)과 칸(띄어진 간격)으로 묶는다 */
export function pdfItemsToLines(items: PdfItem[]): Line[] {
  const sorted = items.filter((it) => it.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const tol = Math.max(2, it.h * 0.45);
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const its = row.items.sort((a, b) => a.x - b.x);
    const cells: Line = [];
    let prev: PdfItem | null = null;
    for (const it of its) {
      const gap = prev ? it.x - (prev.x + prev.w) : Infinity;
      const h = Math.max(it.h, 6);
      if (prev && gap < h * 1.6) {
        cells[cells.length - 1].text += (gap > h * 0.2 ? ' ' : '') + it.str;
      } else {
        cells.push({ text: it.str });
      }
      prev = it;
    }
    return cells.map((c) => ({ text: c.text.trim() })).filter((c) => c.text);
  });
}

/** PDF 견적서 읽기 (브라우저 전용) */
export async function parsePdf(data: ArrayBuffer, fileName: string, partnerNames: string[]): Promise<ParsedEstimate> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const lines: Line[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 10 });
    }
    lines.push(...pdfItemsToLines(items));
  }
  await task.destroy();
  return extractFromLines(lines, fileName, partnerNames);
}

/** 파일 종류에 맞게 읽고, 실패하면 파일 이름만으로 채운다 */
export async function parseEstimateFile(file: File, partnerNames: string[]): Promise<ParsedEstimate> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  try {
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      return parseWorkbook(await file.arrayBuffer(), file.name, partnerNames);
    }
    if (ext === 'pdf') {
      return await parsePdf(await file.arrayBuffer(), file.name, partnerNames);
    }
  } catch (err) {
    console.warn('견적서 내용 읽기 실패, 파일 이름으로 대신합니다:', err);
  }
  return extractFromLines([], file.name, partnerNames);
}
