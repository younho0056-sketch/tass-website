"use client";

import React, { memo, useRef } from 'react';
import { Card, Badge, Tooltip, Text, Group, Stack, Progress, ActionIcon, Button } from '@mantine/core';
import { IconPencil, IconPrinter, IconTrash, IconFolderOpen, IconCamera } from '@tabler/icons-react';
import { Order } from '@/components/OrderRow';

interface OrderCardProps {
  order: Order;
  daysLeft: number | null;
  isUrgent: boolean;
  onToggleStep: (order: Order, stepName: string) => void;
  onOpenEdit: (order: Order) => void;
  onDelete: (id: number) => void;
  onShowPartnerDetail: (partnerName: string, order?: Order) => void;
  onPrintSingleOrderInvoice: (order: Order) => void;
}

const OrderCard = memo(function OrderCard({
  order,
  daysLeft,
  isUrgent,
  onToggleStep,
  onOpenEdit,
  onDelete,
  onShowPartnerDetail,
  onPrintSingleOrderInvoice,
}: OrderCardProps) {
  const displayProjectNo = order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;

  const handleOpenDrawing = () => {
    if (order.drawingUrl && order.drawingUrl.trim()) {
      window.open(order.drawingUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      const searchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(displayProjectNo)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenDriveCamera = () => {
    if (order.drawingUrl && order.drawingUrl.trim()) {
      window.open(order.drawingUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      const searchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(displayProjectNo)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card 
      shadow="sm" 
      padding="md" 
      radius="lg" 
      className="glass-panel"
      style={{
        borderLeft: isUrgent ? '4px solid #ef4444' : order.status === '완료' ? '4px solid #10b981' : '4px solid #3b82f6',
        backgroundColor: isUrgent ? 'rgba(254, 226, 226, 0.25)' : '#ffffff',
        marginBottom: '12px'
      }}
    >
      {/* Header Row: Status Badge, Project No, Partner Name */}
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Group gap={6} align="center">
            <Badge 
              color={order.status === '완료' ? 'green' : isUrgent ? 'red' : 'blue'} 
              variant={isUrgent ? 'filled' : 'light'}
              size="sm"
            >
              {isUrgent ? '🚨 납기임박' : order.status}
            </Badge>

            {isUrgent && daysLeft !== null && (
              <Badge color="red" variant="filled" size="xs" style={{ fontWeight: 800 }}>
                {daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
              </Badge>
            )}

            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.5px' }}>
              {displayProjectNo}
            </Text>
          </Group>

          <Text 
            fw={800} 
            size="sm"
            c="blue.7"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => onShowPartnerDetail(order.partnerName, order)}
          >
            {order.partnerName}
          </Text>
        </Group>

        {/* Item & Quantity / Dates */}
        <Group justify="space-between" align="flex-start" mt={2}>
          <div>
            <Text fw={800} size="md" c="dark">{order.itemName}</Text>
            <Text size="xs" c="dimmed" fw={600}>수량: {order.quantity}개</Text>
          </div>

          <Stack gap={2} align="flex-end">
            <Text size="11px" c="dimmed">발주: {order.orderDate || '-'}</Text>
            <Text size="xs" fw={isUrgent ? 900 : 700} c={isUrgent ? 'red.7' : 'dark'}>
              납기: {order.dueDate || '-'}
            </Text>
          </Stack>
        </Group>

        {/* Progress Bar */}
        <Group justify="space-between" gap="xs" mt={4}>
          <Progress 
            value={order.progressPercent} 
            color={order.progressPercent === 100 ? 'teal' : 'blue'} 
            size="md" 
            radius="xl" 
            animated={order.progressPercent > 0 && order.progressPercent < 100}
            style={{ flex: 1 }}
          />
          <Text size="xs" fw={800} c={order.progressPercent === 100 ? 'teal' : 'blue'}>
            {order.progressPercent}%
          </Text>
        </Group>

        {/* Process Step Badges */}
        <Group gap={5} wrap="wrap" mt={4}>
          {(order.steps || []).filter(s => s.active).map(s => (
            <Stack key={s.name} gap={1} align="center" style={{ display: 'inline-flex' }}>
              <Badge
                size="sm"
                radius="sm"
                variant={s.status === '완료' ? 'light' : s.status === '진행중' ? 'filled' : 'outline'}
                color={s.status === '완료' ? 'dark' : s.status === '진행중' ? 'blue' : 'gray.4'}
                onClick={() => onToggleStep(order, s.name)}
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
                {s.status === '완료' ? `✓ ${s.name}` : s.status === '진행중' ? `▶ ${s.name}` : s.name}
              </Badge>
              {s.date && (
                <Text size="10px" c="dimmed" fw={600}>
                  {s.date}
                </Text>
              )}
            </Stack>
          ))}
        </Group>

        {/* Action Buttons Row */}
        <Group justify="space-between" align="center" mt="xs" pt="xs" style={{ borderTop: '1px solid #f1f5f9' }}>
          <Group gap={6}>
            <Button
              size="xs"
              variant="light"
              color={order.drawingUrl && order.drawingUrl.trim() ? "teal" : "blue"}
              leftSection={<IconFolderOpen size={14} />}
              onClick={handleOpenDrawing}
              radius="md"
              style={{ fontWeight: 700 }}
            >
              📐 도면
            </Button>

            <Tooltip label={`구글 드라이브 프로젝트 [${displayProjectNo}] 폴더로 직결 이동하여 카메라 촬영/사진 업로드`}>
              <Button
                size="xs"
                variant="filled"
                color="indigo"
                leftSection={<IconCamera size={14} />}
                onClick={handleOpenDriveCamera}
                radius="md"
                style={{ fontWeight: 700, boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)' }}
              >
                📸 현장촬영
              </Button>
            </Tooltip>
          </Group>

          <Group gap={4}>
            <Tooltip label="수정">
              <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => onOpenEdit(order)}>
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="거래명세표/송장 인쇄">
              <ActionIcon color="indigo.6" variant="subtle" size="sm" onClick={() => onPrintSingleOrderInvoice(order)}>
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="삭제">
              <ActionIcon color="red" variant="subtle" size="sm" onClick={() => onDelete(order.id)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
});

export default OrderCard;
