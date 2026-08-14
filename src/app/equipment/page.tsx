"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Button, Stack, Group, Text, Badge, TextInput, 
  Modal, Select, Table, ActionIcon, Tooltip,
  NumberInput, SimpleGrid, Textarea, Card, Paper, Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, IconPencil, IconTrash, IconSearch, 
  IconPrinter, IconDownload, IconTools, IconCheck, IconAlertTriangle, IconQrcode, IconHistory
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';
import { useAuth } from '@/context/AuthContext';

export type RepairRecord = {
  id: string;
  repairDate: string;
  description: string;
  replacedParts: string;
  cost: number;
  serviceCompany: string;
};

export type Equipment = {
  id: number;
  code: string;
  name: string;
  modelName: string;
  manufacturer: string;
  purchaseDate: string;
  purchasePrice: number;
  location: string;
  status: 'OPERATIONAL' | 'REPAIRING';
  downtimeCount: number;
  totalRepairCost: number;
  repairs: RepairRecord[];
  memo: string | null;
};

const INITIAL_EQUIPMENT: Equipment[] = [
  {
    id: 1,
    code: 'EQ-1001',
    name: '레이저절단기',
    modelName: 'FL-3015 CNC 파이버 레이저 (3kW)',
    manufacturer: '한광레이저',
    purchaseDate: '2024-03-15',
    purchasePrice: 180000000,
    location: 'A라인 레이저가공실',
    status: 'OPERATIONAL',
    downtimeCount: 1,
    totalRepairCost: 250000,
    memo: '주요 메인 절단기, 정기 렌즈 점검 요망',
    repairs: [
      {
        id: 'rep-1',
        repairDate: '2026-08-01',
        description: '파이버 레이저 노즐 교체 및 초점 정밀 조정',
        replacedParts: '보호 렌즈, 노즐 1.5mm',
        cost: 250000,
        serviceCompany: '(주)한광레이저 기술지원팀'
      }
    ]
  },
  {
    id: 2,
    code: 'EQ-1002',
    name: '절곡기',
    modelName: '유압식 CNC 절곡기 (150Ton / 3100mm)',
    manufacturer: '대성기계',
    purchaseDate: '2023-11-20',
    purchasePrice: 85000000,
    location: 'B라인 절곡작업장',
    status: 'OPERATIONAL',
    downtimeCount: 0,
    totalRepairCost: 0,
    memo: 'V-다이 정밀 금형 세트 정기 유압유 점검',
    repairs: []
  },
  {
    id: 3,
    code: 'EQ-1003',
    name: 'TIG용접기',
    modelName: '인버터 알곤 용접기 (500A 디지털)',
    manufacturer: '효성용접기',
    purchaseDate: '2025-01-10',
    purchasePrice: 4500000,
    location: 'C라인 용접작업장',
    status: 'OPERATIONAL',
    downtimeCount: 2,
    totalRepairCost: 120000,
    memo: 'SUS 및 알루미늄 구조물 고품질 용접용',
    repairs: [
      {
        id: 'rep-2',
        repairDate: '2026-07-15',
        description: '용접 토치 케이블 및 토치 어셈블리 교체',
        replacedParts: '토치 바디, 가스 호스',
        cost: 120000,
        serviceCompany: '효성용접기 부산 A/S'
      }
    ]
  },
  {
    id: 4,
    code: 'EQ-1004',
    name: '직립도르방',
    modelName: '직립 드릴링 머신 (25mm 정밀)',
    manufacturer: '남선정밀',
    purchaseDate: '2022-06-05',
    purchasePrice: 6800000,
    location: '가공실 1구역',
    status: 'OPERATIONAL',
    downtimeCount: 0,
    totalRepairCost: 0,
    memo: '드릴링 및 홀 가공 전용 보조 설비',
    repairs: []
  },
  {
    id: 5,
    code: 'EQ-1005',
    name: '탭드릴머신',
    modelName: '자동 고속 탭핑 머신 (M3~M16)',
    manufacturer: '경남테크',
    purchaseDate: '2024-09-12',
    purchasePrice: 12500000,
    location: '가공실 2구역',
    status: 'REPAIRING',
    downtimeCount: 3,
    totalRepairCost: 480000,
    memo: '스핀들 모터 발열 및 오작동 점검 수리 진행 중',
    repairs: [
      {
        id: 'rep-3',
        repairDate: '2026-08-10',
        description: '스핀들 모터 과열 및 자동 탭핑 헤드 구동 구동부 점검',
        replacedParts: '스핀들 베어링, 구동 벨트',
        cost: 480000,
        serviceCompany: '경남테크 서비스센터'
      }
    ]
  },
  {
    id: 6,
    code: 'EQ-1006',
    name: '파이프밴딩기',
    modelName: '유압식 NC 파이프 벤더 (60파이)',
    manufacturer: '삼우유압',
    purchaseDate: '2023-04-18',
    purchasePrice: 32000000,
    location: '성형 가공실',
    status: 'OPERATIONAL',
    downtimeCount: 1,
    totalRepairCost: 150000,
    memo: '안전 난간 및 곡면 파이프 벤딩 전용',
    repairs: [
      {
        id: 'rep-4',
        repairDate: '2026-06-20',
        description: '유압 실린더 패킹 교체 및 유압유 보충',
        replacedParts: '유압 패킹 실, ISO 46 유압유',
        cost: 150000,
        serviceCompany: '삼우유압 서비스팀'
      }
    ]
  }
];

