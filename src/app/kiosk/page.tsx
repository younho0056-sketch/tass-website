"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { notifications } from '@mantine/notifications';
import {
  Button,
  Stack,
  Group,
  Text,
  Badge,
  Modal,
  Paper,
  Loader,
  Center,
  Title,
  Card,
  SimpleGrid,
  Select
} from '@mantine/core';
import {
  IconBuildingFactory2,
  IconBuilding,
  IconCheck,
  IconPlayerPlay,
  IconRefresh,
  IconLock,
  IconClock,
  IconPhone,
  IconMail,
  IconPrinter,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconScreenShare,
  IconScreenShareOff,
  IconDeviceTv,
  IconMapPin
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

export type PartnerDetail = {
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

const PROCESS_TABS = ['전체', '설계', '절단', '가공', '용접', '도장', '조립'];
const ALL_STEPS_SEQUENCE = ['설계', '절단', '가공', '용접', '도장', '조립', '납품'];
const DAY_NAMES = ['일 (Sun)', '월 (Mon)', '화 (Tue)', '수 (Wed)', '목 (Thu)', '금 (Fri)', '토 (Sat)'];

const DEFAULT_STATIONS = [
  '1번 키오스크 (설계/공정)',
  '2번 키오스크 (절단/가공)',
  '3번 키오스크 (용접/도장)',
  '4번 키오스크 (조립/출고)',
];

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

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

  // Station Identification & WebRTC State (Requirement 2)
  const [stationId, setStationId] = useState<string>('1번 키오스크 (설계/공정)');
  const [incomingStream, setIncomingStream] = useState<MediaStream | null>(null);
  const [remoteShareModalOpen, setRemoteShareModalOpen] = useState<boolean>(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const signalingChannelRef = useRef<any>(null);
  const pendingKioskIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Step Action Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [targetWork, setTargetWork] = useState<{
    order: Order;
    step: ProcessStep;
    actionType: 'START' | 'COMPLETE';
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Partner Detail Modal State
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [selectedPartnerDetail, setSelectedPartnerDetail] = useState<PartnerDetail | null>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);

  // Delivery Calendar Modal State
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());

  // Print State
  const [printInvoicePartner, setPrintInvoicePartner] = useState<PartnerDetail | null>(null);
  const [printInvoiceOrder, setPrintInvoiceOrder] = useState<Order | null>(null);

  // Initialize Station ID from URL query or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const qStation = urlParams.get('station');
    if (qStation) {
      const matched = DEFAULT_STATIONS.find((s) => s.startsWith(qStation) || s.includes(qStation));
      if (matched) {
        setStationId(matched);
        return;
      }
    }
    const saved = localStorage.getItem('tass_kiosk_station');
    if (saved) {
      setStationId(saved);
    }
  }, []);

  const handleStationChange = (newStation: string | null) => {
    if (!newStation) return;
    setStationId(newStation);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tass_kiosk_station', newStation);
    }
  };

  // SWR polling with 10s automatic revalidation
  const { data: ordersData, mutate: mutateOrders, isLoading } = useSWR('/api/orders', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const { data: partnersData } = useSWR('/api/partners', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const orders: Order[] = useMemo(() => ordersData?.orders || [], [ordersData]);
  const partners: PartnerDetail[] = useMemo(() => (Array.isArray(partnersData) ? partnersData : []), [partnersData]);

  // Realtime Clock Update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted =
        now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'short',
        }) +
        ' ' +
        now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
      setCurrentTime(formatted);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime Subscription for instant DB sync
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

  // Supabase Realtime Presence & WebRTC Receiver Signal Listener (Requirement 2 & Bug Fix)
  useEffect(() => {
    if (!supabase || !stationId) return;

    // 1. Presence Channel for Admin Online Detection
    const presenceChannel = supabase.channel('kiosk-webrtc-presence', {
      config: { presence: { key: stationId } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          stationId,
          onlineAt: new Date().toISOString(),
        });
      }
    });

    // 2. WebRTC Signaling Broadcast Channel
    const signalingChannel = supabase.channel('kiosk-webrtc-signaling');
    signalingChannelRef.current = signalingChannel;

    signalingChannel
      .on('broadcast', { event: 'signal_offer' }, async (payload: any) => {
        const data = payload?.payload;
        if (data?.targetStationId === stationId && data?.offer) {
          try {
            pendingKioskIceCandidatesRef.current = [];

            const pc = new RTCPeerConnection({
              iceServers: STUN_SERVERS,
            });
            peerConnectionRef.current = pc;

            pc.ontrack = (event) => {
              console.log('Kiosk WebRTC ontrack event received:', event);
              const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
              setIncomingStream((prev) => (prev === stream ? prev : stream));
              setRemoteShareModalOpen(true);
              setIsAutoplayBlocked(false);

              if (event.track) {
                event.track.onended = () => {
                  console.log('Remote WebRTC track ended, closing kiosk stream modal');
                  closeRemoteScreenShare();
                };
              }
            };

            pc.onicecandidate = (event) => {
              if (event.candidate && signalingChannelRef.current) {
                signalingChannelRef.current.send({
                  type: 'broadcast',
                  event: 'signal_ice',
                  payload: {
                    targetStationId: stationId,
                    candidate: event.candidate,
                    from: stationId,
                  },
                });
              }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Process queued candidates
            while (pendingKioskIceCandidatesRef.current.length > 0) {
              const cand = pendingKioskIceCandidatesRef.current.shift();
              if (cand) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            signalingChannel.send({
              type: 'broadcast',
              event: 'signal_answer',
              payload: {
                targetStationId: stationId,
                answer: pc.localDescription,
                from: stationId,
              },
            });
          } catch (err) {
            console.error('Kiosk WebRTC offer processing error:', err);
          }
        }
      })
      .on('broadcast', { event: 'signal_ice' }, async (payload: any) => {
        const data = payload?.payload;
        if (data?.targetStationId === stationId && data?.candidate) {
          const cand = data.candidate;
          const pc = peerConnectionRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          } else {
            pendingKioskIceCandidatesRef.current.push(cand);
          }
        }
      })
      .on('broadcast', { event: 'signal_stop' }, (payload: any) => {
        const data = payload?.payload;
        if (data?.targetStationId === stationId) {
          closeRemoteScreenShare();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(signalingChannel);
    };
  }, [stationId]);

  // Attach incoming video stream & invoke .play() with strict null guard & srcObject re-assignment guard
  useEffect(() => {
    if (!videoRef || !videoRef.current || !incomingStream) return;
    const videoEl = videoRef.current;

    // Prevent duplicate srcObject reassignment on re-renders to eliminate video flickering
    if (videoEl.srcObject !== incomingStream) {
      videoEl.srcObject = incomingStream;
      videoEl.muted = true;
      videoEl
        .play()
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn('Autoplay failed, retrying on user gesture:', err);
          setIsAutoplayBlocked(true);
        });
    }
  }, [incomingStream, remoteShareModalOpen]);

  const closeRemoteScreenShare = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingKioskIceCandidatesRef.current = [];
    setIncomingStream(null);
    setRemoteShareModalOpen(false);
    setIsAutoplayBlocked(false);
  };

  /**
   * Sequential MES Pipeline Logic
   * For each active order, find the FIRST active step in sequence that is NOT '완료'.
   * That single step is the ONLY current eligible work step on the floor for that order.
   */
  const workList = useMemo(() => {
    const list: { order: Order; step: ProcessStep }[] = [];

    orders.forEach((o) => {
      if (o.status === '완료') return;

      const activeSteps = (o.steps || []).filter((s) => s.active);

      // Find the FIRST step in sequence whose status is NOT '완료'
      const currentStep = activeSteps.find((s) => s.status !== '완료');
      if (!currentStep) return;

      if (selectedProcess === '전체' || currentStep.name === selectedProcess) {
        list.push({ order: o, step: currentStep });
      }
    });

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

  /**
   * Top Tab Counts: Exactly 1 per active project for '전체' tab
   */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { 전체: 0 };
    PROCESS_TABS.forEach((tab) => {
      if (tab !== '전체') counts[tab] = 0;
    });

    orders.forEach((o) => {
      if (o.status === '완료') return;
      const activeSteps = (o.steps || []).filter((s) => s.active);

      const currentStep = activeSteps.find((s) => s.status !== '완료');
      if (currentStep) {
        counts['전체'] += 1;
        if (counts[currentStep.name] !== undefined) {
          counts[currentStep.name] += 1;
        }
      }
    });

    return counts;
  }, [orders]);

  // Delivery Calendar Cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const cells: { dateStr: string | null; dayNum: number | null; isCurrentMonth: boolean; dayOfWeek: number }[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ dateStr: null, dayNum: null, isCurrentMonth: false, dayOfWeek: i });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (firstDay + d - 1) % 7;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: true, dayOfWeek });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null, isCurrentMonth: false, dayOfWeek: cells.length % 7 });
    }

    return cells;
  }, [calendarYear, calendarMonth]);

  const prevCalendarMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const nextCalendarMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear((y) => y + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const resetCalendarToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
  };

  // Open Partner Detail Modal
  const handleOpenPartnerDetail = (partnerName: string, order: Order) => {
    setSelectedOrderForInvoice(order);
    const found = partners.find((p) => p.name === partnerName);
    if (found) {
      setSelectedPartnerDetail(found);
    } else {
      setSelectedPartnerDetail({
        id: 0,
        name: partnerName,
        type: '매출처',
        manager: null,
        email: null,
        phone: null,
        tel: null,
        fax: null,
        specialty: '',
        address: null,
        memo: null,
      });
    }
    setPartnerModalOpen(true);
  };

  // Handle Invoice Print
  const handlePrintPartnerInvoice = (partner: PartnerDetail, order: Order | null) => {
    setPrintInvoicePartner(partner);
    setPrintInvoiceOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Handle touch action click for step confirmation modal
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

  const handleSwitchToAdmin = () => {
    router.push('/orders');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
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
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
          }}
        >
          <Stack align="center" gap="xl">
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconLock size={48} color="#2563eb" />
            </div>

            <Stack gap="xs">
              <Title order={1} style={{ fontSize: '28px', color: '#0f172a', fontWeight: 900 }}>
                TASS 현장 키오스크 모드
              </Title>
              <Text size="md" c="gray.6" fw={600}>
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
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)',
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
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Bar (Requirement 2: Station Identifier Selector & WebRTC Indicator) */}
      <header
        className="print:hidden"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
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

          {/* Station Selector Badge (Requirement 2) */}
          <Select
            data={DEFAULT_STATIONS}
            value={stationId}
            onChange={handleStationChange}
            leftSection={<IconMapPin size={18} color="#2563eb" />}
            size="sm"
            style={{ width: '230px', fontWeight: 800 }}
            styles={{
              input: { fontWeight: 800, color: '#1e40af', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
            }}
          />

          <Group gap="xs" visibleFrom="sm">
            <Badge color="teal" variant="light" size="lg" style={{ fontSize: '13px', fontWeight: 700 }}>
              🟢 실시간 DB 동기화
            </Badge>
            {currentTime && (
              <Group gap={4} style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                <IconClock size={16} />
                <span>{currentTime}</span>
              </Group>
            )}
          </Group>
        </Group>

        <Group gap="sm">
          <Button
            variant="light"
            color="gray"
            size="md"
            onClick={() => mutateOrders && mutateOrders()}
            leftSection={<IconRefresh size={18} />}
            style={{ height: '48px', fontWeight: 700 }}
          >
            새로고침
          </Button>

          {/* Delivery Calendar Button */}
          <Button
            variant="light"
            color="indigo"
            size="md"
            onClick={() => setCalendarModalOpen(true)}
            leftSection={<IconCalendar size={20} />}
            style={{ height: '48px', fontWeight: 800 }}
          >
            📅 납기 캘린더
          </Button>

          {/* Switch to Admin Mode Button */}
          <Button
            color="blue"
            size="md"
            radius="md"
            onClick={handleSwitchToAdmin}
            leftSection={<IconBuilding size={20} />}
            style={{
              height: '52px',
              fontSize: '16px',
              fontWeight: 900,
              backgroundColor: '#2563eb',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}
          >
            🏢 관리자 화면으로 전환
          </Button>
        </Group>
      </header>

      {/* 2. Top Process Filter Tabs */}
      <nav
        className="print:hidden"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
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
                  border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#0f172a',
                  fontSize: '20px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: isSelected
                    ? '0 4px 14px rgba(37, 99, 235, 0.3)'
                    : '0 1px 3px rgba(0, 0, 0, 0.03)',
                }}
              >
                <span>{tab}</span>
                <span
                  style={{
                    backgroundColor: isSelected ? '#ffffff' : '#f1f5f9',
                    color: isSelected ? '#1e40af' : '#475569',
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

      {/* 3. Main Content: Work Card List */}
      <main className="print:hidden" style={{ flex: 1, padding: '20px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {isLoading && workList.length === 0 ? (
          <Center style={{ minHeight: '350px' }}>
            <Stack align="center" gap="md">
              <Loader size="xl" color="blue" />
              <Text size="lg" c="gray.6" fw={700}>
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
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                textAlign: 'center',
                maxWidth: 600,
                width: '100%',
              }}
            >
              <Stack align="center" gap="md">
                <IconCheck size={64} color="#16a34a" />
                <Title order={2} style={{ color: '#0f172a', fontWeight: 900 }}>
                  '{selectedProcess}' 공정 대기/진행 작업 완료!
                </Title>
                <Text size="md" c="gray.6" fw={600}>
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
                  p="md"
                  radius="lg"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    minHeight: '140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%', height: '100%' }}>
                    {/* Left Section: Order Info */}
                    <Stack justify="space-between" style={{ width: selectedProcess === '전체' ? '30%' : '60%', height: '100%', minWidth: '260px' }} gap="xs">
                      {/* Top Row: Project No & Current Step Badge */}
                      <Group gap="xs" wrap="nowrap" align="center">
                        <Badge
                          size="lg"
                          variant="filled"
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            fontSize: '15px',
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            padding: '8px 12px',
                            borderRadius: '6px',
                          }}
                        >
                          {displayProjectNo}
                        </Badge>

                        <Badge
                          size="lg"
                          variant="filled"
                          style={{
                            fontSize: '15px',
                            fontWeight: 900,
                            padding: '8px 14px',
                            borderRadius: '6px',
                            backgroundColor: isWaiting ? '#d97706' : '#16a34a',
                            color: '#ffffff',
                          }}
                        >
                          {step.name} ({step.status})
                        </Badge>
                      </Group>

                      {/* Clickable Customer Name */}
                      <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Text
                          onClick={() => handleOpenPartnerDetail(order.partnerName, order)}
                          title="거래처 상세 정보 및 명세표 출력 보기"
                          style={{
                            fontSize: '24px',
                            fontWeight: 900,
                            color: '#2563eb',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {order.partnerName}
                        </Text>
                      </Group>

                      {/* Item Name & Quantity */}
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Text
                          style={{
                            fontSize: '19px',
                            fontWeight: 800,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {order.itemName} <span style={{ color: '#d97706', fontWeight: 900 }}>- {order.quantity}개</span>
                        </Text>
                      </Group>
                    </Stack>

                    {/* Middle Section: Requirement 1 - Horizontal Mini Process Step Bar (Only in '전체' tab) */}
                    {selectedProcess === '전체' && (
                      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Text size="xs" fw={800} c="dimmed" mb={4} ta="center">
                          ⚙️ 전체 공정 단계 스텝 바 (터치하여 개별 공정 조작 가능)
                        </Text>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {ALL_STEPS_SEQUENCE.map((sName) => {
                            const stepObj = (order.steps || []).find((s) => s.name === sName);
                            const isActiveInOrder = stepObj ? stepObj.active : true;
                            const status = stepObj ? stepObj.status : '대기';
                            const isCurrentStep = step.name === sName;

                            if (!isActiveInOrder) return null;

                            return (
                              <button
                                key={sName}
                                onClick={() => {
                                  if (stepObj) {
                                    handleActionClick(order, stepObj);
                                  }
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: isCurrentStep ? 900 : 700,
                                  cursor: 'pointer',
                                  border: isCurrentStep
                                    ? status === '진행중'
                                      ? '2px solid #2563eb'
                                      : '2px solid #d97706'
                                    : status === '완료'
                                    ? '1px solid #86efac'
                                    : '1px solid #cbd5e1',
                                  backgroundColor: status === '완료'
                                    ? '#dcfce7'
                                    : isCurrentStep
                                    ? status === '진행중'
                                      ? '#2563eb'
                                      : '#d97706'
                                    : '#ffffff',
                                  color: status === '완료'
                                    ? '#15803d'
                                    : isCurrentStep
                                    ? '#ffffff'
                                    : '#475569',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isCurrentStep ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
                                }}
                              >
                                {status === '완료' ? `✓ ${sName}` : isCurrentStep ? `▶ ${sName}` : sName}
                              </button>
                            );
                          })}
                        </Group>
                      </div>
                    )}

                    {/* Right Section: Due Date & Action Button */}
                    <Stack align="flex-end" justify="space-between" style={{ height: '100%', minWidth: '210px' }} gap="xs">
                      {/* D-Day & Due Date */}
                      <Group gap="xs" align="center">
                        <Badge
                          size="lg"
                          variant="filled"
                          style={{
                            backgroundColor: dDayInfo.isUrgent ? '#ef4444' : '#2563eb',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 900,
                            padding: '6px 12px',
                            borderRadius: '6px',
                          }}
                        >
                          {dDayInfo.dDayText}
                        </Badge>
                        <Text size="xs" c="gray.6" fw={700}>
                          납기: {order.dueDate || '미정'}
                        </Text>
                      </Group>

                      {/* Right Action Button: Single Large Button in Specific Process Tabs */}
                      {selectedProcess !== '전체' ? (
                        <div style={{ width: '190px', height: '75px' }}>
                          {isWaiting ? (
                            <Button
                              color="blue"
                              fullWidth
                              onClick={() => handleActionClick(order, step)}
                              leftSection={<IconPlayerPlay size={26} />}
                              style={{
                                height: '75px',
                                width: '190px',
                                fontSize: '22px',
                                fontWeight: 900,
                                borderRadius: '12px',
                                backgroundColor: '#2563eb',
                                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                              }}
                            >
                              ▶ 시작
                            </Button>
                          ) : (
                            <Button
                              color="green"
                              fullWidth
                              onClick={() => handleActionClick(order, step)}
                              leftSection={<IconCheck size={28} />}
                              style={{
                                height: '75px',
                                width: '190px',
                                fontSize: '22px',
                                fontWeight: 900,
                                borderRadius: '12px',
                                backgroundColor: '#16a34a',
                                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                              }}
                            >
                              ✓ 완료 처리
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: '160px' }}>
                          {isWaiting ? (
                            <Button
                              color="blue"
                              size="md"
                              fullWidth
                              onClick={() => handleActionClick(order, step)}
                              leftSection={<IconPlayerPlay size={18} />}
                              style={{ fontWeight: 900, height: '48px' }}
                            >
                              ▶ 시작
                            </Button>
                          ) : (
                            <Button
                              color="green"
                              size="md"
                              fullWidth
                              onClick={() => handleActionClick(order, step)}
                              leftSection={<IconCheck size={20} />}
                              style={{ fontWeight: 900, height: '48px' }}
                            >
                              ✓ 완료 처리
                            </Button>
                          )}
                        </div>
                      )}
                    </Stack>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </main>

      {/* 4. WebRTC Full-Screen Incoming Screen Share Overlay Modal (Requirement 2) */}
      <Modal
        opened={remoteShareModalOpen}
        onClose={closeRemoteScreenShare}
        fullScreen
        keepMounted
        zIndex={1000}
        styles={{
          content: { backgroundColor: '#0f172a', color: '#ffffff' },
          header: { backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' },
        }}
        title={
          <Group justify="space-between" align="center" style={{ width: '100%' }}>
            <Group gap="md">
              <IconScreenShare size={28} color="#38bdf8" />
              <Badge color="blue" size="xl" variant="filled" style={{ fontSize: '16px', fontWeight: 900 }}>
                🖥️ 사무실 관리자 화면 실시간 공유 중 (📍 {stationId})
              </Badge>
            </Group>
            <Button
              color="red"
              size="md"
              radius="md"
              onClick={closeRemoteScreenShare}
              leftSection={<IconScreenShareOff size={20} />}
              style={{ fontWeight: 900 }}
            >
              ❌ 화면 닫기
            </Button>
          </Group>
        }
      >
        <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 90px)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
              maxHeight: 'calc(100vh - 100px)',
              objectFit: 'contain',
              borderRadius: '8px',
              pointerEvents: 'none',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          />
          {isAutoplayBlocked && (
            <div
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current
                    .play()
                    .then(() => setIsAutoplayBlocked(false))
                    .catch((err) => console.error('Touch to play error:', err));
                }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 10,
                cursor: 'pointer',
              }}
            >
              <Button size="xl" color="blue" radius="md" leftSection={<IconPlayerPlay size={32} />}>
                ▶ 화면을 터치하여 시청 시작
              </Button>
              <Text size="sm" c="gray.3" mt="xs" fw={700}>
                브라우저 자동재생 차단을 해제하려면 화면을 한 번 터치하세요.
              </Text>
            </div>
          )}
        </div>
      </Modal>

      {/* 5. Delivery Calendar Modal */}
      <Modal
        opened={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        title={
          <Group gap="md" align="center">
            <IconCalendar size={28} color="#2563eb" />
            <Text fw={900} size="xl" c="blue.8">
              TASS 사내 수주 납기 캘린더 ({calendarYear}년 {calendarMonth + 1}월)
            </Text>
          </Group>
        }
        size="90%"
        centered
        radius="lg"
        styles={{
          content: { backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', maxWidth: '1200px' },
          header: { backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' },
        }}
      >
        <Stack gap="md" py="xs">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button variant="light" color="gray" size="sm" onClick={prevCalendarMonth} leftSection={<IconChevronLeft size={16} />}>
                이전달
              </Button>
              <Button variant="light" color="blue" size="sm" onClick={resetCalendarToday}>
                오늘
              </Button>
              <Button variant="light" color="gray" size="sm" onClick={nextCalendarMonth} rightSection={<IconChevronRight size={16} />}>
                다음달
              </Button>
            </Group>

            <Text fw={900} size="lg" c="dark">
              {calendarYear}년 {calendarMonth + 1}월
            </Text>
          </Group>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  {DAY_NAMES.map((day, idx) => (
                    <th
                      key={day}
                      style={{
                        border: '1px solid #cbd5e1',
                        padding: '10px',
                        textAlign: 'center',
                        color: idx === 0 ? '#dc2626' : idx === 6 ? '#2563eb' : '#0f172a',
                        fontWeight: 900,
                        fontSize: '14px',
                      }}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(calendarCells.length / 7) }).map((_, weekIdx) => {
                  const weekDays = calendarCells.slice(weekIdx * 7, weekIdx * 7 + 7);
                  return (
                    <tr key={weekIdx}>
                      {weekDays.map((cell, dayIdx) => {
                        const dayOrders = cell.dateStr ? orders.filter((o) => o.dueDate === cell.dateStr) : [];
                        return (
                          <td
                            key={dayIdx}
                            style={{
                              border: '1px solid #e2e8f0',
                              height: '110px',
                              verticalAlign: 'top',
                              padding: '6px',
                              backgroundColor: !cell.isCurrentMonth ? '#f8fafc' : '#ffffff',
                            }}
                          >
                            {cell.dayNum && (
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: '14px',
                                  marginBottom: '4px',
                                  color: dayIdx === 0 ? '#dc2626' : dayIdx === 6 ? '#2563eb' : '#0f172a',
                                }}
                              >
                                {cell.dayNum}
                              </div>
                            )}

                            <Stack gap={4}>
                              {dayOrders.map((o) => {
                                const isCompleted = o.status === '완료';
                                const dDay = getDDayInfo(o.dueDate);
                                const pNo = o.projectNo || `PRJ-${String(o.id).padStart(3, '0')}`;

                                return (
                                  <div
                                    key={o.id}
                                    style={{
                                      fontSize: '11px',
                                      lineHeight: 1.3,
                                      padding: '4px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: isCompleted
                                        ? '#dcfce7'
                                        : dDay.isUrgent
                                        ? '#fee2e2'
                                        : '#e0f2fe',
                                      color: isCompleted
                                        ? '#15803d'
                                        : dDay.isUrgent
                                        ? '#b91c1c'
                                        : '#0369a1',
                                      fontWeight: 700,
                                    }}
                                  >
                                    [{pNo}] {o.partnerName} - {o.itemName} ({o.quantity}개)
                                  </div>
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
        </Stack>
      </Modal>

      {/* 6. Partner Detail Modal */}
      <Modal
        opened={partnerModalOpen}
        onClose={() => setPartnerModalOpen(false)}
        title={
          <Text fw={900} size="lg" c="dark">
            [거래처 상세 정보] {selectedPartnerDetail?.name || ''}
          </Text>
        }
        size="lg"
        centered
        radius="lg"
        styles={{
          content: { backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' },
          header: { backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' },
        }}
      >
        {selectedPartnerDetail && (
          <Card padding="lg" radius="md" style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={900} size="xl" c="blue.8">{selectedPartnerDetail.name}</Text>
                <Badge color={selectedPartnerDetail.type === '매입처' ? 'red' : selectedPartnerDetail.type === '협력사' ? 'grape' : 'green'} size="lg">
                  {selectedPartnerDetail.type}
                </Badge>
              </Group>

              {selectedPartnerDetail.specialty && (
                <Group gap={4}>
                  <Text size="xs" fw={700} c="dimmed">분야:</Text>
                  {selectedPartnerDetail.specialty.split(',').filter(Boolean).map((s) => (
                    <Badge key={s} size="sm" variant="outline">{s}</Badge>
                  ))}
                </Group>
              )}

              <SimpleGrid cols={2} spacing="xs" mt="sm">
                <div>
                  <Text size="xs" c="dimmed" fw={700}>담당자</Text>
                  <Text fw={700}>{selectedPartnerDetail.manager || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>팩스 번호</Text>
                  <Text fw={700}>{selectedPartnerDetail.fax || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>휴대폰</Text>
                  <Text fw={700}>{selectedPartnerDetail.phone || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>회사 전화</Text>
                  <Text fw={700}>{selectedPartnerDetail.tel || '-'}</Text>
                </div>
              </SimpleGrid>

              <div>
                <Text size="xs" c="dimmed" fw={700}>이메일</Text>
                <Text fw={700}>{selectedPartnerDetail.email || '-'}</Text>
              </div>

              <div>
                <Text size="xs" c="dimmed" fw={700}>주소</Text>
                <Text fw={700}>{selectedPartnerDetail.address || '-'}</Text>
              </div>

              {selectedPartnerDetail.memo && (
                <div>
                  <Text size="xs" c="dimmed" fw={700}>비고</Text>
                  <Text size="sm" fw={600}>{selectedPartnerDetail.memo}</Text>
                </div>
              )}

              {selectedOrderForInvoice && (
                <Group gap="xs" p="xs" style={{ backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
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
                    leftSection={<IconPhone size={16} />}
                    color="blue"
                    size="md"
                    style={{ fontWeight: 800 }}
                  >
                    휴대폰 연결
                  </Button>
                )}
                {selectedPartnerDetail.tel && (
                  <Button
                    component="a"
                    href={`tel:${selectedPartnerDetail.tel}`}
                    leftSection={<IconPhone size={16} />}
                    color="teal"
                    size="md"
                    style={{ fontWeight: 800 }}
                  >
                    회사전화
                  </Button>
                )}
                {selectedPartnerDetail.email && (
                  <Button
                    component="a"
                    href={`mailto:${selectedPartnerDetail.email}`}
                    leftSection={<IconMail size={16} />}
                    color="violet"
                    size="md"
                    style={{ fontWeight: 800 }}
                  >
                    이메일
                  </Button>
                )}
                <Button
                  leftSection={<IconPrinter size={18} />}
                  color="indigo"
                  size="md"
                  style={{ fontWeight: 900 }}
                  onClick={() => handlePrintPartnerInvoice(selectedPartnerDetail, selectedOrderForInvoice)}
                >
                  {selectedOrderForInvoice ? '선택 품목 명세서 출력' : '전체 품목 명세서 출력'}
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
      </Modal>

      {/* 7. Step Confirmation Popup Modal */}
      <Modal
        opened={confirmModalOpen}
        onClose={() => !isUpdating && setConfirmModalOpen(false)}
        title={
          <Text fw={900} size="xl" c="blue.7">
            {targetWork?.actionType === 'START' ? '공정 시작 확인' : '공정 완료 확인'}
          </Text>
        }
        centered
        radius="lg"
        size={480}
        styles={{
          content: { backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' },
          header: { backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' },
        }}
      >
        {targetWork && (
          <Stack gap="lg" py="xs">
            <Paper p="md" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Stack gap="xs">
                <Text size="sm" c="dimmed" fw={700}>
                  [거래처] <span style={{ color: '#2563eb', fontSize: '18px', fontWeight: 900 }}>{targetWork.order.partnerName}</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [품목명] <span style={{ color: '#0f172a', fontSize: '18px', fontWeight: 900 }}>{targetWork.order.itemName} ({targetWork.order.quantity}개)</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [프로젝트] <span style={{ color: '#d97706', fontSize: '16px', fontFamily: 'monospace', fontWeight: 900 }}>{targetWork.order.projectNo || `PRJ-${String(targetWork.order.id).padStart(3, '0')}`}</span>
                </Text>
                <Text size="sm" c="dimmed" fw={700}>
                  [대상 공정] <Badge size="lg" color={targetWork.actionType === 'START' ? 'blue' : 'green'}>{targetWork.step.name}</Badge> ({targetWork.step.status} ➔ {targetWork.actionType === 'START' ? '진행중' : '완료'})
                </Text>
              </Stack>
            </Paper>

            <Text ta="center" fw={800} size="lg" c="gray.8">
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

      {/* 8. Printable Shipping Label / Invoice */}
      <div className="hidden print:block">
        {printInvoicePartner && (
          <div className="print-container">
            <div className="shipping-label-box" style={{ width: '170mm', margin: 'auto', border: '2px solid #000', padding: '8mm', backgroundColor: '#fff', color: '#000' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '4mm', marginBottom: '4mm' }}>
                <h2 style={{ fontSize: '18pt', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>TASS 거래명세표 및 운송장 (INVOICE)</h2>
                <span style={{ fontSize: '9pt', color: '#444' }}>발행일자: {todayStr} | 문서번호: TASS-INV-{printInvoiceOrder?.id || Date.now()}</span>
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
                </tbody>
              </table>

              <div style={{ border: '1px solid #000', padding: '3mm', fontSize: '8.5pt', lineHeight: 1.5 }}>
                <div><strong>[특기사항 및 거래조건]</strong></div>
                <div>{printInvoicePartner.memo || '인수 확인 후 서명 또는 도인을 날인하여 주시기 바랍니다.'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
