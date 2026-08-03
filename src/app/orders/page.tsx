"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Button, Stack, Group, Text, Badge, TextInput, 
  Modal, Select, Table, ActionIcon, Tooltip, Progress,
  NumberInput, SimpleGrid, Textarea, Checkbox,
  SegmentedControl, Card
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconPlus, IconPencil, IconTrash, IconSearch, 
  IconPhone, IconMail, IconPrinter, IconDownload
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';

type ProcessStep = {
  name: string;
  status: '대기' | '진행중' | '완료';
  active: boolean;
};

type Order = {
  id: number;
  partnerName: string;
  partnerId: number | null;
  itemName: string;
  quantity: number;
  orderDate: string | null;
  dueDate: string | null;
  status: string;
  processSteps: string;
  steps: ProcessStep[];
  progressPercent: number;
  memo: string | null;
  createdAt: string;
};

type PartnerDetail = {
  id: number;
  type: string;
  name: string;
  manager: string | null;
  email: string | null;
  phone: string | null;
  tel: string | null;
  fax: string | null;
  specialty: string;
  address: string | null;
  memo: string | null;
};

function getDaysRemaining(dueDateStr: string | null | undefined): number | null {
  if (!dueDateStr || !dueDateStr.trim()) return null;
  const target = new Date(dueDateStr.trim());
  if (isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

type PartnerOption = {
  value: string;
  label: string;
};

const DEFAULT_STEPS = ['설계', '절단', '가공', '용접', '도장', '조립/납품'];

const INITIAL_MOCK_ORDERS: Order[] = [
  {
    id: 101,
    partnerName: '(주)삼우금속공업',
    partnerId: 1,
    itemName: '스마트 안전 제어함체 A-Type',
    quantity: 15,
    orderDate: '2026-08-01',
    dueDate: '2026-08-07',
    status: '진행중',
    processSteps: '',
    steps: [
      { name: '설계', status: '완료', active: true },
      { name: '절단', status: '완료', active: true },
      { name: '가공', status: '진행중', active: true },
      { name: '용접', status: '대기', active: true },
      { name: '도장', status: '대기', active: true },
      { name: '조립/납품', status: '대기', active: true }
    ],
    progressPercent: 33,
    memo: '가공 라인 2번 시공 진행 확인 요망',
    createdAt: '2026-08-01'
  },
  {
    id: 102,
    partnerName: '태양엔지니어링',
    partnerId: 2,
    itemName: '고효율 LED Smart 가로등 프레임',
    quantity: 30,
    orderDate: '2026-07-28',
    dueDate: '2026-08-05',
    status: '납기임박',
    processSteps: '',
    steps: [
      { name: '설계', status: '완료', active: true },
      { name: '절단', status: '완료', active: true },
      { name: '가공', status: '완료', active: true },
      { name: '용접', status: '완료', active: true },
      { name: '도장', status: '진행중', active: true },
      { name: '조립/납품', status: '대기', active: true }
    ],
    progressPercent: 67,
    memo: 'D-1 긴급 도장 출고 대상',
    createdAt: '2026-07-28'
  },
  {
    id: 103,
    partnerName: '경남정밀(주)',
    partnerId: 3,
    itemName: '산업용 ESS 모듈 안전 감지센서 케이스',
    quantity: 50,
    orderDate: '2026-07-20',
    dueDate: '2026-08-02',
    status: '완료',
    processSteps: '',
    steps: [
      { name: '설계', status: '완료', active: true },
      { name: '절단', status: '완료', active: true },
      { name: '가공', status: '완료', active: true },
      { name: '용접', status: '완료', active: true },
      { name: '도장', status: '완료', active: true },
      { name: '조립/납품', status: '완료', active: true }
    ],
    progressPercent: 100,
    memo: '납품 완료 (검수필)',
    createdAt: '2026-07-20'
  }
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_MOCK_ORDERS);
  const [allPartners, setAllPartners] = useState<PartnerDetail[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'IN_PROGRESS' | 'URGENT' | 'COMPLETED'>('ALL');

  // Order Create/Edit Modal State
  const [opened, { open, close }] = useDisclosure(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Partner Detail Modal State
  const [partnerModalOpened, { open: openPartnerModal, close: closePartnerModal }] = useDisclosure(false);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<PartnerDetail | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [printInvoicePartner, setPrintInvoicePartner] = useState<PartnerDetail | null>(null);
  const [printInvoiceOrder, setPrintInvoiceOrder] = useState<Order | null>(null);

  // Form State
  const [partnerName, setPartnerName] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [orderDate, setOrderDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [activeStepNames, setActiveStepNames] = useState<string[]>(DEFAULT_STEPS);

  // Client hydration state
  const [mounted, setMounted] = useState(false);

  const selectPartnerData = useMemo(() => {
    const options = allPartners.map(p => ({
      value: p.name,
      label: `${p.name} (${p.type})`
    }));
    if (!partnerName) return options;
    const exists = options.some(opt => opt.value === partnerName);
    if (exists) return options;
    return [{ value: partnerName, label: partnerName }, ...options];
  }, [allPartners, partnerName]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.orders && data.orders.length > 0) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error('API fetch orders error, using fallback mock data:', e);
    }
  }, []);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/partners');
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllPartners(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchOrders();
    fetchPartners();
  }, [fetchOrders, fetchPartners]);

  const resetForm = () => {
    setPartnerName('');
    setItemName('');
    setQuantity(1);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setMemo('');
    setActiveStepNames(DEFAULT_STEPS);
    setEditingOrder(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    open();
  };

  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setPartnerName(order.partnerName);
    setItemName(order.itemName);
    setQuantity(order.quantity);
    setOrderDate(order.orderDate || new Date().toISOString().split('T')[0]);
    setDueDate(order.dueDate || '');
    setMemo(order.memo || '');
    
    const activeNames = (order.steps || [])
      .filter(s => s.active)
      .map(s => s.name);
    setActiveStepNames(activeNames.length > 0 ? activeNames : DEFAULT_STEPS);
    open();
  };

  const handleShowPartnerDetail = (pName: string, order?: Order) => {
    const partner = allPartners.find(p => p.name === pName);
    setSelectedOrderForInvoice(order || null);
    if (partner) {
      setSelectedPartnerDetail(partner);
    } else {
      setSelectedPartnerDetail({
        id: 0,
        name: pName,
        type: '미등록',
        manager: null,
        email: null,
        phone: null,
        tel: null,
        fax: null,
        specialty: '',
        address: null,
        memo: null
      });
    }
    openPartnerModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const processSteps: ProcessStep[] = DEFAULT_STEPS.map(name => {
      const isActive = activeStepNames.includes(name);
      const existingStep = editingOrder?.steps?.find(s => s.name === name);
      return {
        name,
        status: existingStep ? existingStep.status : '대기',
        active: isActive
      };
    });

    const bodyData = {
      partnerName,
      itemName,
      quantity,
      orderDate,
      dueDate,
      memo,
      processSteps
    };

    try {
      const url = editingOrder ? `/api/orders/${editingOrder.id}` : '/api/orders';
      const method = editingOrder ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '저장 중 오류가 발생했습니다.');
        return;
      }

      close();
      resetForm();
      fetchOrders();
    } catch (err) {
      alert('요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleToggleStep = async (order: Order, stepName: string) => {
    const updatedSteps = order.steps.map(s => {
      if (s.name === stepName) {
        const nextStatus: '대기' | '진행중' | '완료' = 
          s.status === '대기' ? '진행중' :
          s.status === '진행중' ? '완료' : '대기';
        return { ...s, status: nextStatus };
      }
      return s;
    });

    const activeSteps = updatedSteps.filter(s => s.active);
    const completedSteps = activeSteps.filter(s => s.status === '완료');
    const newPercent = activeSteps.length > 0 ? Math.round((completedSteps.length / activeSteps.length) * 100) : 0;
    const isAllComplete = activeSteps.length > 0 && completedSteps.length === activeSteps.length;
    const newStatus = isAllComplete ? '완료' : (order.status === '완료' ? '진행중' : order.status);

    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      steps: updatedSteps,
      progressPercent: newPercent,
      status: newStatus
    } : o));

    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processSteps: updatedSteps,
          status: newStatus
        })
      });
      fetchOrders();
    } catch (e) {
      console.error('Failed to update step status:', e);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('이 수주 건을 삭제하시겠습니까?')) {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    }
  };

  const handlePrintPartnerInvoice = (partner: PartnerDetail, order?: Order | null) => {
    setPrintInvoicePartner(partner);
    setPrintInvoiceOrder(order || null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSingleOrderInvoice = (order: Order) => {
    const partner = allPartners.find(p => p.name === order.partnerName) || {
      id: 0,
      name: order.partnerName,
      type: '미등록',
      manager: null,
      email: null,
      phone: null,
      tel: null,
      fax: null,
      specialty: '',
      address: null,
      memo: null
    };
    setPrintInvoicePartner(partner);
    setPrintInvoiceOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const completedCount = orders.filter(o => o.status === '완료').length;
    const inProgressCount = orders.filter(o => o.status !== '완료').length;
    const urgentCount = orders.filter(o => {
      if (o.status === '완료') return false;
      const days = getDaysRemaining(o.dueDate);
      return days !== null && days <= 2;
    }).length;

    return { totalCount, completedCount, inProgressCount, urgentCount };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.partnerName.includes(search) || o.itemName.includes(search);
      
      let matchTab = true;
      if (tabFilter === 'IN_PROGRESS') {
        matchTab = o.status !== '완료';
      } else if (tabFilter === 'URGENT') {
        const days = getDaysRemaining(o.dueDate);
        matchTab = o.status !== '완료' && days !== null && days <= 2;
      } else if (tabFilter === 'COMPLETED') {
        matchTab = o.status === '완료';
      }

      let matchStatusSelect = true;
      if (filterStatus) {
        if (filterStatus === '납기임박') {
          const days = getDaysRemaining(o.dueDate);
          matchStatusSelect = o.status !== '완료' && days !== null && days <= 2;
        } else {
          matchStatusSelect = o.status === filterStatus;
        }
      }

      return matchSearch && matchTab && matchStatusSelect;
    });
  }, [orders, search, filterStatus, tabFilter]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const docId = useMemo(() => Date.now().toString().slice(-6), []);

  const handleExportExcel = () => {
    const exportData = filteredOrders.map(o => {
      const activeSteps = (o.steps || []).filter(s => s.active);
      const inProgressStep = activeSteps.find(s => s.status === '진행중');
      const currentStage = inProgressStep 
        ? `${inProgressStep.name} 진행중`
        : o.status === '완료' 
          ? '전 공정 완료' 
          : '대기 중';

      return {
        '상태': o.status,
        '거래처명': o.partnerName,
        '품목명': o.itemName,
        '수량': o.quantity,
        '발주일': o.orderDate || '-',
        '납기일': o.dueDate || '-',
        '진척도(%)': `${o.progressPercent}%`,
        '현재 공정 단계': currentStage,
        '비고': o.memo || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 10 }, // 상태
      { wch: 20 }, // 거래처명
      { wch: 25 }, // 품목명
      { wch: 8 },  // 수량
      { wch: 12 }, // 발주일
      { wch: 12 }, // 납기일
      { wch: 12 }, // 진척도(%)
      { wch: 22 }, // 현재 공정 단계
      { wch: 30 }, // 비고
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '공정 현황');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `TASS_공정현황_${dateStr}.xlsx`);
  };

  return (
    <>
      {/* SCREEN VIEW (Hidden during print) */}
      <Stack gap="lg" className="print:hidden print-hidden no-print">
        <PageHeaderBanner title="수주 및 공정 진척 관리" subtitle="TASS 생산 공정 현황 모니터링 및 현장 지시용 A4 가로 공정표 인쇄">
          <Button 
            variant="outline" 
            color="gray.0" 
            size="sm"
            leftSection={<IconPrinter size={16} />}
            onClick={() => {
              setPrintInvoicePartner(null);
              window.print();
            }}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            현장 지시용 공정표 A4 가로 인쇄
          </Button>
          <Button 
            variant="filled" 
            color="teal.6" 
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportExcel}
            style={{ fontWeight: 700 }}
          >
            📊 공정 현황 엑셀 다운로드
          </Button>
          <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            새 수주 등록
          </Button>
        </PageHeaderBanner>

        {/* 상태 필터 탭 (수치 통합) */}
        <SegmentedControl
          value={tabFilter}
          onChange={(val: string) => {
            setTabFilter(val as 'ALL' | 'IN_PROGRESS' | 'URGENT' | 'COMPLETED');
            if (val !== 'ALL') setFilterStatus(null);
          }}
          data={[
            { label: `전체 보기 (${metrics.totalCount}건)`, value: 'ALL' },
            { label: `진행 중인 공정 (${metrics.inProgressCount}건)`, value: 'IN_PROGRESS' },
            { label: `🚨 납기 임박 (${metrics.urgentCount}건)`, value: 'URGENT' },
            { label: `완료된 공정 (${metrics.completedCount}건)`, value: 'COMPLETED' },
          ]}
          size="md"
          radius="md"
          className="glass-panel"
          style={{ padding: '6px' }}
        />

        {/* 검색 & 상세 상태 필터 */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="glass-panel" p="md">
          <TextInput 
            placeholder="거래처명 또는 품목명 검색..." 
            value={search} 
            onChange={(e) => setSearch(e.currentTarget.value)} 
            leftSection={<IconSearch size={16} />}
            label="검색"
          />
          <Select
            label="상세 상태 필터"
            placeholder="전체"
            data={['진행중', '납기임박', '완료']}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
          />
        </SimpleGrid>

        {/* 공정 진척도 관리 테이블 */}
        <div className="glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table striped highlightOnHover withTableBorder verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={75} style={{ whiteSpace: 'nowrap' }}>상태</Table.Th>
                <Table.Th w={140}>거래처명</Table.Th>
                <Table.Th w={130}>품목/수량</Table.Th>
                <Table.Th w={110} style={{ whiteSpace: 'nowrap' }}>발주일</Table.Th>
                <Table.Th w={110} style={{ whiteSpace: 'nowrap' }}>납기일</Table.Th>
                <Table.Th style={{ minWidth: 340 }}>공정 진척도 (라이브 스텝 체크)</Table.Th>
                <Table.Th w={90} style={{ whiteSpace: 'nowrap' }}>작업</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrders.map(o => {
                const daysLeft = getDaysRemaining(o.dueDate);
                const isUrgent = o.status !== '완료' && daysLeft !== null && daysLeft <= 2;

                return (
                  <Table.Tr 
                    key={o.id}
                    style={{
                      backgroundColor: isUrgent ? 'rgba(254, 226, 226, 0.40)' : undefined
                    }}
                  >
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Badge 
                        color={o.status === '완료' ? 'green' : isUrgent ? 'red' : 'blue'} 
                        variant={isUrgent ? 'filled' : 'light'}
                        size="md"
                      >
                        {isUrgent ? '납기임박' : o.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="거래처 상세 정보 보기">
                        <Text 
                          fw={700} 
                          c="blue.7"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => handleShowPartnerDetail(o.partnerName, o)}
                        >
                          {o.partnerName}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600}>{o.itemName}</Text>
                      <Text size="xs" c="dimmed">{o.quantity}개</Text>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{o.orderDate || '-'}</Text>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text 
                          size="sm" 
                          fw={isUrgent ? 900 : 600} 
                          color={isUrgent ? 'red.7' : 'dark'}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {o.dueDate || '-'}
                        </Text>
                        {isUrgent && (
                          <Badge 
                            color="red" 
                            variant="filled" 
                            size="xs"
                            style={{ fontWeight: 800 }}
                          >
                            {daysLeft! < 0 ? `D+${Math.abs(daysLeft!)}` : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                  <Table.Td>
                    <Stack gap="xs">
                      {/* 프로그레스 바 */}
                      <Group justify="space-between" gap="xs">
                        <Progress 
                          value={o.progressPercent} 
                          color={o.progressPercent === 100 ? 'teal' : 'blue'} 
                          size="lg" 
                          radius="xl" 
                          animated={o.progressPercent > 0 && o.progressPercent < 100}
                          style={{ flex: 1 }}
                        />
                        <Text size="xs" fw={800} c={o.progressPercent === 100 ? 'teal' : 'blue'}>
                          {o.progressPercent}% 완료
                        </Text>
                      </Group>

                      {/* 공정 스텝 라이브 체크 뱃지 목록 (플랫 미니멀 스타일) */}
                      <Group gap={4} wrap="wrap">
                        {(o.steps || []).filter(s => s.active).map(s => (
                          <Badge
                            key={s.name}
                            size="sm"
                            radius="sm"
                            variant={s.status === '완료' ? 'light' : s.status === '진행중' ? 'filled' : 'outline'}
                            color={s.status === '완료' ? 'dark' : s.status === '진행중' ? 'blue' : 'gray.4'}
                            onClick={() => handleToggleStep(o, s.name)}
                            style={{ 
                              cursor: 'pointer', 
                              userSelect: 'none', 
                              textTransform: 'none', 
                              fontWeight: 600,
                              paddingLeft: '6px',
                              paddingRight: '6px',
                              height: '22px'
                            }}
                          >
                            {s.status === '완료' ? `✓ ${s.name} 완료` : s.status === '진행중' ? `▶ ${s.name} 진행중` : s.name}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="수정">
                          <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handleOpenEdit(o)}>
                            <IconPencil size={17} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="선택 품목 거래명세표/송장 인쇄">
                          <ActionIcon color="indigo.6" variant="subtle" size="sm" onClick={() => handlePrintSingleOrderInvoice(o)}>
                            <IconPrinter size={17} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="삭제">
                          <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDelete(o.id)}>
                            <IconTrash size={17} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                </Table.Tr>
              );
            })}

              {filteredOrders.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} ta="center" py="xl" c="dimmed">
                    조건에 일치하는 수주 건이 없습니다.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {/* 수주 등록 / 수정 모달 */}
        <Modal 
          opened={mounted && opened} 
          onClose={close} 
          title={editingOrder ? "수주 정보 수정" : "새 수주 등록"} 
          size="lg"
          zIndex={300}
          withinPortal={true}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Select
                label="거래처 선택"
                placeholder="거래처를 선택하거나 검색하세요"
                data={selectPartnerData}
                value={partnerName}
                onChange={(val) => setPartnerName(val || '')}
                searchable
                required
              />
              <Group grow>
                <TextInput 
                  label="품목명" 
                  placeholder="예: 안전함, 파이프 용접 구조물" 
                  required 
                  value={itemName} 
                  onChange={(e) => setItemName(e.currentTarget.value)} 
                />
                <NumberInput 
                  label="수량" 
                  min={1} 
                  required 
                  value={quantity} 
                  onChange={setQuantity} 
                />
              </Group>
              <Group grow>
                <TextInput 
                  label="발주일" 
                  type="date" 
                  placeholder="YYYY-MM-DD" 
                  value={orderDate} 
                  onChange={(e) => setOrderDate(e.currentTarget.value)} 
                />
                <TextInput 
                  label="납기일" 
                  type="date" 
                  placeholder="YYYY-MM-DD" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.currentTarget.value)} 
                />
              </Group>

              <Text size="sm" fw={600} mt="xs">적용할 공정 단계 선택 (미진행 공정 제외 가능):</Text>
              <Group gap="md">
                {DEFAULT_STEPS.map(name => (
                  <Checkbox
                    key={name}
                    label={name}
                    checked={activeStepNames.includes(name)}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        setActiveStepNames(prev => [...prev, name]);
                      } else {
                        setActiveStepNames(prev => prev.filter(n => n !== name));
                      }
                    }}
                  />
                ))}
              </Group>

              <Textarea 
                label="비고" 
                placeholder="작업 특이사항이나 고객 요청사항을 입력하세요" 
                value={memo} 
                onChange={(e) => setMemo(e.currentTarget.value)} 
                minRows={2} 
              />

              <Button type="submit" fullWidth mt="md">
                {editingOrder ? "수정사항 저장하기" : "수주 등록하기"}
              </Button>
            </Stack>
          </form>
        </Modal>

        {/* 거래처 상세 정보 팝업 모달 */}
        <Modal
          opened={mounted && partnerModalOpened}
          onClose={closePartnerModal}
          title={`[거래처 상세 정보] ${selectedPartnerDetail?.name || ''}`}
          size="lg"
          zIndex={300}
          withinPortal={true}
        >
          {selectedPartnerDetail && (
            <Card padding="lg" radius="md" style={{ border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC' }}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={900} size="xl" color="dark">{selectedPartnerDetail.name}</Text>
                  <Badge color={selectedPartnerDetail.type === '매입처' ? 'red' : selectedPartnerDetail.type === '협력사' ? 'grape' : 'green'} size="lg">
                    {selectedPartnerDetail.type}
                  </Badge>
                </Group>

                {selectedPartnerDetail.specialty && (
                  <Group gap={4}>
                    <Text size="xs" fw={700} c="dimmed">분야:</Text>
                    {selectedPartnerDetail.specialty.split(',').filter(Boolean).map(s => (
                      <Badge key={s} size="sm" variant="outline">{s}</Badge>
                    ))}
                  </Group>
                )}

                <SimpleGrid cols={2} spacing="xs" mt="sm">
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>담당자</Text>
                    <Text fw={600}>{selectedPartnerDetail.manager || '-'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>팩스 번호</Text>
                    <Text fw={600}>{selectedPartnerDetail.fax || '-'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>휴대폰</Text>
                    <Text fw={600}>{selectedPartnerDetail.phone || '-'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>회사 전화</Text>
                    <Text fw={600}>{selectedPartnerDetail.tel || '-'}</Text>
                  </div>
                </SimpleGrid>

                <div>
                  <Text size="xs" c="dimmed" fw={700}>이메일</Text>
                  <Text fw={600}>{selectedPartnerDetail.email || '-'}</Text>
                </div>

                <div>
                  <Text size="xs" c="dimmed" fw={700}>주소</Text>
                  <Text fw={600}>{selectedPartnerDetail.address || '-'}</Text>
                </div>

                {selectedPartnerDetail.memo && (
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>비고</Text>
                    <Text size="sm">{selectedPartnerDetail.memo}</Text>
                  </div>
                )}

                {selectedOrderForInvoice && (
                  <Group gap="xs" p="xs" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <Badge color="blue" size="sm">선택 수주 품목 지정됨</Badge>
                    <Text size="xs" fw={700} c="blue.9">
                      {selectedOrderForInvoice.itemName} ({selectedOrderForInvoice.quantity}개 / 납기: {selectedOrderForInvoice.dueDate || '-'})
                    </Text>
                  </Group>
                )}

                <Group gap="xs" mt="md" wrap="wrap" grow>
                  {selectedPartnerDetail.phone && (
                    <Button 
                      component="a" 
                      href={`tel:${selectedPartnerDetail.phone}`} 
                      leftSection={<IconPhone size={15} />} 
                      color="blue" 
                      size="xs"
                    >
                      휴대폰
                    </Button>
                  )}
                  {selectedPartnerDetail.tel && (
                    <Button 
                      component="a" 
                      href={`tel:${selectedPartnerDetail.tel}`} 
                      leftSection={<IconPhone size={15} />} 
                      color="teal" 
                      size="xs"
                    >
                      회사전화
                    </Button>
                  )}
                  {selectedPartnerDetail.email && (
                    <Button 
                      component="a" 
                      href={`mailto:${selectedPartnerDetail.email}`} 
                      leftSection={<IconMail size={15} />} 
                      color="violet" 
                      size="xs"
                    >
                      이메일
                    </Button>
                  )}
                  <Button 
                    leftSection={<IconPrinter size={15} />} 
                    color="indigo.6" 
                    size="xs"
                    onClick={() => handlePrintPartnerInvoice(selectedPartnerDetail, selectedOrderForInvoice)}
                  >
                    {selectedOrderForInvoice ? '선택 품목 명세표 출력' : '전체 품목 명세표 출력'}
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </Modal>
      </Stack>

      {/* PRINT VIEW: A4 인쇄 표 양식 (공정표 or 거래처 송장) */}
      <div className="hidden print:block">
        {printInvoicePartner ? (
          <div className="print-container">
            <div className="shipping-label-box" style={{ width: '170mm', margin: 'auto', border: '2px solid #000', padding: '8mm', backgroundColor: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '4mm', marginBottom: '4mm' }}>
                <h2 style={{ fontSize: '18pt', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>TASS 거래명세표 및 운송장 (INVOICE)</h2>
                <span style={{ fontSize: '9pt', color: '#444' }}>발행일자: {todayStr} | 문서번호: TASS-INV-{docId}</span>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '9.5pt' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top', border: '1px solid #000', padding: '3mm' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11pt', borderBottom: '1px solid #000', paddingBottom: '1mm', marginBottom: '2mm' }}>[수하인 (공급받는 자)]</div>
                      <div><strong>상호명:</strong> {printInvoicePartner.name} ({printInvoicePartner.type})</div>
                      <div><strong>담당자:</strong> {printInvoicePartner.manager || '-'}</div>
                      <div><strong>연락처:</strong> {printInvoicePartner.phone || printInvoicePartner.tel || '-'}</div>
                      <div><strong>이메일:</strong> {printInvoicePartner.email || '-'}</div>
                      <div><strong>배송지:</strong> {printInvoicePartner.address || '주소 미등록'}</div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', border: '1px solid #000', padding: '3mm' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '11pt', borderBottom: '1px solid #000', paddingBottom: '1mm', marginBottom: '2mm' }}>[공급자 (발송인)]</div>
                      <div><strong>상호명:</strong> 타스 (TASS)</div>
                      <div><strong>대표자:</strong> 최윤호 (인)</div>
                      <div><strong>연락처:</strong> 010-2621-0056</div>
                      <div><strong>등록번호:</strong> 606-12-34567</div>
                      <div><strong>발송지:</strong> 부산광역시 사상구 감전천로 137</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '10pt' }}>
                [수주 및 출고 품목 내역{printInvoiceOrder ? ` (선택 품목: ${printInvoiceOrder.itemName})` : ''}]
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '4mm' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>순번</th>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>품목명</th>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>수량</th>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>발주일</th>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>납기일</th>
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {(printInvoiceOrder ? [printInvoiceOrder] : orders.filter(o => o.partnerName === printInvoicePartner.name)).map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', fontWeight: 'bold' }}>{item.itemName}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.quantity}개</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.orderDate || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.dueDate || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.status}</td>
                    </tr>
                  ))}
                  {(printInvoiceOrder ? [printInvoiceOrder] : orders.filter(o => o.partnerName === printInvoicePartner.name)).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ border: '1px solid #000', padding: '3mm', textAlign: 'center', color: '#666' }}>
                        해당 거래처의 수주 내역이 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ border: '1px solid #000', padding: '3mm', fontSize: '8.5pt', lineHeight: 1.5 }}>
                <div><strong>[특기사항 및 거래조건]</strong></div>
                <div>{printInvoicePartner.memo || '인수 확인 후 서명 또는 도인을 날인하여 주시기 바랍니다.'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="orders-print-page">
            <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
              <h1 style={{ fontSize: '16pt', fontWeight: 800, margin: 0, padding: 0, display: 'inline-block' }}>
                TASS 현장 지시용 공정 현황표
              </h1>
              <span style={{ fontSize: '9pt', color: '#444', marginLeft: '12px' }}>
                (출력일자: {todayStr} | Technology About Safety Systems)
              </span>
            </div>

          <table className="orders-print-table">
            <thead>
              <tr>
                <th style={{ width: '5%', whiteSpace: 'nowrap' }}>순번</th>
                <th style={{ width: '7%', whiteSpace: 'nowrap' }}>상태</th>
                <th style={{ width: '14%' }}>거래처명</th>
                <th style={{ width: '15%' }}>품목/수량</th>
                <th style={{ width: '11%', whiteSpace: 'nowrap' }}>발주일</th>
                <th style={{ width: '11%', whiteSpace: 'nowrap' }}>납기일</th>
                <th style={{ width: '6%', whiteSpace: 'nowrap' }}>진척율</th>
                <th style={{ width: '31%' }}>공정 단계 현황</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o, idx) => (
                <tr key={o.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: o.status === '완료' ? '#047857' : o.status === '납기임박' ? '#c2410c' : '#1d4ed8' 
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td><strong>{o.partnerName}</strong></td>
                  <td>{o.itemName} ({o.quantity}개)</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{o.orderDate || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{o.dueDate || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><strong>{o.progressPercent}%</strong></td>
                  <td style={{ fontSize: '8.5pt', textAlign: 'left', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                    {(o.steps || []).filter(s => s.active).map((s, i, arr) => (
                      <span key={s.name} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {s.status === '진행중' ? (
                          <span 
                            className="step-highlight" 
                            style={{ 
                              backgroundColor: '#e0f2fe', 
                              color: '#0369a1', 
                              fontWeight: 'bold', 
                              padding: '1px 4px', 
                              borderRadius: '3px', 
                              border: '1px solid #0284c7',
                              fontSize: '8.5pt'
                            }}
                          >
                            ▶ {s.name}
                          </span>
                        ) : (
                          <span style={{ color: s.status === '완료' ? '#059669' : '#6b7280', fontWeight: s.status === '완료' ? 600 : 400, fontSize: '8.5pt' }}>
                            {s.name}
                          </span>
                        )}
                        {i < arr.length - 1 && <span style={{ color: '#9ca3af', margin: '0 2px' }}>➔</span>}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '8mm', textAlign: 'center' }}>
                    출력할 수주/공정 현황 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  );
}
