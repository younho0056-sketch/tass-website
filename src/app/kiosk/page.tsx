"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { notifications } from '@mantine/notifications';
import {
  Button,
  Stack,
  Group,
  Text,
  Badge,
  Modal,
  Card,
  Paper,
  Loader,
  Center,
  Alert,
  Title
} from '@mantine/core';
import {
  IconBuildingFactory2,
  IconBuilding,
  IconCheck,
  IconPlayerPlay,
  IconAlertTriangle,
  IconRefresh,
  IconLock,
  IconClock,
  IconChevronRight
} from '@tabler/icons-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type ProcessStep = {
  name: string;
  status: '대기' | '진행중' | '완료';
  active: boolean;
  date?: string | null;
  memo?: string | null;
};

export type Order = {
  id: number;
  projectNo?: string | null;
  drawingUrl?: string | null;
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

const PROCESS_TABS = ['전체', '설계', '절단', '가공', '용접', '도장', '조립'];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('API fetch error');
  return res.json();
};

function getDDayInfo(dueDateStr: string | null | undefined): { dDayText: string; isUrgent: boolean; isOverdue: boolean } {
  if (!dueDateStr || !dueDateStr.trim()) {
    return { dDayText: '납기 미정', isUrgent: false, isOverdue: false };
  }
  const target = new Date(dueDateStr.trim());
  if (isNaN(target.getTime())) {
    return { dDayText: '납기 미정', isUrgent: false, isOverdue: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { dDayText: 'D-Day (오늘 납기)', isUrgent: true, isOverdue: false };
  } else if (diffDays < 0) {
    return { dDayText: `D+${Math.abs(diffDays)} (지연)`, isUrgent: true, isOverdue: true };
  } else if (diffDays <= 3) {
    return { dDayText: `D-${diffDays} (임박)`, isUrgent: true, isOverdue: false };
  } else {
    return { dDayText: `D-${diffDays}`, isUrgent: false, isOverdue: false };
  }
}

export default function KioskPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const router = useRouter();

  const [selectedProcess, setSelectedProcess] = useState<string>('전체');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [targetWork, setTargetWork] = useState<{
    order: Order;
    step: ProcessStep;
    actionType: 'START' | 'COMPLETE';
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // SWR polling with 10s automatic revalidation
  const { data: ordersData, mutate: mutateOrders, isLoading } = useSWR('/api/orders', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const orders: Order[] = useMemo(() => ordersData?.orders || [], [ordersData]);

  // Realtime Clock Update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      }) + ' ' + now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setCurrentTime(formatted);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime Subscription for instant cross-device synchronization
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('kiosk-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order' }, () => {
        if (mutateOrders) {
          mutateOrders();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutateOrders]);

  // Extract work items (Order + target ProcessStep) based on current filter
  const workList = useMemo(() => {
    const list: { order: Order; step: ProcessStep }[] = [];

    orders.forEach((o) => {
      // Exclude completely finished orders
      if (o.status === '완료') return;

      const activeSteps = (o.steps || []).filter((s) => s.active);

      activeSteps.forEach((step) => {
        // We only care about pending ('대기') or in-progress ('진행중') work steps
        if (step.status === '대기' || step.status === '진행중') {
          if (selectedProcess === '전체' || step.name === selectedProcess) {
            list.push({ order: o, step });
          }
        }
      });
    });

    // Priority Sort: 1) '진행중' first, 2) Urgent D-Days, 3) Order ID
    return list.sort((a, b) => {
      if (a.step.status !== b.step.status) {
        return a.step.status === '진행중' ? -1 : 1;
      }

      const dDayA = getDDayInfo(a.order.dueDate);
      const dDayB = getDDayInfo(b.order.dueDate);

      if (dDayA.isUrgent !== dDayB.isUrgent) {
        return dDayA.isUrgent ? -1 : 1;
      }

      return a.order.id - b.order.id;
    });
  }, [orders, selectedProcess]);

  // Compute counts for top process filter tabs
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { 전체: 0 };
    PROCESS_TABS.forEach((tab) => {
      if (tab !== '전체') counts[tab] = 0;
    });

    orders.forEach((o) => {
      if (o.status === '완료') return;
      (o.steps || []).forEach((s) => {
        if (s.active && (s.status === '대기' || s.status === '진행중')) {
          counts['전체'] = (counts['전체'] || 0) + 1;
          if (counts[s.name] !== undefined) {
            counts[s.name] += 1;
          }
        }
      });
    });

    return counts;
  }, [orders]);

  // Handle touch action click
  const handleActionClick = (order: Order, step: ProcessStep) => {
    const actionType: 'START' | 'COMPLETE' = step.status === '대기' ? 'START' : 'COMPLETE';
    setTargetWork({ order, step, actionType });
    setConfirmModalOpen(true);
  };

  // Execute DB Status & Date Update
  const executeStatusChange = async () => {
    if (!targetWork) return;
    const { order, step, actionType } = targetWork;
    setIsUpdating(true);

    const nowStr = new Date().toISOString().split('T')[0];

    const nextStatus: '진행중' | '완료' = actionType === 'START' ? '진행중' : '완료';

    const updatedSteps: ProcessStep[] = (order.steps || []).map((s) => {
      if (s.name === step.name) {
        return {
          ...s,
          status: nextStatus,
          date: nowStr,
        };
      }
      return s;
    });

    const activeSteps = updatedSteps.filter((s) => s.active);
    const completedSteps = activeSteps.filter((s) => s.status === '완료');
    const isAllComplete = activeSteps.length > 0 && completedSteps.length === activeSteps.length;
    const newOrderStatus = isAllComplete ? '완료' : '진행중';

    // 1. Instant Optimistic SWR Update
    if (mutateOrders) {
      mutateOrders(
        (current: any) => {
          if (!current?.orders) return current;
          return {
            ...current,
            orders: current.orders.map((o: Order) =>
              o.id === order.id
                ? {
                    ...o,
                    steps: updatedSteps,
                    status: newOrderStatus,
                    progressPercent:
                      activeSteps.length > 0
                        ? Math.round((completedSteps.length / activeSteps.length) * 100)
                        : 0,
                  }
                : o
            ),
          };
        },
        false
      );
    }

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processSteps: updatedSteps,
          status: newOrderStatus,
        }),
      });

      if (!res.ok) {
        throw new Error('서버 업데이트 실패');
      }

      const displayProjectNo = order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;
      notifications.show({
        title: actionType === 'START' ? '▶ 공정 시작 완료' : '✅ 공정 완료 처리 성공',
        message: `[${order.partnerName}] ${displayProjectNo} '${step.name}' 공정이 성공적으로 ${actionType === 'START' ? '시작' : '완료'} 처리되었습니다.`,
        color: actionType === 'START' ? 'blue' : 'teal',
        autoClose: 3500,
        style: { fontSize: '16px', fontWeight: 'bold' },
      });

      if (mutateOrders) mutateOrders();
    } catch (err: any) {
      console.error('Kiosk step update error:', err);
      notifications.show({
        title: '❌ 처리 오류',
        message: 'DB 상태 업데이트 중 오류가 발생했습니다.',
        color: 'red',
        autoClose: 4000,
      });
    } finally {
      setIsUpdating(false);
      setConfirmModalOpen(false);
      setTargetWork(null);
    }
  };

  // Switch to Admin View
  const handleSwitchToAdmin = () => {
    router.push('/orders');
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <Paper
          p="2xl"
          radius="xl"
          style={{
            maxWidth: 520,
            width: '100%',
            backgroundColor: '#1e293b',
            border: '2px solid #334155',
            textAlign: 'center',
          }}
        >
          <Stack align="center" gap="xl">
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 25px rgba(37, 99, 235, 0.5)',
              }}
            >
              <IconLock size={48} color="#ffffff" />
            </div>

            <Stack gap="xs">
              <Title order={1} style={{ fontSize: '28px', color: '#ffffff', fontWeight: 900 }}>
                TASS 현장 키오스크 모드
              </Title>
              <Text size="md" c="gray.4" fw={600}>
                공장 현장 작업을 위해 비밀번호(PIN) 인증이 필요합니다.
              </Text>
            </Stack>

            <Button
              size="xl"
              color="blue"
              fullWidth
              radius="lg"
              onClick={() => openAuthModal('/kiosk')}
              style={{
                height: '72px',
                fontSize: '22px',
                fontWeight: 900,
                letterSpacing: '1px',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
              }}
            >
              🔒 PIN 번호 입력하여 접속
            </Button>
          </Stack>
        </Paper>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Bar */}
      <header
        style={{
          backgroundColor: '#0f172a',
          borderBottom: '2px solid #1e293b',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Group gap="md" align="center">
          <div
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '18px',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconBuildingFactory2 size={24} /> TASS 🏭 현장 키오스크
          </div>

          <Group gap="xs" visibleFrom="sm">
            <Badge color="green" variant="dot" size="lg" style={{ fontSize: '13px', fontWeight: 700 }}>
              🟢 실시간 DB 동기화 중
            </Badge>
            {currentTime && (
              <Group gap={4} style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                <IconClock size={16} />
                <span>{currentTime}</span>
              </Group>
            )}
          </Group>
        </Group>

        <Group gap="sm">
          <Button
            variant="light"
            color="blue"
            size="md"
            onClick={() => mutateOrders && mutateOrders()}
            leftSection={<IconRefresh size={18} />}
            style={{ height: '48px', fontWeight: 700 }}
          >
            새로고침
          </Button>

          {/* Switch to Admin Mode Button (Requirement 1) */}
          <Button
            color="indigo"
            size="md"
            radius="md"
            onClick={handleSwitchToAdmin}
            leftSection={<IconBuilding size={20} />}
            style={{
              height: '52px',
              fontSize: '16px',
              fontWeight: 900,
              backgroundColor: '#3b82f6',
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
            }}
          >
            🏢 관리자 화면으로 전환
          </Button>
        </Group>
      </header>

      {/* 2. Top Large Process Filter Tabs (Requirement 2: min height >= 60px) */}
      <nav
        style={{
          backgroundColor: '#0f172a',
          borderBottom: '2px solid #1e293b',
          padding: '12px 20px',
          overflowX: 'auto',
        }}
      >
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 'max-content' }}>
          {PROCESS_TABS.map((tab) => {
            const isSelected = selectedProcess === tab;
            const count = tabCounts[tab] || 0;

            return (
              <button
                key={tab}
                onClick={() => setSelectedProcess(tab)}
                style={{
                  height: '64px',
                  padding: '0 24px',
                  borderRadius: '12px',
                  border: isSelected ? '3px solid #60a5fa' : '2px solid #334155',
                  backgroundColor: isSelected ? '#2563eb' : '#1e293b',
                  color: '#ffffff',
                  fontSize: '20px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: isSelected
                    ? '0 4px 18px rgba(37, 99, 235, 0.45)'
                    : 'none',
                }}
              >
                <span>{tab}</span>
                <span
                  style={{
                    backgroundColor: isSelected ? '#ffffff' : '#334155',
                    color: isSelected ? '#1e3a8a' : '#cbd5e1',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '16px',
                    fontWeight: 900,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </Group>
      </nav>

      {/* 3. Main Content: Large Card List */}
      <main style={{ flex: 1, padding: '20px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {isLoading && workList.length === 0 ? (
          <Center style={{ minHeight: '350px' }}>
            <Stack align="center" gap="md">
              <Loader size="xl" color="blue" />
              <Text size="lg" c="gray.4" fw={700}>
                현장 작업 데이터를 불러오는 중입니다...
              </Text>
            </Stack>
          </Center>
        ) : workList.length === 0 ? (
          <Center style={{ minHeight: '400px' }}>
            <Paper
              p="2xl"
              radius="xl"
              style={{
                backgroundColor: '#1e293b',
                border: '2px solid #334155',
                textAlign: 'center',
                maxWidth: 600,
                width: '100%',
              }}
            >
              <Stack align="center" gap="md">
                <IconCheck size={64} color="#10b981" />
                <Title order={2} style={{ color: '#ffffff', fontWeight: 900 }}>
                  '{selectedProcess}' 공정 대기/진행 작업 완료!
                </Title>
                <Text size="md" c="gray.4" fw={600}>
                  현재 처리할 작업 카드가 없습니다. 상단 공정 탭을 클릭하여 다른 작업을 확인하세요.
                </Text>
              </Stack>
            </Paper>
          </Center>
        ) : (
          <Stack gap="md">
            {workList.map(({ order, step }) => {
              const displayProjectNo = order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;
              const dDayInfo = getDDayInfo(order.dueDate);
              const isWaiting = step.status === '대기';

              return (
                <Paper
                  key={`${order.id}-${step.name}`}
                  p="lg"
                  radius="lg"
                  style={{
                    backgroundColor: '#1e293b',
                    border: dDayInfo.isUrgent
                      ? '3px solid #ef4444'
                      : isWaiting
                      ? '2px solid #334155'
                      : '3px solid #22c55e',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="wrap" gap="md">
                    {/* Left Info Column (Large, bold, high-contrast text) */}
                    <Stack gap="xs" style={{ flex: 1, minWidth: '280px' }}>
                      {/* Top Row: Badges & D-Day */}
                      <Group gap="sm" wrap="wrap" align="center">
                        {/* Project Number */}
                        <Badge
                          size="xl"
                          variant="filled"
                          color="dark"
                          style={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #475569',
                            fontSize: '16px',
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            padding: '12px 14px',
                            borderRadius: '8px',
                          }}
                        >
                          {displayProjectNo}
                        </Badge>

                        {/* Process Step & Status Badge */}
                        <Badge
                          size="xl"
                          variant="filled"
                          color={isWaiting ? 'amber' : 'green'}
                          style={{
                            fontSize: '18px',
                            fontWeight: 900,
                            padding: '12px 16px',
                            borderRadius: '8px',
                            backgroundColor: isWaiting ? '#d97706' : '#16a34a',
                          }}
                        >
                          {step.name} ({step.status})
                        </Badge>

                        {/* D-Day Highlight Badge (Requirement 2) */}
                        <Badge
                          size="xl"
                          variant="filled"
                          style={{
                            backgroundColor: dDayInfo.isUrgent ? '#ef4444' : '#0284c7',
                            color: '#ffffff',
                            fontSize: '16px',
                            fontWeight: 900,
                            padding: '12px 16px',
                            borderRadius: '8px',
                            boxShadow: dDayInfo.isUrgent ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
                          }}
                        >
                          {dDayInfo.dDayText}
                        </Badge>
                      </Group>

                      {/* Main Title: Customer Name (거래처명 - 24px+ Bold) */}
                      <Text
                        style={{
                          fontSize: '26px',
                          fontWeight: 900,
                          color: '#38bdf8',
                          lineHeight: 1.2,
                        }}
                      >
                        {order.partnerName}
                      </Text>

                      {/* Item Name & Quantity (품목명 및 수량 - 22px+ Bold) */}
                      <Text
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#f8fafc',
                          lineHeight: 1.3,
                        }}
                      >
                        {order.itemName} <span style={{ color: '#f59e0b' }}>- {order.quantity}개</span>
                      </Text>

                      {/* Due Date & Memo */}
                      <Group gap="lg" style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 600 }}>
                        <span>📅 납기일: {order.dueDate || '미정'}</span>
                        {order.memo && <span>📝 메모: {order.memo}</span>}
                      </Group>
                    </Stack>

                    {/* Right Touch Action Button (Requirement 2: Min height >= 60px) */}
                    <div style={{ minWidth: '180px', width: '100%', maxWidth: '240px' }}>
                      {isWaiting ? (
                        /* Blue Button [ ▶ 시작 ] */
                        <Button
                          color="blue"
                          fullWidth
                          onClick={() => handleActionClick(order, step)}
                          leftSection={<IconPlayerPlay size={26} />}
                          style={{
                            height: '68px',
                            fontSize: '22px',
                            fontWeight: 900,
                            borderRadius: '12px',
                            backgroundColor: '#2563eb',
                            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                          }}
                        >
                          ▶ 시작
                        </Button>
                      ) : (
                        /* Green Button [ ✓ 완료 처리 ] */
                        <Button
                          color="green"
                          fullWidth
                          onClick={() => handleActionClick(order, step)}
                          leftSection={<IconCheck size={28} />}
                          style={{
                            height: '68px',
                            fontSize: '22px',
                            fontWeight: 900,
                            borderRadius: '12px',
                            backgroundColor: '#16a34a',
                            boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)',
                          }}
                        >
                          ✓ 완료 처리
                        </Button>
                      )}
                    </div>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </main>

      {/* 4. Touch Confirmation Popup Modal (Requirement 2) */}
      <Modal
        opened={confirmModalOpen}
        onClose={() => !isUpdating && setConfirmModalOpen(false)}
        title={
          <Text fw={900} size="xl" c="blue.4">
            {targetWork?.actionType === 'START' ? '공정 시작 확인' : '공정 완료 확인'}
          </Text>
        }
        centered
        radius="lg"
        size={480}
        styles={{
          content: { backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #3b82f6' },
          header: { backgroundColor: '#1e293b', color: '#ffffff' },
        }}
      >
        {targetWork && (
          <Stack gap="lg" py="xs">
            <Paper p="md" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={700}>
                  [거래처] <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 900 }}>{targetWork.order.partnerName}</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [품목명] <span style={{ color: '#ffffff', fontSize: '18px', fontWeight: 900 }}>{targetWork.order.itemName} ({targetWork.order.quantity}개)</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [프로젝트] <span style={{ color: '#f59e0b', fontSize: '16px', fontFamily: 'monospace', fontWeight: 900 }}>{targetWork.order.projectNo || `PRJ-${String(targetWork.order.id).padStart(3, '0')}`}</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [대상 공정] <Badge size="lg" color={targetWork.actionType === 'START' ? 'blue' : 'green'}>{targetWork.step.name}</Badge> ({targetWork.step.status} ➔ {targetWork.actionType === 'START' ? '진행중' : '완료'})
                </Text>
              </Stack>
            </Paper>

            <Text ta="center" fw={800} size="lg" c="gray.2">
              {targetWork.actionType === 'START'
                ? `'${targetWork.step.name}' 공정을 시작하시겠습니까?`
                : `'${targetWork.step.name}' 공정을 완료 처리하시겠습니까?`}
            </Text>

            <Group grow gap="md">
              <Button
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isUpdating}
                style={{ height: '64px', fontSize: '18px', fontWeight: 800 }}
              >
                취소
              </Button>

              <Button
                color={targetWork.actionType === 'START' ? 'blue' : 'green'}
                size="lg"
                onClick={executeStatusChange}
                loading={isUpdating}
                style={{
                  height: '64px',
                  fontSize: '20px',
                  fontWeight: 900,
                  backgroundColor: targetWork.actionType === 'START' ? '#2563eb' : '#16a34a',
                }}
              >
                {targetWork.actionType === 'START' ? '▶ 시작 확정' : '✓ 완료 확정'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