export default function EquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(INITIAL_EQUIPMENT);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { canEdit } = useAuth();

  // Create / Edit Equipment Modal State
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [modelName, setModelName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | string>(0);
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState('');

  // Repair Registration Modal State
  const [repairOpened, { open: openRepair, close: closeRepair }] = useDisclosure(false);
  const [repairTargetEq, setRepairTargetEq] = useState<Equipment | null>(null);
  const [repairDate, setRepairDate] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [repairCost, setRepairCost] = useState<number | string>(0);
  const [serviceCompany, setServiceCompany] = useState('');

  // Repair List History Drawer / Modal State
  const [historyOpened, { open: openHistory, close: closeHistory }] = useDisclosure(false);
  const [historyTargetEq, setHistoryTargetEq] = useState<Equipment | null>(null);

  // QR Code Label Modal State
  const [qrOpened, { open: openQr, close: closeQr }] = useDisclosure(false);
  const [qrTargetEq, setQrTargetEq] = useState<Equipment | null>(null);

  const resetForm = useCallback(() => {
    const nextNum = equipmentList.length + 1001;
    setCode(`EQ-${nextNum}`);
    setName('');
    setModelName('');
    setManufacturer('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePrice(0);
    setLocation('');
    setMemo('');
    setEditingEq(null);
  }, [equipmentList]);

  const handleOpenCreate = useCallback(() => {
    if (!canEdit) {
      alert('직원 권한(1234)은 신규 장비 등록이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    resetForm();
    openCreate();
  }, [canEdit, resetForm, openCreate]);

  const handleOpenEdit = useCallback((eq: Equipment) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 장비 정보 수정이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    setEditingEq(eq);
    setCode(eq.code);
    setName(eq.name);
    setModelName(eq.modelName);
    setManufacturer(eq.manufacturer);
    setPurchaseDate(eq.purchaseDate);
    setPurchasePrice(eq.purchasePrice);
    setLocation(eq.location);
    setMemo(eq.memo || '');
    openCreate();
  }, [canEdit, openCreate]);

  const handleSubmitEquipment = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const numPrice = typeof purchasePrice === 'number' ? purchasePrice : parseInt(purchasePrice || '0');

    if (editingEq) {
      setEquipmentList(prev => prev.map(item => item.id === editingEq.id ? {
        ...item,
        code,
        name,
        modelName,
        manufacturer,
        purchaseDate,
        purchasePrice: numPrice,
        location,
        memo
      } : item));
      notifications.show({ title: '수정 완료', message: `${name} 정보가 저장되었습니다.`, color: 'blue' });
    } else {
      const newEq: Equipment = {
        id: Date.now(),
        code,
        name,
        modelName,
        manufacturer,
        purchaseDate,
        purchasePrice: numPrice,
        location,
        status: 'OPERATIONAL',
        downtimeCount: 0,
        totalRepairCost: 0,
        repairs: [],
        memo
      };
      setEquipmentList(prev => [newEq, ...prev]);
      notifications.show({ title: '등록 완료', message: `신규 설비 [${code}] ${name}이(가) 등록되었습니다.`, color: 'teal' });
    }
    closeCreate();
  }, [canEdit, editingEq, code, name, modelName, manufacturer, purchaseDate, purchasePrice, location, memo, closeCreate]);

  const handleDeleteEquipment = useCallback((id: number, eqName: string) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 장비 삭제가 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (confirm(`[${eqName}] 설비 자산을 목록에서 삭제하시겠습니까?`)) {
      setEquipmentList(prev => prev.filter(item => item.id !== id));
      notifications.show({ title: '삭제 완료', message: '설비 정보가 삭제되었습니다.', color: 'gray' });
    }
  }, [canEdit]);

  // One-click status toggle & trigger repair form
  const handleToggleStatus = useCallback((eq: Equipment) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 설비 상태 변경이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }

    if (eq.status === 'OPERATIONAL') {
      // Toggle to REPAIRING
      setEquipmentList(prev => prev.map(item => item.id === eq.id ? {
        ...item,
        status: 'REPAIRING',
        downtimeCount: item.downtimeCount + 1
      } : item));

      notifications.show({
        title: '🔴 고장/수리중 등록 완료',
        message: `[${eq.name}] 설비가 고장/수리중 상태로 전환되고 비가동 횟수가 1회 증가하였습니다.`,
        color: 'red',
        autoClose: 4000
      });
    } else {
      // Toggle to OPERATIONAL -> Open Repair History Entry Modal
      setRepairTargetEq(eq);
      setRepairDate(new Date().toISOString().split('T')[0]);
      setRepairDescription('');
      setReplacedParts('');
      setRepairCost(0);
      setServiceCompany('');
      openRepair();
    }
  }, [canEdit, openRepair]);

  const handleOpenRepairModal = useCallback((eq: Equipment) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 수리 이력 등록이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    setRepairTargetEq(eq);
    setRepairDate(new Date().toISOString().split('T')[0]);
    setRepairDescription('');
    setReplacedParts('');
    setRepairCost(0);
    setServiceCompany('');
    openRepair();
  }, [canEdit, openRepair]);

  const handleSubmitRepairRecord = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!repairTargetEq) return;

    const numCost = typeof repairCost === 'number' ? repairCost : parseInt(repairCost || '0');

    const newRecord: RepairRecord = {
      id: `rep-${Date.now()}`,
      repairDate,
      description: repairDescription,
      replacedParts,
      cost: numCost,
      serviceCompany
    };

    setEquipmentList(prev => prev.map(item => {
      if (item.id === repairTargetEq.id) {
        return {
          ...item,
          status: 'OPERATIONAL', // Automatically restore to operational
          totalRepairCost: item.totalRepairCost + numCost,
          repairs: [newRecord, ...item.repairs]
        };
      }
      return item;
    }));

    notifications.show({
      title: '🟢 수리 및 점검 완결 저장',
      message: `[${repairTargetEq.name}] 수리 이력이 저장되고 정상 가동 상태로 복귀되었습니다.`,
      color: 'teal',
      autoClose: 4000
    });

    closeRepair();
  }, [repairTargetEq, repairDate, repairDescription, replacedParts, repairCost, serviceCompany, closeRepair]);

  const handleOpenHistory = useCallback((eq: Equipment) => {
    setHistoryTargetEq(eq);
    openHistory();
  }, [openHistory]);

  const handleOpenQrLabel = useCallback((eq: Equipment) => {
    setQrTargetEq(eq);
    openQr();
  }, [openQr]);

  const metrics = useMemo(() => {
    const totalCount = equipmentList.length;
    const operationalCount = equipmentList.filter(eq => eq.status === 'OPERATIONAL').length;
    const repairingCount = equipmentList.filter(eq => eq.status === 'REPAIRING').length;
    const totalAssetValue = equipmentList.reduce((acc, eq) => acc + (eq.purchasePrice || 0), 0);
    const totalRepairCost = equipmentList.reduce((acc, eq) => acc + (eq.totalRepairCost || 0), 0);

    return { totalCount, operationalCount, repairingCount, totalAssetValue, totalRepairCost };
  }, [equipmentList]);

  const filteredEquipment = useMemo(() => {
    return equipmentList.filter(eq => {
      const matchSearch = 
        eq.name.includes(search) || 
        eq.code.includes(search) || 
        eq.modelName.includes(search) || 
        eq.manufacturer.includes(search) || 
        eq.location.includes(search);

      let matchStatus = true;
      if (filterStatus === 'OPERATIONAL') matchStatus = eq.status === 'OPERATIONAL';
      if (filterStatus === 'REPAIRING') matchStatus = eq.status === 'REPAIRING';

      return matchSearch && matchStatus;
    });
  }, [equipmentList, search, filterStatus]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handleExportExcel = useCallback(() => {
    const exportData = filteredEquipment.map(eq => ({
      '관리번호': eq.code,
      '장비명': eq.name,
      '모델/제조사': `${eq.modelName} (${eq.manufacturer})`,
      '구매일자': eq.purchaseDate || '-',
      '도입금액(원)': eq.purchasePrice.toLocaleString(),
      '설치위치': eq.location,
      '현재상태': eq.status === 'OPERATIONAL' ? '정상 가동' : '고장/수리중',
      '월간 비가동 횟수': `${eq.downtimeCount}회`,
      '누적 수리비(원)': eq.totalRepairCost.toLocaleString(),
      '비고': eq.memo || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 15 },
      { wch: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '설비 자산 현황');
    XLSX.writeFile(workbook, `TASS_공장설비자산관리대장_${todayStr}.xlsx`);
  }, [filteredEquipment, todayStr]);

  return (
    <>
      {/* SCREEN VIEW (Hidden during print) */}
      <Stack gap="lg" className="print:hidden print-hidden no-print">
        <PageHeaderBanner title="공장 설비 및 장비 관리" subtitle="핵심 가공/용접/절단 설비 자산 모니터링, 고장 수리 이력 추적 및 QR 라벨 출력">
          <Button 
            variant="outline" 
            color="gray.0" 
            size="sm"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            A4 설비 관리대장 인쇄
          </Button>
          <Button 
            variant="outline" 
            color="gray.0" 
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportExcel}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            📊 설비 현황 엑셀 다운로드
          </Button>
          <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            새 장비 등록
          </Button>
        </PageHeaderBanner>

        {/* 설비 현황 주요 요약 지표 카드리스트 */}
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md">
          <Paper p="md" radius="md" className="glass-panel" style={{ borderLeft: '4px solid #2563eb' }}>
            <Text size="xs" c="dimmed" fw={700}>총 보유 설비 자산</Text>
            <Text fw={900} size="xl" c="blue.9" mt={2}>{metrics.totalCount}대</Text>
          </Paper>
          <Paper p="md" radius="md" className="glass-panel" style={{ borderLeft: '4px solid #16a34a' }}>
            <Text size="xs" c="dimmed" fw={700}>🟢 정상 가동 중</Text>
            <Text fw={900} size="xl" c="teal.9" mt={2}>{metrics.operationalCount}대</Text>
          </Paper>
          <Paper p="md" radius="md" className="glass-panel" style={{ borderLeft: '4px solid #dc2626' }}>
            <Text size="xs" c="dimmed" fw={700}>🔴 점검 / 고장수리중</Text>
            <Text fw={900} size="xl" c="red.9" mt={2}>{metrics.repairingCount}대</Text>
          </Paper>
          <Paper p="md" radius="md" className="glass-panel" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <Text size="xs" c="dimmed" fw={700}>설비 자산 총액</Text>
            <Text fw={900} size="lg" c="violet.9" mt={2}>₩{metrics.totalAssetValue.toLocaleString()}</Text>
          </Paper>
          <Paper p="md" radius="md" className="glass-panel" style={{ borderLeft: '4px solid #d97706' }}>
            <Text size="xs" c="dimmed" fw={700}>총 누적 수리비용</Text>
            <Text fw={900} size="lg" c="orange.9" mt={2}>₩{metrics.totalRepairCost.toLocaleString()}</Text>
          </Paper>
        </SimpleGrid>

        {/* 검색 및 상태 필터 */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="glass-panel" p="md">
          <TextInput 
            placeholder="장비명, 관리번호(EQ-XXXX), 모델명, 위치 검색..." 
            value={search} 
            onChange={(e) => setSearch(e.currentTarget.value)} 
            leftSection={<IconSearch size={16} />}
            label="검색"
          />
          <Select
            label="가동 상태 필터"
            placeholder="전체 보기"
            data={[
              { value: 'OPERATIONAL', label: '🟢 정상 가동 중만 보기' },
              { value: 'REPAIRING', label: '🔴 고장 / 수리 중만 보기' },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
          />
        </SimpleGrid>

        {/* 장비 관리 목록 테이블 */}
        <div className="glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table striped highlightOnHover withTableBorder verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={110}>관리번호</Table.Th>
                <Table.Th w={180}>장비명 / 모델</Table.Th>
                <Table.Th w={140}>설치위치 / 제조사</Table.Th>
                <Table.Th w={130}>구매일 / 도입금액</Table.Th>
                <Table.Th w={150}>가동 상태 (원클릭 전환)</Table.Th>
                <Table.Th w={160}>비가동 횟수 & 누적 수리비</Table.Th>
                <Table.Th w={130} style={{ whiteSpace: 'nowrap' }}>관리 액션</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEquipment.map(eq => (
                <Table.Tr key={eq.id} style={{ backgroundColor: eq.status === 'REPAIRING' ? 'rgba(254, 226, 226, 0.45)' : undefined }}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Badge color="dark" size="md" variant="filled" style={{ fontFamily: 'monospace' }}>
                      {eq.code}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" align="center">
                      <Text fw={800} size="sm" c="blue.9">{eq.name}</Text>
                      <Tooltip label="QR 코드 라벨 보기 & 인쇄">
                        <ActionIcon size="xs" variant="light" color="indigo" onClick={() => handleOpenQrLabel(eq)}>
                          <IconQrcode size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    <Text size="xs" c="dimmed" truncate="end">{eq.modelName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600} size="xs" c="dark">{eq.location}</Text>
                    <Text size="11px" c="gray.6">{eq.manufacturer}</Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text size="xs" fw={600}>{eq.purchaseDate || '-'}</Text>
                    <Text size="xs" c="dimmed" fw={700}>₩{eq.purchasePrice.toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Text
                      size="sm"
                      fw={eq.status === 'OPERATIONAL' ? 600 : 800}
                      c={eq.status === 'OPERATIONAL' ? 'dark' : 'red.7'}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleToggleStatus(eq)}
                    >
                      {eq.status === 'OPERATIONAL' ? '정상 가동' : '고장/수리중'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Stack gap={2}>
                      <Text 
                        size="xs" 
                        c="dark"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenHistory(eq)}
                      >
                        비가동 {eq.downtimeCount}회 (이력 {eq.repairs.length}건)
                      </Text>
                      <Text size="xs" c={eq.totalRepairCost > 0 ? 'dark' : 'dimmed'} fw={eq.totalRepairCost > 0 ? 600 : 400}>
                        누적 ₩{eq.totalRepairCost.toLocaleString()}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="수리/소모품 등록">
                        <ActionIcon color="teal" variant="light" size="sm" onClick={() => handleOpenRepairModal(eq)}>
                          <IconTools size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="수리 이력 대장">
                        <ActionIcon color="blue" variant="subtle" size="sm" onClick={() => handleOpenHistory(eq)}>
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="장비 정보 수정">
                        <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handleOpenEdit(eq)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="장비 삭제">
                        <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDeleteEquipment(eq.id, eq.name)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}

              {filteredEquipment.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} ta="center" py="xl" c="dimmed">
                    등록된 설비 자산이 없거나 검색 조건에 일치하는 장비가 없습니다.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {/* 장비 신규 등록 / 수정 모달 */}
        <Modal 
          opened={mounted && createOpened} 
          onClose={closeCreate} 
          title={editingEq ? "장비/설비 정보 수정" : "신규 공장 장비 등록"} 
          size="lg"
          zIndex={300}
          withinPortal={true}
        >
          <form onSubmit={handleSubmitEquipment}>
            <Stack gap="md">
              <Group grow>
                <TextInput 
                  label="관리번호" 
                  value={code} 
                  onChange={(e) => setCode(e.currentTarget.value)} 
                  required 
                  placeholder="예: EQ-1007"
                />
                <TextInput 
                  label="장비명" 
                  value={name} 
                  onChange={(e) => setName(e.currentTarget.value)} 
                  required 
                  placeholder="예: 파이프 밴더, 레이저 절단기"
                />
              </Group>

              <Group grow>
                <TextInput 
                  label="모델명" 
                  value={modelName} 
                  onChange={(e) => setModelName(e.currentTarget.value)} 
                  required 
                  placeholder="예: CNC 파이버 3kW"
                />
                <TextInput 
                  label="제조사" 
                  value={manufacturer} 
                  onChange={(e) => setManufacturer(e.currentTarget.value)} 
                  required 
                  placeholder="예: 한광, 대성기계"
                />
              </Group>

              <Group grow>
                <TextInput 
                  label="도입/구매 일자" 
                  type="date" 
                  value={purchaseDate} 
                  onChange={(e) => setPurchaseDate(e.currentTarget.value)} 
                  required 
                />
                <NumberInput 
                  label="도입 금액(원)" 
                  value={purchasePrice} 
                  onChange={setPurchasePrice} 
                  min={0} 
                  step={100000} 
                  required 
                />
              </Group>

              <TextInput 
                label="설치 위치" 
                value={location} 
                onChange={(e) => setLocation(e.currentTarget.value)} 
                required 
                placeholder="예: A라인 레이저가공실, 가공 2구역"
              />

              <Textarea 
                label="특이사항 및 관리 비고" 
                value={memo} 
                onChange={(e) => setMemo(e.currentTarget.value)} 
                placeholder="정기 점검 주기, 소모품 스펙 등 메모 입력" 
                minRows={2} 
              />

              <Button type="submit" fullWidth mt="md" color="blue">
                {editingEq ? "수정사항 저장하기" : "장비 등록 완료"}
              </Button>
            </Stack>
          </form>
        </Modal>

        {/* 수리 및 소모품 교체 이력 등록 모달 */}
        <Modal
          opened={mounted && repairOpened}
          onClose={closeRepair}
          title={`[수리/소모품 교체 등록] ${repairTargetEq?.code || ''} ${repairTargetEq?.name || ''}`}
          size="lg"
          zIndex={300}
          withinPortal={true}
        >
          <form onSubmit={handleSubmitRepairRecord}>
            <Stack gap="md">
              <Group grow>
                <TextInput 
                  label="수리/점검 일자" 
                  type="date" 
                  value={repairDate} 
                  onChange={(e) => setRepairDate(e.currentTarget.value)} 
                  required 
                />
                <TextInput 
                  label="수리 업체 / 담당팀" 
                  value={serviceCompany} 
                  onChange={(e) => setServiceCompany(e.currentTarget.value)} 
                  required 
                  placeholder="예: 한광 서비스팀, 자체 정비팀"
                />
              </Group>

              <Textarea 
                label="수리 및 고장 증상 내역" 
                value={repairDescription} 
                onChange={(e) => setRepairDescription(e.currentTarget.value)} 
                required 
                placeholder="예: 스핀들 모터 과열 현상 점검 및 베어링 교체" 
                minRows={2}
              />

              <TextInput 
                label="교체 부품 / 소모품 명칭" 
                value={replacedParts} 
                onChange={(e) => setReplacedParts(e.currentTarget.value)} 
                placeholder="예: 노즐 1.5mm, 유압 패킹 실, 구동 벨트"
              />

              <NumberInput 
                label="수리/부품 비용(원)" 
                value={repairCost} 
                onChange={setRepairCost} 
                min={0} 
                step={10000} 
                required 
              />

              <Button type="submit" fullWidth color="teal" mt="md">
                🟢 수리 완료 처리 및 이력 추가
              </Button>
            </Stack>
          </form>
        </Modal>

        {/* 수리 이력 대장 팝업 모달 */}
        <Modal
          opened={mounted && historyOpened}
          onClose={closeHistory}
          title={`[수리/소모품 이력 대장] ${historyTargetEq?.code || ''} ${historyTargetEq?.name || ''}`}
          size="lg"
          zIndex={300}
          withinPortal={true}
        >
          {historyTargetEq && (
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={900} size="lg">{historyTargetEq.name} ({historyTargetEq.modelName})</Text>
                  <Text size="xs" c="dimmed">위치: {historyTargetEq.location} | 제조사: {historyTargetEq.manufacturer}</Text>
                </div>
                <Badge color="orange" size="lg">
                  총 수리비: ₩{historyTargetEq.totalRepairCost.toLocaleString()}
                </Badge>
              </Group>

              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={100}>수리일자</Table.Th>
                    <Table.Th>수리내용</Table.Th>
                    <Table.Th w={130}>교체 부품</Table.Th>
                    <Table.Th w={110}>수리비용</Table.Th>
                    <Table.Th w={130}>수리업체</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {historyTargetEq.repairs.map(rep => (
                    <Table.Tr key={rep.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text fw={700} size="xs">{rep.repairDate}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{rep.description}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{rep.replacedParts || '-'}</Text>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text fw={700} size="xs" c="orange.8">₩{rep.cost.toLocaleString()}</Text>
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="xs">{rep.serviceCompany}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {historyTargetEq.repairs.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5} ta="center" py="lg" c="dimmed">
                        기록된 수리 및 점검 이력이 없습니다.
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          )}
        </Modal>

        {/* QR 라벨 출력 팝업 모달 */}
        <Modal
          opened={mounted && qrOpened}
          onClose={closeQr}
          title={`[설비 부착용 QR 라벨] ${qrTargetEq?.code || ''}`}
          size="md"
          zIndex={300}
          withinPortal={true}
        >
          {qrTargetEq && (
            <Stack align="center" gap="md">
              <Card padding="lg" radius="md" style={{ border: '3px solid #0f172a', width: '280px', backgroundColor: '#ffffff' }}>
                <Stack align="center" gap="xs">
                  <Badge color="blue" size="md" variant="filled">TASS FACTORY ASSET</Badge>
                  <Title order={4} ta="center" style={{ margin: 0 }}>{qrTargetEq.name}</Title>
                  <Text fw={900} size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>[{qrTargetEq.code}]</Text>
                  
                  {/* 스캔용 QR 코드 그래픽 렌더링 박스 */}
                  <div style={{
                    width: '140px',
                    height: '140px',
                    border: '2px solid #000',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fff',
                    padding: '8px',
                    borderRadius: '8px'
                  }}>
                    <svg width="110" height="110" viewBox="0 0 100 100" style={{ shapeRendering: 'crispEdges' }}>
                      <rect width="100" height="100" fill="#ffffff" />
                      {/* Corner 1 */}
                      <rect x="5" y="5" width="30" height="30" fill="#000000" />
                      <rect x="10" y="10" width="20" height="20" fill="#ffffff" />
                      <rect x="15" y="15" width="10" height="10" fill="#000000" />
                      {/* Corner 2 */}
                      <rect x="65" y="5" width="30" height="30" fill="#000000" />
                      <rect x="70" y="10" width="20" height="20" fill="#ffffff" />
                      <rect x="75" y="15" width="10" height="10" fill="#000000" />
                      {/* Corner 3 */}
                      <rect x="5" y="65" width="30" height="30" fill="#000000" />
                      <rect x="10" y="70" width="20" height="20" fill="#ffffff" />
                      <rect x="15" y="75" width="10" height="10" fill="#000000" />
                      {/* Random QR Pattern Data Bits */}
                      <rect x="40" y="10" width="8" height="8" fill="#000000" />
                      <rect x="50" y="20" width="8" height="8" fill="#000000" />
                      <rect x="45" y="45" width="10" height="10" fill="#000000" />
                      <rect x="65" y="45" width="8" height="8" fill="#000000" />
                      <rect x="25" y="45" width="8" height="8" fill="#000000" />
                      <rect x="45" y="65" width="8" height="8" fill="#000000" />
                      <rect x="65" y="65" width="15" height="15" fill="#000000" />
                      <rect x="70" y="70" width="5" height="5" fill="#ffffff" />
                      <rect x="80" y="40" width="8" height="8" fill="#000000" />
                      <rect x="10" y="45" width="8" height="8" fill="#000000" />
                    </svg>
                  </div>

                  <Text size="xs" fw={700} ta="center" c="dimmed">
                    위치: {qrTargetEq.location}<br />
                    도입: {qrTargetEq.purchaseDate} | {qrTargetEq.manufacturer}
                  </Text>
                </Stack>
              </Card>

              <Button 
                fullWidth 
                color="blue" 
                leftSection={<IconPrinter size={16} />}
                onClick={() => window.print()}
              >
                🖨️ QR 라벨 출력하기
              </Button>
            </Stack>
          )}
        </Modal>
      </Stack>

      {/* PRINT VIEW: A4 인쇄 표 양식 (공장 설비 자산 관리대장) */}
      <div className="hidden print:block">
        <div className="orders-print-page">
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
            <h1 style={{ fontSize: '18pt', fontWeight: 900, margin: 0, padding: 0, display: 'inline-block' }}>
              TASS 공장 설비 자산 관리대장
            </h1>
            <span style={{ fontSize: '9pt', color: '#444', marginLeft: '12px' }}>
              (발행일자: {todayStr} | Technology About Safety Systems)
            </span>
          </div>

          <table className="orders-print-table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>순번</th>
                <th style={{ width: '8%' }}>관리번호</th>
                <th style={{ width: '15%' }}>설비명</th>
                <th style={{ width: '22%' }}>모델명 / 제조사</th>
                <th style={{ width: '10%' }}>도입일자</th>
                <th style={{ width: '12%' }}>도입금액</th>
                <th style={{ width: '13%' }}>설치위치</th>
                <th style={{ width: '8%' }}>가동상태</th>
                <th style={{ width: '8%' }}>누적수리비</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.map((eq, idx) => (
                <tr key={eq.id}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{eq.code}</td>
                  <td><strong>{eq.name}</strong></td>
                  <td>{eq.modelName} ({eq.manufacturer})</td>
                  <td style={{ textAlign: 'center' }}>{eq.purchaseDate || '-'}</td>
                  <td style={{ textAlign: 'right' }}>₩{eq.purchasePrice.toLocaleString()}</td>
                  <td>{eq.location}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: eq.status === 'OPERATIONAL' ? '#047857' : '#dc2626' }}>
                    {eq.status === 'OPERATIONAL' ? '정상가동' : '고장수리중'}
                  </td>
                  <td style={{ textAlign: 'right' }}>₩{eq.totalRepairCost.toLocaleString()}</td>
                </tr>
              ))}
              {filteredEquipment.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '8mm', textAlign: 'center' }}>
                    출력할 설비 자산 데이터가 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
