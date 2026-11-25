/** 공정관리와 같은 순서의 공정 단계 */
export const PROCESS_STEPS = ['설계', '절단', '가공', '용접', '도장', '조립', '납품'];

/** Vercel 요청 크기 제한(4.5MB) 안쪽 */
export const MAX_ESTIMATE_FILE_BYTES = 4 * 1024 * 1024;

export const ESTIMATE_STATUSES = ['견적중', '견적완료', '수주성공', '수주취소'];

export type EstimateFileItem = {
  id: number;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  projectName: string;
  partnerName: string | null;
  quantity: number;
  amount: number | null;
  estimateDate: string | null;
  deliveryTerm: string | null;
  processSteps: string[];
  status: string;
  orderId: number | null;
  projectNo: string | null;
  memo: string | null;
  createdAt: string;
};

/** 공정 이름만 남기고 공정관리 순서대로 정렬 */
export function cleanSteps(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map(String) : [];
  return PROCESS_STEPS.filter((s) => list.includes(s));
}

export function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

type EstimateFileRow = Omit<EstimateFileItem, 'processSteps' | 'createdAt'> & {
  processSteps: string;
  createdAt: Date;
  updatedAt?: Date;
};

export function serializeEstimateFile(row: EstimateFileRow): EstimateFileItem {
  let steps: unknown = [];
  try {
    steps = JSON.parse(row.processSteps || '[]');
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    projectName: row.projectName,
    partnerName: row.partnerName,
    quantity: row.quantity,
    amount: row.amount,
    estimateDate: row.estimateDate,
    deliveryTerm: row.deliveryTerm,
    processSteps: cleanSteps(steps),
    status: ESTIMATE_STATUSES.includes(row.status) ? row.status : '견적중',
    orderId: row.orderId,
    projectNo: row.projectNo,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 오늘 날짜 (한국 시간 기준 YYYY-MM-DD) */
export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-12-10까지" 같은 납품기한 글자에서 날짜만 꺼낸다 (없으면 빈 문자열) */
export function dateFromText(text: string | null | undefined): string {
  const m = (text || '').match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

/** 공정관리 프로젝트 번호 다음 번호 (공정관리 화면과 같은 방식) */
export function nextProjectNo(orders: { projectNo?: string | null }[]): string {
  let next = orders.length + 1;
  for (const o of orders) {
    const m = o.projectNo?.match(/^PRJ-(\d+)$/);
    if (m && Number(m[1]) >= next) next = Number(m[1]) + 1;
  }
  return `PRJ-${String(next).padStart(3, '0')}`;
}
