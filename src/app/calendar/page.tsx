"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Switch,
  ActionIcon,
  SegmentedControl,
  Tooltip,
  Divider,
  ScrollArea,
  Card,
  Container,
  Grid,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconCalendar,
  IconClock,
  IconUser,
  IconTrash,
  IconEdit,
  IconRefresh,
  IconCheck,
  IconBuildingStore,
  IconListCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { isKoreanHoliday } from '@/lib/holidays';

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string | null;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  isAllDay: boolean;
  colorTag: string;
  category: string;
  authorName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isOrderDueDate?: boolean; // TASS integration synthetic item
  orderId?: number;
}

const COLOR_PALETTE: { label: string; value: string; bg: string; text: string; border: string }[] = [
  { label: '파랑', value: 'blue', bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  { label: '녹색', value: 'green', bg: '#10b981', text: '#ffffff', border: '#059669' },
  { label: '빨강', value: 'red', bg: '#ef4444', text: '#ffffff', border: '#dc2626' },
  { label: '주황', value: 'orange', bg: '#f97316', text: '#ffffff', border: '#ea580c' },
  { label: '보라', value: 'purple', bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
  { label: '청록', value: 'teal', bg: '#14b8a6', text: '#ffffff', border: '#0d9488' },
  { label: '분홍', value: 'pink', bg: '#ec4899', text: '#ffffff', border: '#db2777' },
];

const CATEGORIES = [
  '[일반]',
  '[지원사업]',
  '[미팅/회의]',
  '[현장실사/투어]',
  '[발주/납기]',
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const formattedHours = String(hours % 12 || 12).padStart(2, '0');
    return `${ampm} ${formattedHours}:${minutes}`;
  } catch {
    return '';
  }
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [includeOrders, setIncludeOrders] = useState<boolean>(true);
  const [orders, setOrders] = useState<any[]>([]);

  // Selected date popover/modal
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [dateDetailModalOpen, setDateDetailModalOpen] = useState<boolean>(false);

  // Add/Edit schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('[일반]');
  const [formColorTag, setFormColorTag] = useState('blue');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formStartDate, setFormStartDate] = useState(''); // YYYY-MM-DD
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndDate, setFormEndDate] = useState('');   // YYYY-MM-DD
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formAuthorName, setFormAuthorName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch Schedules from Supabase API
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Fetch schedules error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch TASS Orders for Due Date integration
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Fetch orders error:', err);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchOrders();
  }, [fetchSchedules, fetchOrders]);

  // Supabase Realtime Live Sync Subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:schedules')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          console.log('Realtime schedule update:', payload);
          fetchSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSchedules]);

  // Merge regular schedules with synthetic order due dates if enabled
  const combinedSchedules = useMemo(() => {
    const list: ScheduleItem[] = [...schedules];

    if (includeOrders && orders.length > 0) {
      orders.forEach((ord) => {
        if (ord.dueDate) {
          const dueIso = new Date(`${ord.dueDate}T09:00:00`).toISOString();
          list.push({
            id: `order-due-${ord.id}`,
            title: `[납기일] ${ord.partnerName} - ${ord.itemName}`,
            description: `프로젝트 번호: ${ord.projectNo || '-'}\n수량: ${ord.quantity}개\n상태: ${ord.status}\n메모: ${ord.memo || '없음'}`,
            startDate: dueIso,
            endDate: dueIso,
            isAllDay: true,
            colorTag: ord.status === '납기임박' ? 'red' : 'orange',
            category: '[발주/납기]',
            authorName: 'TASS 수주시스템',
            isOrderDueDate: true,
            orderId: ord.id,
          });
        }
      });
    }

    return list;
  }, [schedules, orders, includeOrders]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Modal for New Schedule
  const openNewScheduleModal = (initialDateStr?: string) => {
    setEditingSchedule(null);
    const targetDate = initialDateStr || formatDateKey(new Date());
    setFormTitle('');
    setFormCategory('[일반]');
    setFormColorTag('blue');
    setFormIsAllDay(false);
    setFormStartDate(targetDate);
    setFormStartTime('09:00');
    setFormEndDate(targetDate);
    setFormEndTime('18:00');
    setFormAuthorName('');
    setFormDescription('');
    setScheduleModalOpen(true);
  };

  // Open Modal for Editing Schedule
  const openEditScheduleModal = (sched: ScheduleItem) => {
    if (sched.isOrderDueDate) {
      alert('TASS 수주/공정 관리에서 자동 연동된 납기일은 수주 관리 메뉴에서 변경해 주세요.');
      return;
    }
    setEditingSchedule(sched);
    setFormTitle(sched.title);
    setFormCategory(sched.category || '[일반]');
    setFormColorTag(sched.colorTag || 'blue');
    setFormIsAllDay(sched.isAllDay);

    const startObj = new Date(sched.startDate);
    const endObj = new Date(sched.endDate);

    setFormStartDate(formatDateKey(startObj));
    setFormStartTime(
      `${String(startObj.getHours()).padStart(2, '0')}:${String(startObj.getMinutes()).padStart(2, '0')}`
    );
    setFormEndDate(formatDateKey(endObj));
    setFormEndTime(
      `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`
    );

    setFormAuthorName(sched.authorName || '');
    setFormDescription(sched.description || '');
    setDateDetailModalOpen(false);
    setScheduleModalOpen(true);
  };

  // Save Schedule Handler (Create or Update)
  const handleSaveSchedule = async () => {
    if (!formTitle.trim()) {
      alert('일정 제목을 입력해 주세요.');
      return;
    }
    if (!formStartDate || !formEndDate) {
      alert('시작 날짜와 종료 날짜를 선택해 주세요.');
      return;
    }

    try {
      setSaving(true);

      const startIso = formIsAllDay
        ? new Date(`${formStartDate}T00:00:00`).toISOString()
        : new Date(`${formStartDate}T${formStartTime}:00`).toISOString();

      const endIso = formIsAllDay
        ? new Date(`${formEndDate}T23:59:59`).toISOString()
        : new Date(`${formEndDate}T${formEndTime}:00`).toISOString();

      const payload = {
        title: formTitle,
        category: formCategory,
        colorTag: formColorTag,
        isAllDay: formIsAllDay,
        startDate: startIso,
        endDate: endIso,
        authorName: formAuthorName,
        description: formDescription,
      };

      let res;
      if (editingSchedule) {
        res = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setScheduleModalOpen(false);
        fetchSchedules();
      } else {
        const errData = await res.json();
        alert(`저장 실패: ${errData.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error('Save schedule error:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Schedule Handler
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDateDetailModalOpen(false);
        setScheduleModalOpen(false);
        fetchSchedules();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Delete schedule error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // Month Calendar Days Grid Calculation
  const monthWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startSunday = new Date(firstDay);
    startSunday.setDate(firstDay.getDate() - firstDay.getDay());

    const endSaturday = new Date(lastDay);
    if (lastDay.getDay() !== 6) {
      endSaturday.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    }

    const weeks: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean; isSunday: boolean; isSaturday: boolean; holidayName: string | null }[][] = [];

    const todayStr = formatDateKey(new Date());
    let curr = new Date(startSunday);

    while (curr <= endSaturday) {
      const week: any[] = [];
      for (let i = 0; i < 7; i++) {
        const dStr = formatDateKey(curr);
        const dayNum = curr.getDay();
        const holiday = isKoreanHoliday(dStr);

        week.push({
          date: new Date(curr),
          dateStr: dStr,
          isCurrentMonth: curr.getMonth() === month,
          isToday: dStr === todayStr,
          isSunday: dayNum === 0,
          isSaturday: dayNum === 6,
          holidayName: holiday,
        });

        curr.setDate(curr.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  }, [currentDate]);

  // Week View Days Calculation
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);

    const days: { date: Date; dateStr: string; isToday: boolean; isSunday: boolean; isSaturday: boolean; holidayName: string | null }[] = [];
    const todayStr = formatDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const curr = new Date(sunday);
      curr.setDate(sunday.getDate() + i);
      const dStr = formatDateKey(curr);
      const dayNum = curr.getDay();

      days.push({
        date: curr,
        dateStr: dStr,
        isToday: dStr === todayStr,
        isSunday: dayNum === 0,
        isSaturday: dayNum === 6,
        holidayName: isKoreanHoliday(dStr),
      });
    }

    return days;
  }, [currentDate]);

  // Helper to categorize schedules into Multi-day bars vs Single-day dots
  const getSchedulesForWeek = (week: { dateStr: string }[]) => {
    const weekStartStr = week[0].dateStr;
    const weekEndStr = week[6].dateStr;

    // Filter items overlapping this week
    const weekItems = combinedSchedules.filter((s) => {
      const sStart = formatDateKey(new Date(s.startDate));
      const sEnd = formatDateKey(new Date(s.endDate));
      return sStart <= weekEndStr && sEnd >= weekStartStr;
    });

    // Multi-day or all-day items
    const multiDayItems = weekItems.filter((s) => {
      const sStart = formatDateKey(new Date(s.startDate));
      const sEnd = formatDateKey(new Date(s.endDate));
      return s.isAllDay || sStart !== sEnd;
    });

    // Single-day time items
    const singleDayItemsMap: Record<string, ScheduleItem[]> = {};
    week.forEach((w) => {
      singleDayItemsMap[w.dateStr] = [];
    });

    weekItems.forEach((s) => {
      const sStart = formatDateKey(new Date(s.startDate));
      const sEnd = formatDateKey(new Date(s.endDate));
      if (!s.isAllDay && sStart === sEnd) {
        if (singleDayItemsMap[sStart]) {
          singleDayItemsMap[sStart].push(s);
        }
      }
    });

    // Sort single-day items chronologically
    Object.keys(singleDayItemsMap).forEach((key) => {
      singleDayItemsMap[key].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    });

    // Assign tracks for multi-day bars within this week row
    const tracks: (ScheduleItem | null)[][] = [];

    multiDayItems.forEach((item) => {
      const sStart = formatDateKey(new Date(item.startDate));
      const sEnd = formatDateKey(new Date(item.endDate));

      let startCol = week.findIndex((w) => w.dateStr >= sStart);
      if (startCol === -1) startCol = 0;

      let endCol = week.findIndex((w) => w.dateStr === sEnd);
      if (endCol === -1) {
        endCol = week.findIndex((w) => w.dateStr > sEnd);
        if (endCol === -1) endCol = 6;
        else endCol = Math.max(0, endCol - 1);
      }

      // Find first track available for columns [startCol ... endCol]
      let trackIndex = 0;
      while (true) {
        if (!tracks[trackIndex]) {
          tracks[trackIndex] = [null, null, null, null, null, null, null];
        }
        let fit = true;
        for (let c = startCol; c <= endCol; c++) {
          if (tracks[trackIndex][c] !== null) {
            fit = false;
            break;
          }
        }
        if (fit) {
          for (let c = startCol; c <= endCol; c++) {
            tracks[trackIndex][c] = item;
          }
          break;
        }
        trackIndex++;
      }
    });

    return { tracks, multiDayItems, singleDayItemsMap };
  };

  const selectedDateSchedules = useMemo(() => {
    if (!selectedDateStr) return [];
    return combinedSchedules.filter((s) => {
      const sStart = formatDateKey(new Date(s.startDate));
      const sEnd = formatDateKey(new Date(s.endDate));
      return selectedDateStr >= sStart && selectedDateStr <= sEnd;
    });
  }, [selectedDateStr, combinedSchedules]);

  return (
    <Container size="xl" p={{ base: 'xs', sm: 'md' }}>
      {/* Top Header Card */}
      <Paper p="md" radius="lg" shadow="sm" mb="md" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" align="center">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <IconCalendar size={24} />
              </div>
              <div>
                <Title order={2} style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  팀 공유 캘린더 (TimeTree)
                </Title>
                <Text size="xs" c="dimmed">
                  실시간 일정 공유 및 공정/납기일 자동 연동 스케줄러
                </Text>
              </div>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Switch
                checked={includeOrders}
                onChange={(e) => setIncludeOrders(e.currentTarget.checked)}
                label="공정/납기일 자동 불러오기"
                color="blue"
                size="sm"
                styles={{ label: { fontWeight: 600, fontSize: '13px', cursor: 'pointer' } }}
              />

              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={fetchSchedules}
                leftSection={<IconRefresh size={14} />}
              >
                새로고침
              </Button>

              <Button
                color="blue"
                radius="md"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => openNewScheduleModal()}
              >
                + 새 일정 등록
              </Button>
            </Group>
          </Group>

          <Divider color="gray.2" />

          {/* Navigation Controls & View Switch */}
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" align="center">
              <Button variant="light" color="gray" size="xs" radius="md" onClick={handleToday}>
                오늘
              </Button>

              <Group gap={4}>
                <ActionIcon variant="default" radius="md" size="md" onClick={handlePrev}>
                  <IconChevronLeft size={18} />
                </ActionIcon>

                <ActionIcon variant="default" radius="md" size="md" onClick={handleNext}>
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Group>

              <Title order={3} style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', minWidth: '140px' }}>
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </Title>
            </Group>

            <SegmentedControl
              value={viewMode}
              onChange={(val: any) => setViewMode(val)}
              data={[
                { label: '월간 뷰', value: 'month' },
                { label: '주간 뷰', value: 'week' },
              ]}
              radius="md"
              size="xs"
              color="blue"
            />
          </Group>
        </Stack>
      </Paper>

      {/* Main Calendar View Area */}
      {viewMode === 'month' ? (
        <Paper radius="lg" shadow="sm" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Day Names Header */}
          <Grid columns={7} gap={0} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            {DAY_NAMES.map((name, i) => (
              <Grid.Col key={name} span={1} p="xs" style={{ textAlign: 'center' }}>
                <Text
                  fw={700}
                  size="xs"
                  c={i === 0 ? 'red.6' : i === 6 ? 'blue.6' : 'gray.7'}
                >
                  {name}
                </Text>
              </Grid.Col>
            ))}
          </Grid>

          {/* Weeks Grid */}
          <Stack gap={0}>
            {monthWeeks.map((week, wIdx) => {
              const { tracks, singleDayItemsMap } = getSchedulesForWeek(week);

              return (
                <Box
                  key={wIdx}
                  style={{
                    borderBottom: wIdx === monthWeeks.length - 1 ? 'none' : '1px solid #f1f5f9',
                    minHeight: '120px',
                    position: 'relative',
                  }}
                >
                  {/* Days Header Row */}
                  <Grid columns={7} gap={0}>
                    {week.map((dayObj) => {
                      const isHoliday = Boolean(dayObj.holidayName);
                      const isSun = dayObj.isSunday;
                      const isSat = dayObj.isSaturday;

                      return (
                        <Grid.Col
                          key={dayObj.dateStr}
                          span={1}
                          p={6}
                          style={{
                            borderRight: '1px solid #f1f5f9',
                            backgroundColor: !dayObj.isCurrentMonth
                              ? '#fafafa'
                              : dayObj.isToday
                              ? '#eff6ff'
                              : '#ffffff',
                            minHeight: '120px',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s',
                          }}
                          onClick={() => {
                            setSelectedDateStr(dayObj.dateStr);
                            setDateDetailModalOpen(true);
                          }}
                        >
                          <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                            <Group gap={4} align="center">
                              <Text
                                fw={dayObj.isToday ? 800 : 600}
                                size="xs"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: dayObj.isToday ? '22px' : 'auto',
                                  height: dayObj.isToday ? '22px' : 'auto',
                                  borderRadius: dayObj.isToday ? '50%' : '0',
                                  backgroundColor: dayObj.isToday ? '#2563eb' : 'transparent',
                                  color: dayObj.isToday
                                    ? '#ffffff'
                                    : !dayObj.isCurrentMonth
                                    ? '#cbd5e1'
                                    : isSun || isHoliday
                                    ? '#ef4444'
                                    : isSat
                                    ? '#2563eb'
                                    : '#334155',
                                }}
                              >
                                {dayObj.date.getDate()}
                              </Text>

                              {dayObj.holidayName && (
                                <Text size="10px" fw={700} c="red.6" truncate style={{ maxWidth: '60px' }}>
                                  {dayObj.holidayName}
                                </Text>
                              )}
                            </Group>

                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNewScheduleModal(dayObj.dateStr);
                              }}
                              title="이 날짜에 일정 추가"
                            >
                              <IconPlus size={12} />
                            </ActionIcon>
                          </Group>

                          {/* Render Single Day Dot Items */}
                          <Stack gap={2} mt={tracks.length * 24 + 4}>
                            {(singleDayItemsMap[dayObj.dateStr] || []).slice(0, 3).map((item) => {
                              const palette = COLOR_PALETTE.find((c) => c.value === item.colorTag) || COLOR_PALETTE[0];
                              return (
                                <Box
                                  key={item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditScheduleModal(item);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    backgroundColor: '#f8fafc',
                                    cursor: 'pointer',
                                    borderLeft: `3px solid ${palette.bg}`,
                                  }}
                                >
                                  <Text size="10px" c="dimmed" fw={600} style={{ flexShrink: 0 }}>
                                    {formatTime(item.startDate)}
                                  </Text>
                                  <Text size="11px" fw={600} c="gray.9" truncate style={{ flex: 1 }}>
                                    {item.title}
                                  </Text>
                                </Box>
                              );
                            })}

                            {(singleDayItemsMap[dayObj.dateStr] || []).length > 3 && (
                              <Text size="10px" c="dimmed" fw={700} ta="right" pr={4}>
                                +{(singleDayItemsMap[dayObj.dateStr] || []).length - 3}개 더보기
                              </Text>
                            )}
                          </Stack>
                        </Grid.Col>
                      );
                    })}
                  </Grid>

                  {/* Render Multi-Day Horizontal Bars overlaying week row */}
                  <Box
                    style={{
                      position: 'absolute',
                      top: '28px',
                      left: 0,
                      right: 0,
                      pointerEvents: 'none',
                    }}
                  >
                    {tracks.map((track, tIdx) => {
                      let col = 0;
                      const renderedBars: React.ReactNode[] = [];

                      while (col < 7) {
                        const item = track[col];
                        if (item) {
                          let span = 1;
                          while (col + span < 7 && track[col + span]?.id === item.id) {
                            span++;
                          }

                          const palette = COLOR_PALETTE.find((c) => c.value === item.colorTag) || COLOR_PALETTE[0];
                          const leftPct = (col / 7) * 100;
                          const widthPct = (span / 7) * 100;

                          renderedBars.push(
                            <Box
                              key={`${item.id}-${col}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditScheduleModal(item);
                              }}
                              style={{
                                position: 'absolute',
                                top: `${tIdx * 22}px`,
                                left: `calc(${leftPct}% + 4px)`,
                                width: `calc(${widthPct}% - 8px)`,
                                height: '20px',
                                backgroundColor: palette.bg,
                                color: palette.text,
                                borderRadius: '4px',
                                padding: '0 6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                zIndex: 10,
                              }}
                            >
                              <Text size="11px" fw={700} truncate style={{ color: '#ffffff' }}>
                                {item.category} {item.title}
                              </Text>
                            </Box>
                          );

                          col += span;
                        } else {
                          col++;
                        }
                      }

                      return <React.Fragment key={tIdx}>{renderedBars}</React.Fragment>;
                    })}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      ) : (
        /* Week View */
        <Paper p="md" radius="lg" shadow="sm" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <Stack gap="md">
            <Title order={4} c="gray.8">
              {weekDays[0].dateStr} ~ {weekDays[6].dateStr} 주간 일정 목록
            </Title>

            <Grid columns={7} gap="xs">
              {weekDays.map((day) => {
                const daySchedules = combinedSchedules.filter((s) => {
                  const sStart = formatDateKey(new Date(s.startDate));
                  const sEnd = formatDateKey(new Date(s.endDate));
                  return day.dateStr >= sStart && day.dateStr <= sEnd;
                });

                return (
                  <Grid.Col key={day.dateStr} span={{ base: 12, sm: 6, md: 1 }}>
                    <Card
                      withBorder
                      padding="xs"
                      radius="md"
                      style={{
                        backgroundColor: day.isToday ? '#eff6ff' : '#ffffff',
                        borderColor: day.isToday ? '#bfdbfe' : '#e2e8f0',
                        minHeight: '220px',
                      }}
                    >
                      <Group justify="space-between" align="center" mb="xs">
                        <Group gap={4}>
                          <Text
                            fw={700}
                            size="sm"
                            c={day.isSunday || day.holidayName ? 'red.6' : day.isSaturday ? 'blue.6' : 'gray.8'}
                          >
                            {DAY_NAMES[day.date.getDay()]} {day.date.getDate()}일
                          </Text>
                          {day.holidayName && (
                            <Text size="10px" c="red.6" fw={700}>
                              {day.holidayName}
                            </Text>
                          )}
                        </Group>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          size="xs"
                          onClick={() => openNewScheduleModal(day.dateStr)}
                        >
                          <IconPlus size={14} />
                        </ActionIcon>
                      </Group>

                      <Divider mb="xs" />

                      <Stack gap={4}>
                        {daySchedules.length === 0 ? (
                          <Text size="xs" c="dimmed" ta="center" py="md">
                            일정 없음
                          </Text>
                        ) : (
                          daySchedules.map((s) => {
                            const palette = COLOR_PALETTE.find((c) => c.value === s.colorTag) || COLOR_PALETTE[0];
                            return (
                              <Paper
                                key={s.id}
                                p="xs"
                                radius="xs"
                                style={{
                                  backgroundColor: palette.bg,
                                  color: palette.text,
                                  cursor: 'pointer',
                                }}
                                onClick={() => openEditScheduleModal(s)}
                              >
                                <Text size="xs" fw={700} truncate style={{ color: '#ffffff' }}>
                                  {s.title}
                                </Text>
                                <Text size="10px" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                  {s.isAllDay ? '종일' : formatTime(s.startDate)}
                                </Text>
                              </Paper>
                            );
                          })
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          </Stack>
        </Paper>
      )}

      {/* Date Detail Modal */}
      <Modal
        opened={dateDetailModalOpen}
        onClose={() => setDateDetailModalOpen(false)}
        title={
          <Group gap="xs">
            <IconCalendar size={20} color="#2563eb" />
            <Text fw={800} size="lg">
              {selectedDateStr} 일정 상세 목록
            </Text>
            {selectedDateStr && isKoreanHoliday(selectedDateStr) && (
              <Badge color="red" variant="filled" size="sm">
                {isKoreanHoliday(selectedDateStr)}
              </Badge>
            )}
          </Group>
        }
        size="md"
        radius="lg"
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              총 {selectedDateSchedules.length}개의 일정이 등록되어 있습니다.
            </Text>
            <Button
              size="xs"
              color="blue"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setDateDetailModalOpen(false);
                openNewScheduleModal(selectedDateStr || undefined);
              }}
            >
              이 날짜에 새 일정 추가
            </Button>
          </Group>

          <Divider />

          {selectedDateSchedules.length === 0 ? (
            <Paper p="xl" style={{ textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <IconInfoCircle size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
              <Text size="sm" c="dimmed">
                등록된 일정이 없습니다.
              </Text>
            </Paper>
          ) : (
            <ScrollArea h={320}>
              <Stack gap="xs">
                {selectedDateSchedules.map((s) => {
                  const palette = COLOR_PALETTE.find((c) => c.value === s.colorTag) || COLOR_PALETTE[0];
                  return (
                    <Paper
                      key={s.id}
                      p="sm"
                      radius="md"
                      style={{
                        borderLeft: `4px solid ${palette.bg}`,
                        backgroundColor: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Badge size="xs" color={s.isOrderDueDate ? 'red' : 'blue'} variant="light">
                              {s.category}
                            </Badge>
                            <Text fw={700} size="sm" c="gray.9">
                              {s.title}
                            </Text>
                          </Group>

                          <Group gap="md" c="dimmed">
                            <Group gap={4}>
                              <IconClock size={14} />
                              <Text size="xs">
                                {s.isAllDay
                                  ? '종일 일정'
                                  : `${formatTime(s.startDate)} ~ ${formatTime(s.endDate)}`}
                              </Text>
                            </Group>

                            {s.authorName && (
                              <Group gap={4}>
                                <IconUser size={14} />
                                <Text size="xs">{s.authorName}</Text>
                              </Group>
                            )}
                          </Group>

                          {s.description && (
                            <Text size="xs" c="gray.7" style={{ whiteSpace: 'pre-wrap' }} mt={4}>
                              {s.description}
                            </Text>
                          )}
                        </Stack>

                        {!s.isOrderDueDate && (
                          <Group gap={4}>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => openEditScheduleModal(s)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => handleDeleteSchedule(s.id)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        )}
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>

      {/* Add / Edit Schedule Modal */}
      <Modal
        opened={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={
          <Text fw={800} size="lg">
            {editingSchedule ? '일정 수정' : '새 일정 등록'}
          </Text>
        }
        size="md"
        radius="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="일정 제목"
            placeholder="예: 사내 주간 회의 / 지원사업 서류 제출"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.currentTarget.value)}
          />

          <Group grow>
            <Select
              label="카테고리"
              data={CATEGORIES}
              value={formCategory}
              onChange={(val) => setFormCategory(val || '[일반]')}
            />
            <TextInput
              label="등록자명 / 참여자"
              placeholder="예: 홍길동 팀장"
              value={formAuthorName}
              onChange={(e) => setFormAuthorName(e.currentTarget.value)}
            />
          </Group>

          {/* Color Tag Selection */}
          <Box>
            <Text size="xs" fw={600} mb={6} c="gray.7">
              일정 라벨 색상 선택
            </Text>
            <Group gap="xs">
              {COLOR_PALETTE.map((c) => (
                <Box
                  key={c.value}
                  onClick={() => setFormColorTag(c.value)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: c.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: formColorTag === c.value ? '3px solid #0f172a' : `1px solid ${c.border}`,
                    transition: 'transform 0.1s',
                  }}
                >
                  {formColorTag === c.value && <IconCheck size={16} color="#ffffff" />}
                </Box>
              ))}
            </Group>
          </Box>

          <Checkbox
            label="종일 일정 (All-day)"
            checked={formIsAllDay}
            onChange={(e) => setFormIsAllDay(e.currentTarget.checked)}
            mt="xs"
          />

          {/* Start Date & Time */}
          <Group grow>
            <TextInput
              type="date"
              label="시작 날짜"
              required
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.currentTarget.value)}
            />
            {!formIsAllDay && (
              <TextInput
                type="time"
                label="시작 시간"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.currentTarget.value)}
              />
            )}
          </Group>

          {/* End Date & Time */}
          <Group grow>
            <TextInput
              type="date"
              label="종료 날짜"
              required
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.currentTarget.value)}
            />
            {!formIsAllDay && (
              <TextInput
                type="time"
                label="종료 시간"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.currentTarget.value)}
              />
            )}
          </Group>

          <Textarea
            label="상세 메모 / 설명"
            placeholder="회의 안건, 준비물, 상세 일정 내용을 입력하세요."
            rows={3}
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
          />

          <Group justify="space-between" mt="md">
            {editingSchedule ? (
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => handleDeleteSchedule(editingSchedule.id)}
              >
                삭제
              </Button>
            ) : (
              <div />
            )}

            <Group gap="xs">
              <Button variant="default" onClick={() => setScheduleModalOpen(false)}>
                취소
              </Button>
              <Button color="blue" onClick={handleSaveSchedule} loading={saving}>
                {editingSchedule ? '수정 완료' : '등록 하기'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
