import { NextResponse } from 'next/server';

export interface SupportProject {
  id: string;
  organization: '부산/경남 테크노파크' | 'K-Startup' | '기업마당' | '소상공인진흥공단' | 'IRiS';
  orgCode: 'TP' | 'K_STARTUP' | 'BIZ_MADANG' | 'SEMAS' | 'IRIS';
  title: string;
  category: 'R&D' | '스마트제조' | '창업/재창업' | '소상공인/설비' | '에너지/환경' | '기술지원';
  target: string;
  budget: string;
  startDate: string;
  endDate: string;
  url: string;
  views: number;
  tags: string[];
  description: string;
  contact: string;
}

// In-memory server cache to minimize server load
let cachedProjects: { data: SupportProject[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

const RAW_PROJECTS: Omit<SupportProject, 'id'>[] = [
  {
    organization: '부산/경남 테크노파크',
    orgCode: 'TP',
    title: '2026년 부산/경남 스마트공장 구축 및 고도화 지원사업 (Smart Factory)',
    category: '스마트제조',
    target: '부산 및 경남 소재 중소/중견 제조기업',
    budget: '기업당 최대 1.5억원 (국비 50% 매칭)',
    startDate: '2026-08-01',
    endDate: '2026-08-08', // D-4 (Urgent)
    url: 'https://www.btp.or.kr',
    views: 1420,
    tags: ['Smart', '스마트공장', '부산/경남', '제조혁신', '고도화'],
    description: '부산·경남 지역 중소 제조업체의 생산성 향상 및 디지털 전환을 위한 스마트공장 솔루션 및 자동화 설비 도입 지원',
    contact: '부산테크노파크 스마트제조혁신센터 (051-974-9000)'
  },
  {
    organization: '부산/경남 테크노파크',
    orgCode: 'TP',
    title: '2026년 경남 주력산업 R&D 및 기술 고도화 시제품 제작 지원공고',
    category: 'R&D',
    target: '경남 지역 내 기계·부품·금속가공 제조업체',
    budget: '기업당 최대 5,000만원',
    startDate: '2026-07-25',
    endDate: '2026-08-12',
    url: 'https://www.gntp.or.kr',
    views: 890,
    tags: ['R&D', '부산/경남', '시제품', '기계가공', '기술지원'],
    description: '경남 주력 산업인 기계, 조선, 항공 부품 분야의 시제품 제작 및 R&D 상용화 검증 지원사업',
    contact: '경남테크노파크 기업지원단 (055-259-3300)'
  },
  {
    organization: 'K-Startup',
    orgCode: 'K_STARTUP',
    title: '2026년 재창업패키지 기술개발 및 사업화 2차 모집공고 (재창업 전용)',
    category: '창업/재창업',
    target: '폐업 후 기술기반 재창업을 준비 중이거나 3년 이내 재창업 대표자',
    budget: '사업화 자금 최대 1억원 + R&D 연계',
    startDate: '2026-08-02',
    endDate: '2026-08-06', // D-2 (Urgent)
    url: 'https://www.k-startup.go.kr',
    views: 2310,
    tags: ['재창업', 'R&D', 'K-Startup', '창업진흥원', '기술개발'],
    description: '실패 경험을 자산으로 재도약하는 기술기반 재창업자의 성공적인 사업화 및 R&D 멘토링 전폭 지원',
    contact: '창업진흥원 재도약창업실 (044-410-1800)'
  },
  {
    organization: 'K-Startup',
    orgCode: 'K_STARTUP',
    title: '2026년 ESS(에너지저장장치) 기반 스마트 제조 스타트업 육성 프로그램',
    category: '에너지/환경',
    target: 'ESS, 이차전지, 친환경 에너지 분야 7년 이내 창업기업',
    budget: '최대 7,000만원 및 PoC 실증 인프라 제공',
    startDate: '2026-07-28',
    endDate: '2026-08-20',
    url: 'https://www.k-startup.go.kr',
    views: 1150,
    tags: ['ESS', 'Smart', 'K-Startup', '에너지', '스타트업'],
    description: '산업용 ESS 모듈 및 안전 관리 장치를 개발하는 혁신 스타트업 대상 현장 실증 테스트베드 및 사업화 자금 지원',
    contact: '창업진흥원 창업육성팀 (044-410-1850)'
  },
  {
    organization: '기업마당',
    orgCode: 'BIZ_MADANG',
    title: '2026년 중소기업 기술혁신개발사업 (R&D) 수출지향형 과제 모집',
    category: 'R&D',
    target: '매출액 50억원 이상 및 수출 실적이 있는 중소기업',
    budget: '최대 4년간 총 20억원 (연간 5억원)',
    startDate: '2026-08-01',
    endDate: '2026-08-05', // D-1 (Urgent)
    url: 'https://www.bizinfo.go.kr',
    views: 3450,
    tags: ['R&D', '중소벤처기업부', '기업마당', '기술개발', '수출'],
    description: '글로벌 경쟁력을 갖춘 수출주도형 중소기업의 차세대 핵심 기술개발 R&D 자금 지원',
    contact: '중소기업기술정보진흥원 (1357)'
  },
  {
    organization: '기업마당',
    orgCode: 'BIZ_MADANG',
    title: '2026년 친환경 Smart 가로등 및 안전 인프라 보급 지원사업',
    category: '기술지원',
    target: '스마트 가로등, 안전 솔루션 개발 및 제조 기업',
    budget: '과제당 최대 2억원 (설치 시범 보조금)',
    startDate: '2026-07-30',
    endDate: '2026-08-18',
    url: 'https://www.bizinfo.go.kr',
    views: 1780,
    tags: ['가로등', 'Smart', '기업마당', '안전인프라', '중기부'],
    description: '지자체 및 공공산단 대상 고효율 LED Smart 가로등 보급 및 위험 감지 센서 융합 안전 인프라 보조금 사업',
    contact: '중소벤처기업부 기업혁신과 (044-204-7500)'
  },
  {
    organization: '소상공인진흥공단',
    orgCode: 'SEMAS',
    title: '2026년 소상공인 스마트상점 기술보급 및 고효율 설비 지원사업',
    category: '소상공인/설비',
    target: '소상공인 및 소공인 (제조형 소공인 포함)',
    budget: '일반형 최대 500만원 / 미래형 최대 1,500만원 (70% 국비 지원)',
    startDate: '2026-08-03',
    endDate: '2026-08-04', // D-Day (Urgent)
    url: 'https://www.semas.or.kr',
    views: 4120,
    tags: ['Smart', '소상공인진흥공단', '스마트상점', '설비지원', '소공인'],
    description: '소상공인·소공인의 스마트기술(Kiosk, 서빙로봇, 자동화 센서, 고효율 에너지 설비) 도입 비용 부담 경감 지원',
    contact: '소상공인시장진흥공단 스마트기술지원팀 (1357)'
  },
  {
    organization: '소상공인진흥공단',
    orgCode: 'SEMAS',
    title: '2026년 소공인 특화지원센터 클러스터 R&D/재창업 지원 컨설팅',
    category: '창업/재창업',
    target: '도시형 소공인 (금속가공, 기계부품 제조 소공인)',
    budget: '컨설팅 전액 무료 + 소공인 자금 우대 금리',
    startDate: '2026-07-20',
    endDate: '2026-08-25',
    url: 'https://www.semas.or.kr',
    views: 950,
    tags: ['재창업', '소상공인진흥공단', '소공인', '컨설팅', '금속가공'],
    description: '금속가공 및 영세 제조업체 대상 공정 개선, 재창업 경영정상화 및 정책자금 연계 원스톱 컨설팅',
    contact: '소상공인시장진흥공단 소공인지원실 (042-363-7700)'
  },
  {
    organization: 'IRiS',
    orgCode: 'IRIS',
    title: '2026년 범부처 통합 연구지원(IRiS) 스마트 에너지 저장장치(ESS) 표준화 R&D',
    category: 'R&D',
    target: '산·학·연 컨소시엄 (중소·중견기업 필수 참여)',
    budget: '과제당 연간 10억원 이내 (총 3년 지원)',
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    url: 'https://www.iris.go.kr',
    views: 1980,
    tags: ['IRiS', 'ESS', 'R&D', 'Smart', '범부처', '표준화'],
    description: '범부처통합연구지원시스템(IRiS)을 통한 차세대 화재 안전 스마트 ESS 시스템 및 기술 표준화 공동 R&D 과제 공모',
    contact: '한국산업기술기획평가원 (1544-6633)'
  },
  {
    organization: 'IRiS',
    orgCode: 'IRIS',
    title: '2026년 IRiS 재난안전 융합기술개발 R&D 국책과제 연구기관 모집',
    category: 'R&D',
    target: '산업재해 예방 및 안전 시스템 보유 기술기업 및 연구소',
    budget: '총 연구비 45억원 규모 (과제별 5억~15억원)',
    startDate: '2026-07-28',
    endDate: '2026-08-11',
    url: 'https://www.iris.go.kr',
    views: 2670,
    tags: ['IRiS', 'R&D', '재난안전', '범부처', '기술개발'],
    description: '산업 현장 안전사고 방지 및 실시간 위험 모니터링 센서 융합 기술 개발을 위한 국책 R&D 수행기관 공모',
    contact: '국가연구시설장비진흥센터 (1877-2041)'
  }
];

export async function GET() {
  const now = Date.now();

  // Check in-memory cache first
  if (cachedProjects && now - cachedProjects.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      source: 'cache',
      updatedAt: new Date(cachedProjects.timestamp).toISOString(),
      projects: cachedProjects.data
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=60'
      }
    });
  }

  // Generate dataset with dynamic IDs
  const projects: SupportProject[] = RAW_PROJECTS.map((item, index) => ({
    ...item,
    id: `SP-${2026001 + index}`
  }));

  // Update in-memory cache
  cachedProjects = {
    data: projects,
    timestamp: now
  };

  return NextResponse.json({
    success: true,
    source: 'live',
    updatedAt: new Date(now).toISOString(),
    projects
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=60'
    }
  });
}
