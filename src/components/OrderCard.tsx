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
  onUploadPhotos?: (order: Order, files: File[]) => void;
  onOpenWorkOrder?: (order: Order, stepName: string) => void;
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
  onUploadPhotos,
  onOpenWorkOrder
}: OrderCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const displayProjectNo = order.projectNo || `PRJ-${String(order.id).padStart(3, '0')}`;

  const handleOpenDrawing = () => {
    if (order.drawingUrl && order.drawingUrl.trim()) {
      window.open(order.drawingUrl.trim(), '_blank', 'noopener,noreferrer');
    } else {
      const searchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(displayProjectNo)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadPhotos) {
      onUploadPhotos(order, Array.from(e.target.files));
      e.target.value = '';
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
      {/* Hidden Mobile Camera Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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
            fw={700} 
            size="sm"
            className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors"
            onClick={() => onShowPartnerDetail(order.partnerName, order)}
          >
            {order.partnerName}
          </Text>
        </Group>

        {/* Item & Quantity / Dates */}
        <Group justify="space-between" align="flex-start" mt={2}>
          <div>
            <Text fw={500} size="sm" c="dark">{order.itemName}</Text>
            <Text size="xs" c="dimmed" fw={400}>수량: {order.quantity}개</Text>
          </div>

          <Stack gap={2} align="flex-end">
            <Text size="11px" c="dimmed">발주: {order.orderDate || '-'}</Text>
            <Text size="xs" fw={500} c={isUrgent ? 'red.7' : 'dark'}>
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

        {/* Process Step Badges (Fixed 82px width with split click triggers) */}
        <Group gap={5} wrap="wrap" mt={4}>
          {(order.steps || []).filter(s => s.active).map(s => (
            <Stack key={s.name} gap={1} align="center" style={{ display: 'inline-flex', width: '82px' }}>
              <div
                style={{
                  width: '82px',
                  minWidth: '82px',
                  maxWidth: '82px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                  border: `1px solid ${s.status === '완료' ? '#0f172a' : s.status === '진행중' ? '#1d4ed8' : '#cbd5e1'}`,
                  backgroundColor: s.status === '완료' ? '#1e293b' : s.status === '진행중' ? '#2563eb' : '#ffffff',
                  color: s.status === '대기' ? '#334155' : '#ffffff',
                  userSelect: 'none',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                {/* Left Icon Area: Opens Work Order Modal */}
                <Tooltip label={`[${s.name}] 작업지시서 열람 및 A4 인쇄`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWorkOrder?.(order, s.name);
                    }}
                    style={{
                      width: '22px',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      borderRight: `1px solid ${s.status === '대기' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.25)'}`,
                      backgroundColor: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {s.status === '완료' ? '✓' : s.status === '진행중' ? '▶' : '📋'}
                  </button>
                </Tooltip>

                {/* Right Text Area: Toggles Step Status */}
                <Tooltip label={`[${s.name}] 클릭 시 공정 상태 변경 (대기 ➔ 진행중 ➔ 완료)`}>
                  <button
                    type="button"
                    onClick={() => onToggleStep(order, s.name)}
                    style={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1
                    }}
                  >
                    {s.status === '완료' ? (s.name.length > 3 ? s.name : `${s.name} 완료`) : s.status === '진행중' ? (s.name.length > 3 ? s.name : `${s.name} 진행`) : s.name}
                  </button>
                </Tooltip>
              </div>
              <Text size="11px" c="dimmed" fw={600} ta="center" style={{ width: '82px', minHeight: '14px', lineHeight: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {s.date || ''}
              </Text>
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

            <Tooltip label={`스마트폰 카메라 구동: [${displayProjectNo}] 현장 원본 사진 무저장 자동 업로드`}>
              <Button
                size="xs"
                variant="filled"
                color="indigo"
                leftSection={<IconCamera size={14} />}
                onClick={handleCameraClick}
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
