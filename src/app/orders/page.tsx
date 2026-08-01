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
  IconPhone, IconMail, IconPrinter
} from '@tabler/icons-react';
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

type PartnerOption = {
  value: string;
  label: string;
};

const DEFAULT_STEPS = ['설계', '절단', '가공', '용접', '도장', '조립/납품'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allPartners, setAllPartners] = useState<PartnerDetail[]>([]);
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    inProgressCount: 0,
    nearingDueCount: 0,
    completedCount: 0
  });

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

  // Order Create/Edit Modal State
  const [opened, { open, close }] = useDisclosure(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Partner Detail Modal State
  const [partnerModalOpened, { open: openPartnerModal, close: closePartnerModal }] = useDisclosure(false);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<PartnerDetail | null>(null);

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
      if (data.orders) {
        setOrders(data.orders);
        setMetrics(data.metrics || { totalCount: 0, inProgressCount: 0, nearingDueCount: 0, completedCount: 0 });
      }
    } catch (e) {
      console.error(e);
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

  const handleShowPartnerDetail = (pName: string) => {
    const partner = allPartners.find(p => p.name === pName);
    if (partner) {
      setSelectedPartnerDetail(partner);
      openPartnerModal();
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
      openPartnerModal();
    }
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

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.partnerName.includes(search) || o.itemName.includes(search);
      const matchStatusSelect = filterStatus ? o.status === filterStatus : true;

      let matchTab = true;
      if (tabFilter === 'IN_PROGRESS') {
        matchTab = o.status !== '완료';
      } else if (tabFilter === 'COMPLETED') {
        matchTab = o.status === '완료';
      }

      return matchSearch && matchStatusSelect && matchTab;
    });
  }, [orders, search, filterStatus, tabFilter]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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
            onClick={() => window.print()}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            현장 지시용 공정표 A4 가로 인쇄
          </Button>
          <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            새 수주 등록
          </Button>
        </PageHeaderBanner>

        {/* 상태 필터 탭 (수치 통합) */}
        <SegmentedControl
          value={tabFilter}
          onChange={(val: string) => {
            setTabFilter(val as 'ALL' | 'IN_PROGRESS' | 'COMPLETED');
            if (val !== 'ALL') setFilterStatus(null);
          }}
          data={[
            { label: `전체 보기 (${metrics.totalCount}건)`, value: 'ALL' },
            { label: `진행 중인 공정 (${metrics.inProgressCount}건)`, value: 'IN_PROGRESS' },
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
              {filteredOrders.map(o => (
                <Table.Tr key={o.id}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <Badge 
                      color={o.status === '완료' ? 'green' : o.status === '납기임박' ? 'orange' : 'blue'} 
                      variant={o.status === '납기임박' ? 'filled' : 'light'}
                      size="md"
                    >
                      {o.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="거래처 상세 정보 보기">
                      <Text 
                        fw={700} 
                        c="blue.7"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => handleShowPartnerDetail(o.partnerName)}
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
                    <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }} color={o.status === '납기임박' ? 'red' : 'dark'}>
                      {o.dueDate || '-'}
                    </Text>
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
                      <Tooltip label="삭제">
                        <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDelete(o.id)}>
                          <IconTrash size={17} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}

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

                <Group gap="sm" mt="md">
                  {selectedPartnerDetail.phone && (
                    <Button 
                      component="a" 
                      href={`tel:${selectedPartnerDetail.phone}`} 
                      leftSection={<IconPhone size={16} />} 
                      color="blue" 
                      size="xs"
                    >
                      휴대폰 전화 연결
                    </Button>
                  )}
                  {selectedPartnerDetail.tel && (
                    <Button 
                      component="a" 
                      href={`tel:${selectedPartnerDetail.tel}`} 
                      leftSection={<IconPhone size={16} />} 
                      color="teal" 
                      size="xs"
                    >
                      회사전화 연결
                    </Button>
                  )}
                  {selectedPartnerDetail.email && (
                    <Button 
                      component="a" 
                      href={`mailto:${selectedPartnerDetail.email}`} 
                      leftSection={<IconMail size={16} />} 
                      color="violet" 
                      size="xs"
                    >
                      이메일 발송
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>
          )}
        </Modal>
      </Stack>

      {/* PRINT VIEW: 현장 지시용 공정 현황 A4 인쇄 표 양식 (Landscape 1Page Fit) */}
      <div className="hidden print:block">
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
      </div>
    </>
  );
}
