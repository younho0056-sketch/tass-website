"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { notifications } from '@mantine/notifications';
import { 
  Button, Stack, Group, Text, Badge, TextInput, 
  Modal, Select, Table, Tooltip, Progress,
  NumberInput, SimpleGrid, Textarea, Checkbox,
  SegmentedControl, Card, Paper, Loader, Center
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconPlus, IconSearch, 
  IconPhone, IconMail, IconPrinter, IconDownload,
  IconChevronLeft, IconChevronRight, IconFolderOpen
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';
import { useAuth } from '@/context/AuthContext';
import OrderRow, { Order, ProcessStep } from '@/components/OrderRow';
import OrderCard from '@/components/OrderCard';
import { compressImage } from '@/lib/imageCompressor';

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

const DEFAULT_STEPS = ['설계', '절단', '가공', '용접', '도장', '조립/납품'];
const DEFAULT_DRIVE_URL = 'https://drive.google.com/drive/folders/13kS6BLYxlVlTlydnv7DGBrU3jG5kjsAZ?usp=sharing';

type SortField = 'partnerName' | 'orderDate' | 'dueDate' | 'progressPercent';
type SortOrder = 'asc' | 'desc';

function getCurrentProcessStage(o: Order): string {
  if (o.status === '완료') return '완료';
  const activeSteps = (o.steps || []).filter(s => s.active);
  const inProgressStep = activeSteps.find(s => s.status === '진행중');
  if (inProgressStep) return inProgressStep.name;
  const waitingStep = activeSteps.find(s => s.status === '대기');
  if (waitingStep) return waitingStep.name;
  return '대기';
}

const DETAIL_FILTER_OPTIONS = [
  { group: '기본 상태 필터', items: [
    { value: '진행중', label: '진행중' },
    { value: '납기임박', label: '🚨 납기임박' },
    { value: '완료', label: '완료' },
  ]},
  { group: '공정 단계별 묶어보기', items: [
    { value: '설계중', label: '📐 설계중' },
    { value: '절단중', label: '✂️ 절단중' },
    { value: '가공중', label: '⚙️ 가공중' },
    { value: '용접중', label: '🔥 용접중' },
    { value: '도장중', label: '🎨 도장중' },
    { value: '조립/납품중', label: '📦 조립/납품중' },
  ]}
];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('API fetch error');
  return res.json();
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allPartners, setAllPartners] = useState<PartnerDetail[]>([]);

  // SWR Caching for instant load & background revalidation
  const { data: ordersData, mutate: mutateOrders, isLoading } = useSWR('/api/orders', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  const { data: partnersData } = useSWR('/api/partners', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  useEffect(() => {
    if (ordersData?.orders && Array.isArray(ordersData.orders)) {
      setOrders(ordersData.orders);
    }
  }, [ordersData]);

  useEffect(() => {
    if (Array.isArray(partnersData)) {
      setAllPartners(partnersData);
    }
  }, [partnersData]);

  // Search, Filter & Sort State
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'IN_PROGRESS' | 'URGENT' | 'COMPLETED'>('IN_PROGRESS');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // View mode & Calendar State
  const [viewMode, setViewMode] = useState<'TABLE' | 'CALENDAR'>('TABLE');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 7, 1));

  const prevMonth = useCallback(() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)), []);
  const nextMonth = useCallback(() => setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)), []);
  const todayMonth = useCallback(() => setCalendarDate(new Date()), []);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string | null; dayNum: number | null; isCurrentMonth: boolean; dayOfWeek: number }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ dateStr: null, dayNum: null, isCurrentMonth: false, dayOfWeek: i });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (firstDay + d - 1) % 7;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: true, dayOfWeek });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null, isCurrentMonth: false, dayOfWeek: cells.length % 7 });
    }

    return cells;
  }, [calendarDate]);

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
  const [projectNo, setProjectNo] = useState('');
  const [drawingUrl, setDrawingUrl] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [orderDate, setOrderDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [activeStepNames, setActiveStepNames] = useState<string[]>(DEFAULT_STEPS);

  // Client hydration state
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortOrder(field === 'progressPercent' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  const renderSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) {
      return <Text component="span" c="gray.4" size="xs" fw={700} style={{ marginLeft: 4 }}>↕</Text>;
    }
    return (
      <Text component="span" c="blue.6" fw={900} size="xs" style={{ marginLeft: 4 }}>
        {sortOrder === 'asc' ? '▲' : '▼'}
      </Text>
    );
  }, [sortField, sortOrder]);

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

  const resetForm = useCallback(() => {
    let nextNum = orders.length + 1;
    orders.forEach(o => {
      if (o.projectNo && o.projectNo.startsWith('PRJ-')) {
        const numPart = parseInt(o.projectNo.replace('PRJ-', ''), 10);
        if (!isNaN(numPart) && numPart >= nextNum) {
          nextNum = numPart + 1;
        }
      }
    });

    setProjectNo(`PRJ-${String(nextNum).padStart(3, '0')}`);
    setDrawingUrl('');
    setPartnerName('');
    setItemName('');
    setQuantity(1);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setMemo('');
    setActiveStepNames(DEFAULT_STEPS);
    setEditingOrder(null);
  }, [orders]);

  const { canEdit, isAuthenticated, openAuthModal } = useAuth();

  const handleUploadPhotos = useCallback(async (order: Order, files: File[]) => {
    if (!isAuthenticated) {
      alert('사진 업로드를 위해 시스템 접속 인증이 필요합니다.');
      openAuthModal('/orders');
      return;
    }

    if (!files || files.length === 0) return;

    const projectNo = order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;
    
    notifications.show({
      id: `upload-${order.id}`,
      title: '📸 원본 현장 사진 무저장 자동 전송 중...',
      message: `${projectNo} (${order.partnerName}) 프로젝트 폴더로 원본 사진 자동 전송 중입니다.`,
      color: 'blue',
      loading: true,
      autoClose: false
    });

    try {
      // 1. Try uploading raw original camera files directly
      let formData = new FormData();
      files.forEach(f => formData.append('files', f));

      let res = await fetch(`/api/orders/${order.id}/photos`, {
        method: 'POST',
        body: formData
      });

      // 2. If payload exceeds Vercel function limit (413), fallback to high quality compressed upload
      if (res.status === 413) {
        const compressedFiles = await Promise.all(
          files.map(file => compressImage(file, 1600, 1600, 0.85))
        );
        formData = new FormData();
        compressedFiles.forEach(f => formData.append('files', f));

        res = await fetch(`/api/orders/${order.id}/photos`, {
          method: 'POST',
          body: formData
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      notifications.update({
        id: `upload-${order.id}`,
        title: '✅ 현장 사진 무저장 자동 업로드 완료!',
        message: `${projectNo} 프로젝트 폴더에 ${files.length}장의 사진이 성공적으로 저장되었습니다. (/blog 갤러리 반영 & 구글 드라이브 백그라운드 원본 자동 업로드 완료)`,
        color: 'teal',
        loading: false,
        autoClose: 5000
      });
    } catch (err: any) {
      console.error('Field photo upload error:', err);
      notifications.update({
        id: `upload-${order.id}`,
        title: '❌ 사진 업로드 실패',
        message: err.message || '사진 업로드 중 오류가 발생했습니다.',
        color: 'red',
        loading: false,
        autoClose: 4000
      });
    }
  }, [isAuthenticated, openAuthModal]);

  const handleOpenCreate = useCallback(() => {
    if (!canEdit) {
      alert('직원 권한(1234)은 신규 수주 등록이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    resetForm();
    open();
  }, [canEdit, resetForm, open]);

  const handleOpenEdit = useCallback((order: Order) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 수주 정보 수정이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    setEditingOrder(order);
    setProjectNo(order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`);
    setDrawingUrl(order.drawingUrl || '');
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
  }, [canEdit, open]);

  const handleShowPartnerDetail = useCallback((pName: string, order?: Order) => {
    setSelectedOrderForInvoice(order || null);
    const partner = allPartners.find(p => p.name === pName);
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
  }, [allPartners, openPartnerModal]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      alert('직원 권한(1234)은 수주 저장이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }

    const processSteps: ProcessStep[] = DEFAULT_STEPS.map(name => {
      const isActive = activeStepNames.includes(name);
      const existingStep = editingOrder?.steps?.find(s => s.name === name);
      return {
        name,
        status: existingStep ? existingStep.status : '대기',
        active: isActive,
        date: existingStep ? existingStep.date : null
      };
    });

    const bodyData = {
      projectNo,
      drawingUrl,
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
      if (mutateOrders) mutateOrders();
    } catch (err) {
      alert('요청 처리 중 오류가 발생했습니다.');
    }
  }, [canEdit, activeStepNames, editingOrder, projectNo, drawingUrl, partnerName, itemName, quantity, orderDate, dueDate, memo, close, resetForm, mutateOrders]);

  // Optimistic Update with instant 0ms state mutation, auto date (M/D) recording, and background API call + rollback on error
  const handleToggleStep = useCallback(async (order: Order, stepName: string) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 공정 단계 변경이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }

    const updatedSteps = order.steps.map(s => {
      if (s.name === stepName) {
        const nextStatus: '대기' | '진행중' | '완료' = 
          s.status === '대기' ? '진행중' :
          s.status === '진행중' ? '완료' : '대기';

        let nextDate: string | null = null;
        if (nextStatus === '진행중' || nextStatus === '완료') {
          const now = new Date();
          nextDate = `${now.getMonth() + 1}/${now.getDate()}`;
        }

        return { ...s, status: nextStatus, date: nextDate };
      }
      return s;
    });

    const activeSteps = updatedSteps.filter(s => s.active);
    const completedSteps = activeSteps.filter(s => s.status === '완료');
    const newPercent = activeSteps.length > 0 ? Math.round((completedSteps.length / activeSteps.length) * 100) : 0;
    const isAllComplete = activeSteps.length > 0 && completedSteps.length === activeSteps.length;
    const newStatus = isAllComplete ? '완료' : (order.status === '완료' ? '진행중' : order.status);

    let snapshotOrders: Order[] = [];

    // 1. Instant (0ms) Optimistic Update on UI & SWR cache
    setOrders(prev => {
      snapshotOrders = prev;
      return prev.map(o => o.id === order.id ? {
        ...o,
        steps: updatedSteps,
        progressPercent: newPercent,
        status: newStatus
      } : o);
    });

    if (mutateOrders) {
      mutateOrders((currentData: any) => {
        if (!currentData?.orders) return currentData;
        return {
          ...currentData,
          orders: currentData.orders.map((o: Order) => o.id === order.id ? {
            ...o,
            steps: updatedSteps,
            progressPercent: newPercent,
            status: newStatus
          } : o)
        };
      }, false);
    }

    // 2. Background DB Update
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processSteps: updatedSteps,
          status: newStatus
        })
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      if (mutateOrders) {
        mutateOrders();
      }
    } catch (e) {
      console.error('Failed to update step status:', e);

      // 3. Rollback on error & show Toast Error Notification
      if (snapshotOrders.length > 0) {
        setOrders(snapshotOrders);
        if (mutateOrders) {
          mutateOrders((currentData: any) => currentData ? { ...currentData, orders: snapshotOrders } : currentData, false);
        }
      }

      notifications.show({
        title: '공정 스텝 변경 실패',
        message: '서버/DB 저장을 완료하지 못하여 이전 상태로 롤백 되었습니다.',
        color: 'red',
        autoClose: 4000
      });
    }
  }, [canEdit, mutateOrders]);

  const handleDelete = useCallback(async (id: number) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 수주 삭제가 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (confirm('이 수주 건을 삭제하시겠습니까?')) {
      setOrders(prev => prev.filter(o => o.id !== id));
      try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete error');
        if (mutateOrders) mutateOrders();
      } catch (e) {
        notifications.show({
          title: '삭제 실패',
          message: '수주 삭제 처리 중 오류가 발생했습니다.',
          color: 'red'
        });
        if (mutateOrders) mutateOrders();
      }
    }
  }, [canEdit, mutateOrders]);

  const handlePrintPartnerInvoice = useCallback((partner: PartnerDetail, order?: Order | null) => {
    setPrintInvoicePartner(partner);
    setPrintInvoiceOrder(order || null);
    setTimeout(() => {
      window.print();
    }, 150);
  }, []);

  const handlePrintSingleOrderInvoice = useCallback((order: Order) => {
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
  }, [allPartners]);

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
    const filtered = orders.filter(o => {
      const pNo = o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`;
      const matchSearch = 
        o.partnerName.includes(search) || 
        o.itemName.includes(search) ||
        pNo.toLowerCase().includes(search.toLowerCase());
      
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
        if (filterStatus === '진행중') {
          matchStatusSelect = o.status !== '완료';
        } else if (filterStatus === '납기임박') {
          const days = getDaysRemaining(o.dueDate);
          matchStatusSelect = o.status !== '완료' && days !== null && days <= 2;
        } else if (filterStatus === '완료') {
          matchStatusSelect = o.status === '완료';
        } else {
          const cleanFilter = filterStatus.replace(/중$/, '');
          const currentStage = getCurrentProcessStage(o);
          matchStatusSelect = currentStage === cleanFilter || currentStage === filterStatus;
        }
      }

      return matchSearch && matchTab && matchStatusSelect;
    });

    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
      let result = 0;
      if (sortField === 'partnerName') {
        result = (a.partnerName || '').localeCompare(b.partnerName || '', 'ko');
      } else if (sortField === 'orderDate') {
        const timeA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
        const timeB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
        result = timeA - timeB;
      } else if (sortField === 'dueDate') {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        result = timeA - timeB;
      } else if (sortField === 'progressPercent') {
        result = (a.progressPercent || 0) - (b.progressPercent || 0);
      }

      return sortOrder === 'asc' ? result : -result;
    });
  }, [orders, search, filterStatus, tabFilter, sortField, sortOrder]);

  const getOrdersForDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return [];
    return filteredOrders.filter(o => {
      const isOrderDate = o.orderDate === dateStr;
      const isDueDate = o.dueDate === dateStr;
      return isOrderDate || isDueDate;
    });
  }, [filteredOrders]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const docId = useMemo(() => Date.now().toString().slice(-6), []);

  const handleExportExcel = useCallback(() => {
    const exportData = filteredOrders.map(o => {
      const activeSteps = (o.steps || []).filter(s => s.active);
      const inProgressStep = activeSteps.find(s => s.status === '진행중');
      const currentStage = inProgressStep 
        ? `${inProgressStep.name}${inProgressStep.date ? `(${inProgressStep.date})` : ''} 진행중`
        : o.status === '완료' 
          ? '전 공정 완료' 
          : '대기 중';

      const stepsHistoryStr = activeSteps
        .map(s => s.date ? `${s.name}(${s.date})` : s.name)
        .join(' ➔ ');

      return {
        '프로젝트 번호': o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`,
        '상태': o.status,
        '거래처명': o.partnerName,
        '품목명': o.itemName,
        '수량': o.quantity,
        '발주일': o.orderDate || '-',
        '납기일': o.dueDate || '-',
        '진척도(%)': `${o.progressPercent}%`,
        '현재 공정 단계': currentStage,
        '전체 공정 이력 (날짜)': stepsHistoryStr,
        '도면 링크': o.drawingUrl || DEFAULT_DRIVE_URL,
        '비고': o.memo || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 25 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 35 },
      { wch: 35 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '공정 현황');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `TASS_공정현황_${dateStr}.xlsx`);
  }, [filteredOrders]);

  return (
    <>
      {/* SCREEN VIEW (Hidden during print) */}
      <Stack gap="lg" className="print:hidden print-hidden no-print">
        <PageHeaderBanner title="수주 및 공정 진척 관리" subtitle="TASS 생산 공정 현황 모니터링 및 현장 지시용 A4 가로 공정표 인쇄">
          <Button 
            variant="outline" 
            color="gray.0" 
            size="sm"
            leftSection={<IconFolderOpen size={16} />}
            component="a"
            href={DEFAULT_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            도면 드라이브 저장소
          </Button>
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
            variant="outline" 
            color="gray.0" 
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={handleExportExcel}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
          >
            📊 공정 현황 엑셀 다운로드
          </Button>
          <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            새 수주 등록
          </Button>
        </PageHeaderBanner>

        {/* 1. 모바일 전용 스마트폰 위젯형 상단 요약 대시보드 (sm 미만 스크린) */}
        <div className="block sm:hidden">
          <SimpleGrid cols={3} spacing="xs">
            {/* 진행중 위젯 카드 */}
            <Card 
              padding="xs" 
              radius="lg" 
              style={{ 
                backgroundColor: tabFilter === 'IN_PROGRESS' ? '#2563eb' : '#ffffff', 
                color: tabFilter === 'IN_PROGRESS' ? '#ffffff' : '#1e293b',
                border: tabFilter === 'IN_PROGRESS' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                setTabFilter('IN_PROGRESS');
                setFilterStatus(null);
              }}
            >
              <Stack gap={2} align="center">
                <Text size="11px" fw={800} style={{ opacity: 0.9 }}>
                  ▶ 진행중
                </Text>
                <Text size="xl" fw={900}>
                  {metrics.inProgressCount}<span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '2px' }}>건</span>
                </Text>
              </Stack>
            </Card>

            {/* 납기임박 위젯 카드 */}
            <Card 
              padding="xs" 
              radius="lg" 
              style={{ 
                backgroundColor: tabFilter === 'URGENT' ? '#ef4444' : '#ffffff', 
                color: tabFilter === 'URGENT' ? '#ffffff' : '#1e293b',
                border: tabFilter === 'URGENT' ? '2px solid #ef4444' : '1px solid #fca5a5',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                setTabFilter('URGENT');
                setFilterStatus(null);
              }}
            >
              <Stack gap={2} align="center">
                <Text size="11px" fw={800} style={{ opacity: 0.9 }}>
                  🚨 납기임박
                </Text>
                <Text size="xl" fw={900} c={tabFilter === 'URGENT' ? 'white' : 'red.7'}>
                  {metrics.urgentCount}<span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '2px' }}>건</span>
                </Text>
              </Stack>
            </Card>

            {/* 완료 위젯 카드 */}
            <Card 
              padding="xs" 
              radius="lg" 
              style={{ 
                backgroundColor: tabFilter === 'COMPLETED' ? '#10b981' : '#ffffff', 
                color: tabFilter === 'COMPLETED' ? '#ffffff' : '#1e293b',
                border: tabFilter === 'COMPLETED' ? '2px solid #10b981' : '1px solid #a7f3d0',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                setTabFilter('COMPLETED');
                setFilterStatus(null);
              }}
            >
              <Stack gap={2} align="center">
                <Text size="11px" fw={800} style={{ opacity: 0.9 }}>
                  ✓ 완료
                </Text>
                <Text size="xl" fw={900} c={tabFilter === 'COMPLETED' ? 'white' : 'teal.8'}>
                  {metrics.completedCount}<span style={{ fontSize: '12px', fontWeight: 600, marginLeft: '2px' }}>건</span>
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>
        </div>

        {/* 2. 데스크톱/태블릿 전용 상태 필터 탭 (sm 이상 스크린) */}
        <div className="hidden sm:block">
          <SegmentedControl
            value={tabFilter}
            onChange={(val: string) => {
              setTabFilter(val as 'ALL' | 'IN_PROGRESS' | 'URGENT' | 'COMPLETED');
              if (val !== 'ALL') setFilterStatus(null);
            }}
            data={[
              { label: `진행 중인 공정 (${metrics.inProgressCount}건)`, value: 'IN_PROGRESS' },
              { label: `🚨 납기 임박 (${metrics.urgentCount}건)`, value: 'URGENT' },
              { label: `완료된 공정 (${metrics.completedCount}건)`, value: 'COMPLETED' },
              { label: `전체 보기 (${metrics.totalCount}건)`, value: 'ALL' },
            ]}
            size="md"
            radius="md"
            className="glass-panel"
            style={{ padding: '6px', width: '100%' }}
          />
        </div>

        {/* 검색 & 상세 상태 필터 */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="glass-panel" p="md">
          <TextInput 
            placeholder="거래처명, 품목명, 프로젝트 번호(PRJ-XXX) 검색..." 
            value={search} 
            onChange={(e) => setSearch(e.currentTarget.value)} 
            leftSection={<IconSearch size={16} />}
            label="검색"
          />
          <Select
            label="상세 상태 필터"
            placeholder="전체"
            data={DETAIL_FILTER_OPTIONS}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
          />
        </SimpleGrid>

        {/* 상단 보기 전환 스위치 (표 보기 vs 캘린더 보기) */}
        <Group justify="space-between" align="center" className="glass-panel" p="xs">
          <Group gap="xs" style={{ paddingLeft: '8px' }}>
            <Text fw={800} size="sm" c="gray.7">
              🖥️ 화면 보기 모드:
            </Text>
            <Badge color={viewMode === 'TABLE' ? 'blue' : 'teal'} variant="light" size="md">
              {viewMode === 'TABLE' ? '📋 목록 표 보기' : '📅 월별 캘린더 보기'}
            </Badge>
          </Group>
          <SegmentedControl
            value={viewMode}
            onChange={(val: string) => setViewMode(val as 'TABLE' | 'CALENDAR')}
            data={[
              { label: '📋 표 보기', value: 'TABLE' },
              { label: '📅 캘린더 보기', value: 'CALENDAR' },
            ]}
            size="md"
            radius="md"
            color="blue"
          />
        </Group>

        {/* 로딩 스피너 및 메인 뷰 */}
        {isLoading && orders.length === 0 ? (
          <Paper p="xl" radius="lg" className="glass-panel">
            <Center p="xl" style={{ minHeight: '280px' }}>
              <Stack align="center" gap="md">
                <Loader size="lg" color="blue" type="dots" />
                <Text fw={700} c="dimmed" size="sm">
                  공정 관리 데이터를 안전하게 불러오는 중입니다...
                </Text>
              </Stack>
            </Center>
          </Paper>
        ) : viewMode === 'CALENDAR' ? (
          <Paper p="md" radius="lg" className="glass-panel">
            {/* 캘린더 컨트롤러 바 */}
            <Group justify="space-between" align="center" mb="md" className="no-print">
              <Group gap="xs">
                <Button variant="light" color="blue" size="sm" onClick={prevMonth} leftSection={<IconChevronLeft size={16} />}>
                  이전달
                </Button>
                <Button variant="outline" color="gray" size="sm" onClick={todayMonth}>
                  오늘
                </Button>
                <Button variant="light" color="blue" size="sm" onClick={nextMonth} rightSection={<IconChevronRight size={16} />}>
                  다음달
                </Button>
              </Group>

              <Text fw={900} size="xl" style={{ letterSpacing: '0.5px' }}>
                📅 {calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월 공정 캘린더
              </Text>

              <Button
                variant="filled"
                color="blue"
                size="sm"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  setPrintInvoicePartner(null);
                  window.print();
                }}
              >
                🖨️ A4 가로 캘린더 인쇄
              </Button>
            </Group>

            {/* 캘린더 그리드 */}
            <div className="table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', tableLayout: 'fixed', minWidth: 750 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    {['일 (Sun)', '월 (Mon)', '화 (Tue)', '수 (Wed)', '목 (Thu)', '금 (Fri)', '토 (Sat)'].map((day, idx) => (
                      <th
                        key={day}
                        style={{
                          padding: '10px 4px',
                          border: '1px solid #cbd5e1',
                          textAlign: 'center',
                          color: idx === 0 ? '#ef4444' : idx === 6 ? '#2563eb' : '#1e293b',
                          fontWeight: 800,
                          fontSize: '13px'
                        }}
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIdx) => {
                    const weekDays = calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
                    return (
                      <tr key={weekIdx}>
                        {weekDays.map((cell, dayIdx) => {
                          const dayOrders = getOrdersForDate(cell.dateStr);
                          const isSun = dayIdx === 0;
                          const isSat = dayIdx === 6;
                          const isToday = cell.dateStr === todayStr;

                          return (
                            <td
                              key={dayIdx}
                              style={{
                                height: '115px',
                                verticalAlign: 'top',
                                padding: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: !cell.isCurrentMonth
                                  ? '#f8fafc'
                                  : isToday
                                  ? '#eff6ff'
                                  : '#ffffff'
                              }}
                            >
                              {cell.dayNum && (
                                <Group justify="space-between" align="center" mb={4}>
                                  <Text
                                    size="xs"
                                    fw={800}
                                    style={{
                                      backgroundColor: isToday ? '#2563eb' : undefined,
                                      color: isToday ? '#ffffff' : isSun ? '#ef4444' : isSat ? '#2563eb' : '#334155',
                                      borderRadius: isToday ? '50%' : undefined,
                                      width: isToday ? '22px' : undefined,
                                      height: isToday ? '22px' : undefined,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      paddingLeft: isToday ? 0 : '2px'
                                    }}
                                  >
                                    {cell.dayNum}
                                  </Text>
                                  {dayOrders.length > 0 && (
                                    <Badge size="xs" color="blue" variant="light">
                                      {dayOrders.length}건
                                    </Badge>
                                  )}
                                </Group>
                              )}

                              <Stack gap={4}>
                                {dayOrders.map(o => {
                                  const isOrderDate = o.orderDate === cell.dateStr;
                                  const isDueDate = o.dueDate === cell.dateStr;
                                  const daysLeft = getDaysRemaining(o.dueDate);
                                  const isCompleted = o.status === '완료';
                                  const isUrgent = !isCompleted && daysLeft !== null && daysLeft <= 2;
                                  const pNo = o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`;

                                  let prefix = '📦 [발주]';
                                  let badgeColor = 'blue';

                                  if (isCompleted) {
                                    prefix = '✅ [완료]';
                                    badgeColor = 'green';
                                  } else if (isDueDate && isUrgent) {
                                    prefix = '🚨 [납기]';
                                    badgeColor = 'red';
                                  } else if (isDueDate) {
                                    prefix = '🚚 [납품]';
                                    badgeColor = 'blue';
                                  } else if (isOrderDate) {
                                    prefix = '📦 [발주]';
                                    badgeColor = 'blue';
                                  }

                                  return (
                                    <Tooltip
                                      key={`${o.id}-${cell.dateStr}`}
                                      label={`[${pNo}] ${o.partnerName} - ${o.itemName} (${o.quantity}개) | 현재상태: ${o.status} (${o.progressPercent}%)`}
                                      multiline
                                      w={220}
                                    >
                                      <Paper
                                        p={4}
                                        radius="sm"
                                        style={{
                                          backgroundColor:
                                            badgeColor === 'green'
                                              ? '#f0fdf4'
                                              : badgeColor === 'red'
                                              ? '#fef2f2'
                                              : '#f0f9ff',
                                          border: `1px solid ${
                                            badgeColor === 'green'
                                              ? '#86efac'
                                              : badgeColor === 'red'
                                              ? '#fca5a5'
                                              : '#93c5fd'
                                          }`,
                                          cursor: 'pointer',
                                          fontSize: '11px',
                                          lineHeight: 1.25
                                        }}
                                        onClick={() => handleShowPartnerDetail(o.partnerName, o)}
                                      >
                                        <Group justify="space-between" gap={2} wrap="nowrap">
                                          <Text size="xs" fw={800} truncate="end" c={badgeColor === 'green' ? 'teal.9' : badgeColor === 'red' ? 'red.9' : 'blue.9'}>
                                            {prefix} {o.itemName}
                                          </Text>
                                          <Badge size="xs" variant="filled" color={badgeColor} style={{ height: '16px', fontSize: '9px', padding: '0 4px', flexShrink: 0 }}>
                                            {isCompleted ? '완료' : `${o.quantity}개`}
                                          </Badge>
                                        </Group>
                                        <Text size="10px" c="gray.6" truncate="end" mt={2}>
                                          [{pNo}] 🏢 {o.partnerName}
                                        </Text>
                                      </Paper>
                                    </Tooltip>
                                  );
                                })}
                              </Stack>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Paper>
        ) : (
          /* 공정 진척도 관리 뷰 (모바일 간편 카드 뷰 vs 데스크톱 테이블 뷰) */
          <>
            {/* 1. 모바일 전용 반응형 카드 뷰 (sm 미만 스크린) */}
            <div className="block sm:hidden">
              <Stack gap="xs">
                {filteredOrders.map(o => {
                  const daysLeft = getDaysRemaining(o.dueDate);
                  const isUrgent = o.status !== '완료' && daysLeft !== null && daysLeft <= 2;

                  return (
                    <OrderCard
                      key={o.id}
                      order={o}
                      daysLeft={daysLeft}
                      isUrgent={isUrgent}
                      onToggleStep={handleToggleStep}
                      onOpenEdit={handleOpenEdit}
                      onDelete={handleDelete}
                      onShowPartnerDetail={handleShowPartnerDetail}
                      onPrintSingleOrderInvoice={handlePrintSingleOrderInvoice}
                      onUploadPhotos={handleUploadPhotos}
                    />
                  );
                })}

                {filteredOrders.length === 0 && (
                  <Paper p="xl" radius="md" className="glass-panel" style={{ textAlign: 'center' }}>
                    <Text c="dimmed">조건에 일치하는 수주 건이 없습니다.</Text>
                  </Paper>
                )}
              </Stack>
            </div>

            {/* 2. 데스크톱/태블릿 표 뷰 (sm 이상 스크린) */}
            <div className="hidden sm:block glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table striped highlightOnHover withTableBorder verticalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>No.</Table.Th>
                    <Table.Th 
                      w={140}
                      onClick={() => handleSort('partnerName')}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text fw={700} size="sm">거래처명</Text>
                        {renderSortIcon('partnerName')}
                      </Group>
                    </Table.Th>
                    <Table.Th w={110} style={{ whiteSpace: 'nowrap' }}>프로젝트 번호</Table.Th>
                    <Table.Th w={130}>품목/수량</Table.Th>
                    <Table.Th 
                      w={110} 
                      style={{ whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('orderDate')}
                    >
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text fw={700} size="sm">발주일</Text>
                        {renderSortIcon('orderDate')}
                      </Group>
                    </Table.Th>
                    <Table.Th 
                      w={110} 
                      style={{ whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('dueDate')}
                    >
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text fw={700} size="sm">납기일</Text>
                        {renderSortIcon('dueDate')}
                      </Group>
                    </Table.Th>
                    <Table.Th 
                      style={{ minWidth: 340, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('progressPercent')}
                    >
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text fw={700} size="sm">공정 진척도 (라이브 스텝 체크 & 날짜)</Text>
                        {renderSortIcon('progressPercent')}
                      </Group>
                    </Table.Th>
                    <Table.Th w={110} style={{ whiteSpace: 'nowrap' }}>작업</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredOrders.map((o, idx) => {
                    const daysLeft = getDaysRemaining(o.dueDate);
                    const isUrgent = o.status !== '완료' && daysLeft !== null && daysLeft <= 2;

                    return (
                      <OrderRow
                        key={o.id}
                        index={idx + 1}
                        order={o}
                        daysLeft={daysLeft}
                        isUrgent={isUrgent}
                        onToggleStep={handleToggleStep}
                        onOpenEdit={handleOpenEdit}
                        onDelete={handleDelete}
                        onShowPartnerDetail={handleShowPartnerDetail}
                        onPrintSingleOrderInvoice={handlePrintSingleOrderInvoice}
                        onUploadPhotos={handleUploadPhotos}
                      />
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={8} ta="center" py="xl" c="dimmed">
                        조건에 일치하는 수주 건이 없습니다.
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </>
        )}

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
              <Group grow>
                <TextInput 
                  label="프로젝트 번호 (Project No.)" 
                  placeholder="예: PRJ-024" 
                  value={projectNo} 
                  onChange={(e) => setProjectNo(e.currentTarget.value)} 
                  required 
                />
                <Select
                  label="거래처 선택"
                  placeholder="거래처를 선택하거나 검색하세요"
                  data={selectPartnerData}
                  value={partnerName}
                  onChange={(val) => setPartnerName(val || '')}
                  searchable
                  required
                />
              </Group>

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

              <TextInput 
                label="개별 도면 / 사진 구글 드라이브 링크 (선택)" 
                placeholder="https://drive.google.com/file/d/..." 
                value={drawingUrl} 
                onChange={(e) => setDrawingUrl(e.currentTarget.value)} 
              />

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
                      [{selectedOrderForInvoice.projectNo || `PRJ-${String(selectedOrderForInvoice.id).padStart(3, '0')}`}] {selectedOrderForInvoice.itemName} ({selectedOrderForInvoice.quantity}개 / 납기: {selectedOrderForInvoice.dueDate || '-'})
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
                    <th style={{ border: '1px solid #000', padding: '2mm' }}>프로젝트 번호</th>
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
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', fontWeight: 'bold' }}>{item.projectNo || `PRJ-${String(item.id).padStart(3, '0')}`}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', fontWeight: 'bold' }}>{item.itemName}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.quantity}개</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.orderDate || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.dueDate || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center' }}>{item.status}</td>
                    </tr>
                  ))}
                  {(printInvoiceOrder ? [printInvoiceOrder] : orders.filter(o => o.partnerName === printInvoicePartner.name)).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ border: '1px solid #000', padding: '3mm', textAlign: 'center', color: '#666' }}>
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
        ) : viewMode === 'CALENDAR' ? (
          <div className="orders-print-page">
            <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
              <h1 style={{ fontSize: '16pt', fontWeight: 800, margin: 0, padding: 0, display: 'inline-block' }}>
                TASS 현장 지시용 월간 공정 캘린더 ({calendarDate.getFullYear()}년 {calendarDate.getMonth() + 1}월)
              </h1>
              <span style={{ fontSize: '9pt', color: '#444', marginLeft: '12px' }}>
                (출력일자: {todayStr} | Technology About Safety Systems)
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  {['일 (Sun)', '월 (Mon)', '화 (Tue)', '수 (Wed)', '목 (Thu)', '금 (Fri)', '토 (Sat)'].map((day, idx) => (
                    <th key={day} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'center', color: idx === 0 ? '#dc2626' : idx === 6 ? '#2563eb' : '#000', fontWeight: 'bold' }}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIdx) => {
                  const weekDays = calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
                  return (
                    <tr key={weekIdx}>
                      {weekDays.map((cell, dayIdx) => {
                        const dayOrders = getOrdersForDate(cell.dateStr);
                        return (
                          <td
                            key={dayIdx}
                            style={{
                              border: '1px solid #000',
                              height: '24mm',
                              verticalAlign: 'top',
                              padding: '1.5mm',
                              backgroundColor: !cell.isCurrentMonth ? '#f8fafc' : '#ffffff'
                            }}
                          >
                            {cell.dayNum && (
                              <div style={{ fontWeight: 'bold', fontSize: '9pt', marginBottom: '1mm', color: dayIdx === 0 ? '#dc2626' : dayIdx === 6 ? '#2563eb' : '#000' }}>
                                {cell.dayNum}
                              </div>
                            )}
                            {dayOrders.map(o => {
                              const isOrderDate = o.orderDate === cell.dateStr;
                              const isDueDate = o.dueDate === cell.dateStr;
                              const isCompleted = o.status === '완료';
                              const daysLeft = getDaysRemaining(o.dueDate);
                              const isUrgent = !isCompleted && daysLeft !== null && daysLeft <= 2;
                              const tag = isCompleted ? '[완료]' : isUrgent ? '[🚨납기]' : isDueDate ? '[🚚납품]' : '[📦발주]';
                              const pNo = o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`;
                              
                              return (
                                <div
                                  key={o.id}
                                  style={{
                                    fontSize: '7.5pt',
                                    lineHeight: 1.2,
                                    marginBottom: '1mm',
                                    padding: '1mm',
                                    border: '1px solid #000',
                                    backgroundColor: isCompleted ? '#e6f4ea' : isUrgent ? '#fce8e6' : '#e8f0fe'
                                  }}
                                >
                                  <strong>{tag}</strong> [{pNo}] {o.itemName} ({o.quantity}개)
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <th style={{ width: '4%', whiteSpace: 'nowrap' }}>순번</th>
                <th style={{ width: '6%', whiteSpace: 'nowrap' }}>상태</th>
                <th style={{ width: '13%' }}>거래처명</th>
                <th style={{ width: '10%', whiteSpace: 'nowrap' }}>프로젝트 번호</th>
                <th style={{ width: '14%' }}>품목/수량</th>
                <th style={{ width: '10%', whiteSpace: 'nowrap' }}>발주일</th>
                <th style={{ width: '10%', whiteSpace: 'nowrap' }}>납기일</th>
                <th style={{ width: '5%', whiteSpace: 'nowrap' }}>진척율</th>
                <th style={{ width: '28%' }}>공정 단계 현황</th>
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
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>{o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`}</td>
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
                            ▶ {s.name}{s.date ? `(${s.date})` : ''}
                          </span>
                        ) : (
                          <span style={{ color: s.status === '완료' ? '#059669' : '#6b7280', fontWeight: s.status === '완료' ? 600 : 400, fontSize: '8.5pt' }}>
                            {s.name}{s.date ? `(${s.date})` : ''}
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
                  <td colSpan={9} style={{ padding: '8mm', textAlign: 'center' }}>
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
