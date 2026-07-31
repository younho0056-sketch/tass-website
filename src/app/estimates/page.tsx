"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Button, Stack, Group, Text, Badge, TextInput, 
  Modal, Select, Table, ActionIcon, Tooltip,
  NumberInput, Paper, Textarea,
  SegmentedControl, Alert
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconPlus, IconPencil, IconTrash, IconSearch, 
  IconPrinter, IconDownload, IconAlertTriangle
} from '@tabler/icons-react';
import * as xlsx from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';

type EstimateItem = {
  no: number;
  name: string;
  detail: string;
  spec: string;
  qty: number;
  price: number;
  amount: number;
  memo?: string;
};

type Estimate = {
  id: number;
  docNo: string;
  partnerName: string;
  partnerId: number | null;
  projectName: string;
  quantity: number;
  date: string;
  deliveryTerm: string | null;
  paymentTerm: string | null;
  validity: string | null;
  items: EstimateItem[];
  subtotal: number;
  vat: number;
  totalAmount: number;
  amountInKorean: string | null;
  status: string;
  memo: string | null;
  createdAt: string;
};

type PartnerOption = {
  value: string;
  label: string;
};

const CANCEL_REASONS = ['일정초과', '가격 경쟁력', '역량부족', '고객사 사정'];

// 한글 금액 변환 함수
function numberToKoreanCurrency(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '金 영 원정';
  
  const units = ['', '만', '억', '조'];
  const smallUnits = ['', '십', '백', '천'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

  const numStr = Math.floor(num).toString();
  const len = numStr.length;
  let result = '';

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const pos = len - 1 - i;
    const unitIdx = Math.floor(pos / 4);
    const smallUnitIdx = pos % 4;

    if (digit !== 0) {
      result += digits[digit] + smallUnits[smallUnitIdx];
    }

    if (smallUnitIdx === 0) {
      let sectionHasValue = false;
      const sectionStart = Math.max(0, i - 3);
      for (let k = sectionStart; k <= i; k++) {
        if (parseInt(numStr[k]) !== 0) sectionHasValue = true;
      }
      if (sectionHasValue && units[unitIdx]) {
        result += units[unitIdx] + ' ';
      }
    }
  }

  return `金 ${result.trim()} 원정`;
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    successCount: 0,
    cancelledCount: 0,
    totalAmountSum: 0
  });

  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<string>('ALL');

  // Form & Modal State
  const [opened, { open, close }] = useDisclosure(false);
  const [editingEst, setEditingEst] = useState<Estimate | null>(null);
  const [printTargetEst, setPrintTargetEst] = useState<Estimate | null>(null);

  // Form Fields
  const [docNo, setDocNo] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [date, setDate] = useState('');
  const [deliveryTerm, setDeliveryTerm] = useState('발주 후 상호 협의');
  const [paymentTerm, setPaymentTerm] = useState('납품 후 30일 이내 현금');
  const [validity, setValidity] = useState('견적 제출 후 30일간');
  const [status, setStatus] = useState('견적중');
  const [cancelReason, setCancelReason] = useState<string>('가격 경쟁력');
  const [memo, setMemo] = useState('1. 부가가치세 별도\n2. 납품 및 시공 조건 상호 협의');
  
  // Dynamic Items Form
  const [items, setItems] = useState<EstimateItem[]>([
    { no: 1, name: '', detail: '', spec: '', qty: 1, price: 0, amount: 0 }
  ]);
  const [includeVat, setIncludeVat] = useState(true);

  // Calculated totals
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.qty * item.price), 0);
  }, [items]);

  const vat = useMemo(() => {
    return includeVat ? Math.round(subtotal * 0.1) : 0;
  }, [subtotal, includeVat]);

  const totalAmount = useMemo(() => {
    return subtotal + vat;
  }, [subtotal, vat]);

  const amountInKorean = useMemo(() => {
    return numberToKoreanCurrency(totalAmount);
  }, [totalAmount]);

  const fetchEstimates = useCallback(async () => {
    try {
      const res = await fetch('/api/estimates');
      const data = await res.json();
      if (data.estimates) {
        setEstimates(data.estimates);
      }
      if (data.metrics) {
        setMetrics(data.metrics);
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
        interface PartnerOpt {
          name: string;
          type: string;
        }
        const options = data.map((p: PartnerOpt) => ({
          value: p.name,
          label: `${p.name} (${p.type})`
        }));
        setPartnerOptions(options);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const selectPartnerData = useMemo(() => {
    if (!partnerName) return partnerOptions;
    const exists = partnerOptions.some(opt => opt.value === partnerName);
    if (exists) return partnerOptions;
    return [{ value: partnerName, label: partnerName }, ...partnerOptions];
  }, [partnerOptions, partnerName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEstimates();
    fetchPartners();
  }, [fetchEstimates, fetchPartners]);

  const resetForm = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const docCode = `EST-${todayStr.replace(/-/g, '')}-${Math.floor(10 + Math.random() * 90)}`;
    setDocNo(docCode);
    setPartnerName('');
    setProjectName('');
    setQuantity(1);
    setDate(todayStr);
    setDeliveryTerm('발주 후 상호 협의');
    setPaymentTerm('납품 후 30일 이내 현금');
    setValidity('견적 제출 후 30일간');
    setStatus('견적중');
    setCancelReason('가격 경쟁력');
    setMemo('1. 부가가치세 별도\n2. 납품 및 시공 조건 상호 협의');
    setItems([{ no: 1, name: '', detail: '', spec: '', qty: 1, price: 0, amount: 0 }]);
    setIncludeVat(true);
    setEditingEst(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    open();
  };

  const handleOpenEdit = (est: Estimate) => {
    setEditingEst(est);
    setDocNo(est.docNo);
    setPartnerName(est.partnerName);
    setProjectName(est.projectName);
    setQuantity(est.quantity || 1);
    setDate(est.date);
    setDeliveryTerm(est.deliveryTerm || '');
    setPaymentTerm(est.paymentTerm || '');
    setValidity(est.validity || '');
    setStatus(est.status || '견적중');

    const fullMemo = est.memo || '';
    if (est.status === '수주취소') {
      const match = fullMemo.match(/^\[(.*?)\]\s*([\s\S]*)/);
      if (match && CANCEL_REASONS.includes(match[1])) {
        setCancelReason(match[1]);
        setMemo(match[2]);
      } else {
        setCancelReason('가격 경쟁력');
        setMemo(fullMemo);
      }
    } else {
      setCancelReason('가격 경쟁력');
      setMemo(fullMemo);
    }

    setIncludeVat(est.vat > 0);
    setItems(est.items && est.items.length > 0 ? est.items : [{ no: 1, name: '', detail: '', spec: '', qty: 1, price: 0, amount: 0 }]);
    open();
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { no: prev.length + 1, name: '', detail: '', spec: '', qty: 1, price: 0, amount: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((item, i) => ({ ...item, no: i + 1 }));
    });
  };

  const handleItemChange = (index: number, field: keyof EstimateItem, value: unknown) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'price') {
        const q = field === 'qty' ? Number(value) : item.qty;
        const p = field === 'price' ? Number(value) : item.price;
        item.amount = (q || 0) * (p || 0);
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partnerName) {
      alert('거래처명을 선택하거나 입력하세요.');
      return;
    }
    if (!projectName) {
      alert('공사/프로젝트명을 입력하세요.');
      return;
    }
    if (status === '수주취소' && !cancelReason) {
      alert('수주 취소 사유를 선택해 주세요.');
      return;
    }

    const cleanMemoText = memo ? memo.replace(/^\[.*?\]\s*/, '').trim() : '';
    const finalMemo = status === '수주취소' 
      ? (cleanMemoText ? `[${cancelReason}] ${cleanMemoText}` : `[${cancelReason}]`)
      : memo;

    const bodyData = {
      docNo,
      partnerName,
      projectName,
      quantity,
      date,
      deliveryTerm,
      paymentTerm,
      validity,
      items,
      subtotal,
      vat,
      totalAmount,
      amountInKorean,
      status,
      memo: finalMemo
    };

    try {
      const url = editingEst ? `/api/estimates/${editingEst.id}` : '/api/estimates';
      const method = editingEst ? 'PUT' : 'POST';

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
      fetchEstimates();
    } catch (err) {
      alert('요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('이 견적서를 삭제하시겠습니까?')) {
      await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
      fetchEstimates();
    }
  };

  const handlePrintEstimate = (est: Estimate) => {
    setPrintTargetEst(est);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // 엑셀 다운로드 (TASS 표준 견적서 양식 서식)
  const exportEstimateToExcel = (est: Estimate) => {
    const dataRows = [
      ['TASS 표준 견적서 (Technology About Safety Systems)'],
      [`문서번호: ${est.docNo}`, `견적일자: ${est.date}`],
      [`수신(거래처): ${est.partnerName} 귀하`, `발신: 타스 (TASS) / 대표 최윤호 (010-2621-0056)`],
      [`공사/프로젝트명: ${est.projectName}`, `제품수량: ${est.quantity || 1}개`, `진행상태: ${est.status}`],
      [`납품기한: ${est.deliveryTerm || '-'}`, `지불조건: ${est.paymentTerm || '-'}`, `유효기간: ${est.validity || '-'}`],
      [`합계금액: ${est.amountInKorean || numberToKoreanCurrency(est.totalAmount)} (₩${est.totalAmount.toLocaleString()} - 부가가치세 별도)`],
      [],
      ['순번', '품명 및 규격', '세부 내역', '규격', '수량', '단가(원)', '공급가액(원)']
    ];

    (est.items || []).forEach((item, idx) => {
      dataRows.push([
        (idx + 1).toString(),
        item.name || '',
        item.detail || '',
        item.spec || '',
        (item.qty || 0).toString(),
        (item.price || 0).toLocaleString(),
        (item.amount || 0).toLocaleString()
      ]);
    });

    dataRows.push(
      [],
      ['', '', '', '', '', '공급가액 합계:', est.subtotal.toLocaleString()],
      ['', '', '', '', '', '부가가치세 (10%):', est.vat.toLocaleString()],
      ['', '', '', '', '', '총 견적합계액:', est.totalAmount.toLocaleString()],
      [],
      ['[특기사항 및 수주 취소 사유]'],
      [est.memo || '1. 부가가치세 별도']
    );

    const worksheet = xlsx.utils.aoa_to_sheet(dataRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '견적서');
    xlsx.writeFile(workbook, `TASS_견적서_${est.docNo}_${est.partnerName}.xlsx`);
  };

  const filteredEstimates = useMemo(() => {
    return estimates.filter(est => {
      const matchSearch = est.partnerName.includes(search) || est.projectName.includes(search) || est.docNo.includes(search) || (est.memo && est.memo.includes(search));
      const matchTab = tabFilter === 'ALL' ? true : est.status === tabFilter;
      return matchSearch && matchTab;
    });
  }, [estimates, search, tabFilter]);

  const activePrintEst = printTargetEst || (filteredEstimates.length > 0 ? filteredEstimates[0] : null);

  return (
    <>
      {/* SCREEN VIEW (Hidden during print) */}
      <Stack gap="lg" className="print:hidden print-hidden no-print">
        <PageHeaderBanner title="견적 관리 시스템" subtitle="TASS 견적서 작성, 수주 상태 추적 및 A4 인쇄 / 엑셀 다운로드">
          <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            새 견적서 작성
          </Button>
        </PageHeaderBanner>

        {/* 상태 필터 탭 (4가지 단계 - 수치 통합) */}
        <SegmentedControl
          value={tabFilter}
          onChange={setTabFilter}
          data={[
            { label: `전체 보기 (${metrics.totalCount}건)`, value: 'ALL' },
            { label: `견적중 (${metrics.inProgressCount}건)`, value: '견적중' },
            { label: `견적완료 (${metrics.completedCount}건)`, value: '견적완료' },
            { label: `수주성공 (${metrics.successCount}건)`, value: '수주성공' },
            { label: `수주취소 (${metrics.cancelledCount}건)`, value: '수주취소' },
          ]}
          size="md"
          radius="md"
          className="glass-panel"
          style={{ padding: '6px' }}
        />

        {/* 검색 창 */}
        <Group className="glass-panel" p="md">
          <TextInput 
            placeholder="거래처명, 공사/프로젝트명, 문서번호 또는 취소 사유 검색..." 
            value={search} 
            onChange={(e) => setSearch(e.currentTarget.value)} 
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
          />
        </Group>

        {/* 견적서 목록 테이블 */}
        <div className="glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table striped highlightOnHover withTableBorder verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={125}>문서번호</Table.Th>
                <Table.Th w={105}>일자</Table.Th>
                <Table.Th w={140}>거래처명</Table.Th>
                <Table.Th>공사/프로젝트명</Table.Th>
                <Table.Th w={70} style={{ textAlign: 'center' }}>수량</Table.Th>
                <Table.Th w={130} style={{ textAlign: 'right' }}>견적 금액</Table.Th>
                <Table.Th w={95}>상태</Table.Th>
                <Table.Th w={160}>비고 / 취소 사유</Table.Th>
                <Table.Th w={130}>작업</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEstimates.map(est => {
                const matchMemo = est.memo ? est.memo.match(/^\[(.*?)\]\s*([\s\S]*)/) : null;
                const extractedReason = matchMemo ? matchMemo[1] : null;
                const detailMemo = matchMemo ? matchMemo[2] : (est.memo || '');

                return (
                  <Table.Tr key={est.id}>
                    <Table.Td fw={700}>{est.docNo}</Table.Td>
                    <Table.Td>{est.date}</Table.Td>
                    <Table.Td fw={700} c="blue.7">{est.partnerName}</Table.Td>
                    <Table.Td fw={600}>{est.projectName}</Table.Td>
                    <Table.Td fw={700} style={{ textAlign: 'center' }}>
                      {est.quantity || 1}개
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} fw={900}>
                      ₩{est.totalAmount.toLocaleString()}
                    </Table.Td>
                    <Table.Td>
                      <Badge 
                        color={
                          est.status === '수주성공' ? 'teal' : 
                          est.status === '견적완료' ? 'blue' : 
                          est.status === '수주취소' ? 'red' : 'orange'
                        }
                        variant={
                          est.status === '수주성공' ? 'filled' : 
                          est.status === '수주취소' ? 'outline' : 'light'
                        }
                        size="md"
                      >
                        {est.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {est.status === '수주취소' ? (
                        <Group gap={4} wrap="nowrap">
                          <Badge color="red" variant="light" size="sm">
                            {extractedReason || '수주취소'}
                          </Badge>
                          {detailMemo && (
                            <Tooltip label={detailMemo}>
                              <Text truncate="end" size="xs" c="dimmed" style={{ maxWidth: 85 }}>
                                {detailMemo}
                              </Text>
                            </Tooltip>
                          )}
                        </Group>
                      ) : (
                        <Tooltip label={est.memo || '비고 없음'} disabled={!est.memo}>
                          <Text truncate="end" size="xs" style={{ maxWidth: 145 }}>
                            {est.memo || '-'}
                          </Text>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="수정">
                          <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handleOpenEdit(est)}>
                            <IconPencil size={17} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="A4 견적서 인쇄">
                          <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handlePrintEstimate(est)}>
                            <IconPrinter size={17} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="엑셀 다운로드">
                          <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => exportEstimateToExcel(est)}>
                            <IconDownload size={17} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="삭제">
                          <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDelete(est.id)}>
                            <IconTrash size={17} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}

              {filteredEstimates.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">
                    등록된 견적서가 없습니다.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {/* 견적서 작성 / 수정 모달 */}
        <Modal
          opened={opened}
          onClose={close}
          title={editingEst ? `견적서 수정 (${docNo})` : `TASS 표준 견적서 신규 작성 (${docNo})`}
          size="1100px"
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Group grow>
                <TextInput 
                  label="문서번호" 
                  value={docNo} 
                  onChange={(e) => setDocNo(e.currentTarget.value)} 
                  required 
                />
                <TextInput 
                  label="견적일자" 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.currentTarget.value)} 
                  required 
                />
              </Group>

              <Group grow align="flex-start">
                <Select
                  label="거래처 수신 (귀하)"
                  placeholder="거래처 선택 또는 검색"
                  data={selectPartnerData}
                  value={partnerName}
                  onChange={(val) => setPartnerName(val || '')}
                  searchable
                  required
                  style={{ flex: 2 }}
                />
                <TextInput 
                  label="공사 / 프로젝트명" 
                  placeholder="예: 파이프 정밀 용접 구조물 시공" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.currentTarget.value)} 
                  required 
                  style={{ flex: 2 }}
                />
                <NumberInput 
                  label="제품 수량 (개)" 
                  placeholder="수량"
                  min={1}
                  value={quantity} 
                  onChange={(val) => setQuantity(typeof val === 'number' ? val : 1)} 
                  required 
                  style={{ flex: 1 }}
                />
              </Group>

              <Group grow align="flex-start">
                <TextInput 
                  label="납품기한" 
                  value={deliveryTerm} 
                  onChange={(e) => setDeliveryTerm(e.currentTarget.value)} 
                />
                <TextInput 
                  label="지불조건" 
                  value={paymentTerm} 
                  onChange={(e) => setPaymentTerm(e.currentTarget.value)} 
                />
                <TextInput 
                  label="유효기간" 
                  value={validity} 
                  onChange={(e) => setValidity(e.currentTarget.value)} 
                />
                <Select
                  label="진행 상태"
                  data={['견적중', '견적완료', '수주성공', '수주취소']}
                  value={status}
                  onChange={(val) => setStatus(val || '견적중')}
                  required
                />
                {status === '수주취소' && (
                  <Select
                    label="수주 취소 사유"
                    placeholder="취소 사유 선택"
                    data={CANCEL_REASONS}
                    value={cancelReason}
                    onChange={(val) => setCancelReason(val || '가격 경쟁력')}
                    required
                  />
                )}
              </Group>

              {status === '수주취소' && (
                <Alert color="red" title="수주 취소 사유 선택 및 분석 가이드" icon={<IconAlertTriangle size={16} />}>
                  <Text size="xs">
                    영업 분석 및 사후 피드백을 위해 수주 취소 주요 사유(일정초과, 가격 경쟁력, 역량부족, 고객사 사정)를 선택해 주세요. 세부적인 메모는 아래 비고란에 추가로 기재할 수 있습니다.
                  </Text>
                </Alert>
              )}

              {/* 견적 품목 목록 (동적 행 추가/삭제) */}
              <Text fw={700} size="md" mt="sm">견적 품목 내역</Text>
              
              <Table withTableBorder withColumnBorders verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={45}>순번</Table.Th>
                    <Table.Th w={150}>품명</Table.Th>
                    <Table.Th w={240}>세부내역</Table.Th>
                    <Table.Th w={120}>규격</Table.Th>
                    <Table.Th w={80}>수량</Table.Th>
                    <Table.Th w={120}>단가(원)</Table.Th>
                    <Table.Th w={130}>합계(원)</Table.Th>
                    <Table.Th w={45}>삭제</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item, index) => (
                    <Table.Tr key={index}>
                      <Table.Td ta="center">{index + 1}</Table.Td>
                      <Table.Td>
                        <TextInput 
                          placeholder="품명 입력" 
                          size="xs"
                          value={item.name || ''} 
                          onChange={(e) => handleItemChange(index, 'name', e.currentTarget.value)} 
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput 
                          placeholder="세부내역 입력" 
                          size="xs"
                          value={item.detail || ''} 
                          onChange={(e) => handleItemChange(index, 'detail', e.currentTarget.value)} 
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput 
                          placeholder="규격/사양" 
                          size="xs"
                          value={item.spec || ''} 
                          onChange={(e) => handleItemChange(index, 'spec', e.currentTarget.value)} 
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput 
                          min={1} 
                          size="xs"
                          value={item.qty} 
                          onChange={(val) => handleItemChange(index, 'qty', val)} 
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput 
                          min={0} 
                          size="xs"
                          value={item.price} 
                          onChange={(val) => handleItemChange(index, 'price', val)} 
                        />
                      </Table.Td>
                      <Table.Td fw={700} ta="right">
                        ₩{(item.qty * item.price).toLocaleString()}
                      </Table.Td>
                      <Table.Td ta="center">
                        <ActionIcon color="red" variant="subtle" size="xs" onClick={() => handleRemoveItem(index)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="space-between" mt="xs">
                <Button variant="outline" size="xs" leftSection={<IconPlus size={14} />} onClick={handleAddItem}>
                  품목 행 추가
                </Button>
                <Text size="sm" c="dimmed">
                  부가가치세(VAT 10%) {includeVat ? '포함' : '별도'}
                </Text>
              </Group>

              {/* 금액 집계 및 한글 변환 */}
              <Paper p="md" radius="md" style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" fw={700}>한글 견적 합계액</Text>
                    <Text fw={900} size="lg" color="blue.9">{amountInKorean}</Text>
                  </div>
                  <Stack gap={2} style={{ textAlign: 'right' }}>
                    <Text size="xs">공급가액: ₩{subtotal.toLocaleString()}</Text>
                    <Text size="xs">부가가치세 (10%): ₩{vat.toLocaleString()}</Text>
                    <Text fw={900} size="md" color="teal.8">총 합계금액: ₩{totalAmount.toLocaleString()}</Text>
                  </Stack>
                </Group>
              </Paper>

              <Textarea 
                label={status === '수주취소' ? "추가 세부 특기사항 및 비고 메모 (선택)" : "특기사항 / 비고"} 
                placeholder={status === '수주취소' ? "수주 취소 관련 추가 세부 사항이 있는 경우 입력하세요." : "1. 부가가치세 별도\n2. 납품 및 시공 조건 상호 협의"}
                value={memo} 
                onChange={(e) => setMemo(e.currentTarget.value)} 
                minRows={2} 
              />

              <Button type="submit" color="dark" fullWidth mt="md" size="md">
                {editingEst ? "견적서 수정 완료" : "견적서 등록하기"}
              </Button>
            </Stack>
          </form>
        </Modal>
      </Stack>

      {/* PRINT VIEW: TASS 표준 견적서 A4 양식 (Screen hidden) */}
      <div className="hidden print:block">
        {activePrintEst && (
          <div className="tass-estimate-print-page">
            {/* TASS Watermark */}
            <div className="tass-watermark">TASS</div>

            {/* Title Header */}
            <div style={{ textAlign: 'center', marginBottom: '6mm', borderBottom: '3px double #000', paddingBottom: '3mm' }}>
              <h1 style={{ fontSize: '24pt', fontWeight: 900, letterSpacing: '6px', margin: 0, padding: 0, textDecoration: 'underline' }}>
                견 적 서 (ESTIMATE)
              </h1>
            </div>

            {/* Recipient & Supplier Table Layout */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
              <tbody>
                <tr>
                  {/* Recipient (Left) */}
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '4mm' }}>
                    <div style={{ border: '2px solid #000', padding: '4mm', minHeight: '38mm' }}>
                      <div style={{ fontSize: '15pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2mm', marginBottom: '2mm' }}>
                        {activePrintEst.partnerName} 귀하
                      </div>
                      <div style={{ fontSize: '9.5pt', lineHeight: 1.6 }}>
                        <div><strong>공사명:</strong> {activePrintEst.projectName}</div>
                        <div><strong>제품수량:</strong> {activePrintEst.quantity || 1}개</div>
                        <div><strong>문서번호:</strong> {activePrintEst.docNo}</div>
                        <div><strong>견적일자:</strong> {activePrintEst.date}</div>
                        <div><strong>납품기한:</strong> {activePrintEst.deliveryTerm || '-'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Supplier Info (Right) */}
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '4mm' }}>
                    <div style={{ border: '2px solid #000', padding: '4mm', minHeight: '38mm' }}>
                      <div style={{ fontSize: '11pt', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2mm', marginBottom: '2mm' }}>
                        공급자 (SUPPLIER)
                      </div>
                      <table style={{ width: '100%', fontSize: '9pt', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ width: '25%', fontWeight: 'bold' }}>상호명:</td>
                            <td>타스 (TASS)</td>
                            <td style={{ width: '25%', fontWeight: 'bold' }}>대표자:</td>
                            <td>최윤호 (인)</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>연락처:</td>
                            <td>010-2621-0056</td>
                            <td style={{ fontWeight: 'bold' }}>등록번호:</td>
                            <td>606-12-34567</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>주 소:</td>
                            <td colSpan={3}>부산광역시 사상구 감전천로 137</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total Grand Amount Box */}
            <div style={{ border: '2px solid #000', backgroundColor: '#F1F5F9', padding: '3mm 5mm', marginBottom: '5mm', textAlign: 'center' }}>
              <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>합계금액 (부가가치세 별도): </span>
              <span style={{ fontSize: '14pt', fontWeight: 900, color: '#000', margin: '0 8px' }}>
                {activePrintEst.amountInKorean || numberToKoreanCurrency(activePrintEst.totalAmount)}
              </span>
              <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                (₩{activePrintEst.totalAmount.toLocaleString()})
              </span>
            </div>

            {/* Items Detail Table */}
            <table className="tass-print-items-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm' }}>
              <thead>
                <tr style={{ backgroundColor: '#E2E8F0' }}>
                  <th style={{ width: '6%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>순번</th>
                  <th style={{ width: '22%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>품명</th>
                  <th style={{ width: '26%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>세부내역</th>
                  <th style={{ width: '14%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>규격</th>
                  <th style={{ width: '8%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>수량</th>
                  <th style={{ width: '12%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>단가</th>
                  <th style={{ width: '12%', border: '1px solid #000', padding: '2mm', fontSize: '9pt' }}>공급가액</th>
                </tr>
              </thead>
              <tbody>
                {(activePrintEst.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontSize: '9pt' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', fontWeight: 'bold', fontSize: '9pt' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', fontSize: '8.5pt' }}>{item.detail || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontSize: '8.5pt' }}>{item.spec || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontSize: '9pt' }}>{item.qty}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', fontSize: '9pt' }}>₩{item.price.toLocaleString()}</td>
                    <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', fontWeight: 'bold', fontSize: '9pt' }}>₩{item.amount.toLocaleString()}</td>
                  </tr>
                ))}

                {/* Subtotal & VAT Rows */}
                <tr>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt' }}>
                    소 계 (공급가액)
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', fontWeight: 'bold', fontSize: '9pt' }}>
                    ₩{activePrintEst.subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontWeight: 'bold', fontSize: '9pt' }}>
                    부가가치세 (VAT 10%)
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', fontWeight: 'bold', fontSize: '9pt' }}>
                    ₩{activePrintEst.vat.toLocaleString()}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <td colSpan={5} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontWeight: 900, fontSize: '10pt' }}>
                    총 견 적 합 계 액
                  </td>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right', fontWeight: 900, fontSize: '10.5pt' }}>
                    ₩{activePrintEst.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Terms and Notes Footer */}
            <div style={{ border: '1px solid #000', padding: '3mm 4mm', fontSize: '8.5pt', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>[특기사항 및 거래조건 / 수주 취소 사유]</div>
              <div style={{ whiteSpace: 'pre-line' }}>
                {activePrintEst.memo || '1. 부가가치세 별도\n2. 상기 견적 금액은 제출 후 30일간 유효합니다.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
