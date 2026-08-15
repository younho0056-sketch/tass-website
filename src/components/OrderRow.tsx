"use client";

import React, { memo, useRef } from 'react';
import { Table, Badge, Tooltip, Text, Group, Stack, Progress, ActionIcon } from '@mantine/core';
import { IconPencil, IconPrinter, IconTrash, IconFolderOpen, IconCamera } from '@tabler/icons-react';

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

interface OrderRowProps {
  index?: number;
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

const DEFAULT_DRIVE_URL = 'https://drive.google.com/drive/folders/13kS6BLYxlVlTlydnv7DGBrU3jG5kjsAZ?usp=sharing';

export const OrderRow = memo(function OrderRow({
  index,
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
}: OrderRowProps) {
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
    <Table.Tr 
      style={{
        backgroundColor: isUrgent ? 'rgba(254, 226, 226, 0.40)' : undefined
      }}
    >
      <Table.Td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {index || '-'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Tooltip label="거래처 상세 정보 보기">
          <Text 
            fw={700} 
            size="sm"
            className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors"
            onClick={() => onShowPartnerDetail(order.partnerName, order)}
          >
            {order.partnerName}
          </Text>
        </Tooltip>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{displayProjectNo}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} c="dark">{order.itemName}</Text>
        <Text size="xs" c="dimmed" fw={400}>{order.quantity}개</Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{order.orderDate || '-'}</Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Group gap={4} wrap="nowrap" align="center">
          <Text 
            size="sm" 
            fw={500} 
            c={isUrgent ? 'red.7' : 'dark'}
            style={{ whiteSpace: 'nowrap' }}
          >
            {order.dueDate || '-'}
          </Text>
          {isUrgent && daysLeft !== null && (
            <Badge 
              color="red" 
              variant="filled" 
              size="xs"
              style={{ fontWeight: 500 }}
            >
              {daysLeft < 0 ? `D+${Math.abs(daysLeft)}` : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Stack gap="xs">
          {/* 프로그레스 바 */}
          <Group justify="space-between" gap="xs">
            <Progress 
              value={order.progressPercent} 
              color={order.progressPercent === 100 ? 'teal' : 'blue'} 
              size="lg" 
              radius="xl" 
              animated={order.progressPercent > 0 && order.progressPercent < 100}
              style={{ flex: 1 }}
            />
            <Text size="xs" fw={800} c={order.progressPercent === 100 ? 'teal' : 'blue'}>
              {order.progressPercent}% 완료
            </Text>
          </Group>

          {/* 공정 스텝 라이브 체크 뱃지 목록 (고정 너비 82px 및 분리 클릭 트리거) */}
          <Group gap={6} wrap="wrap" align="flex-start">
            {(order.steps || []).filter(s => s.active).map(s => (
              <Stack key={s.name} gap={2} align="center" style={{ display: 'inline-flex', width: '82px' }}>
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
        </Stack>
      </Table.Td>
      <Table.Td>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Group gap={4} wrap="nowrap">
          <Tooltip label={order.drawingUrl && order.drawingUrl.trim() ? "등록된 개별 도면 드라이브 열기" : `구글 드라이브 [${displayProjectNo}] 도면 폴더 자동 검색`}>
            <ActionIcon color={order.drawingUrl && order.drawingUrl.trim() ? "teal.7" : "blue.6"} variant="light" size="sm" onClick={handleOpenDrawing}>
              <IconFolderOpen size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={`스마트폰 카메라 구동: [${displayProjectNo}] 현장 원본 사진 무저장 자동 업로드`}>
            <ActionIcon color="indigo.6" variant="filled" size="sm" onClick={handleCameraClick}>
              <IconCamera size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="수정">
            <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => onOpenEdit(order)}>
              <IconPencil size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="선택 품목 거래명세표/송장 인쇄">
            <ActionIcon color="indigo.6" variant="subtle" size="sm" onClick={() => onPrintSingleOrderInvoice(order)}>
              <IconPrinter size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="삭제">
            <ActionIcon color="red" variant="subtle" size="sm" onClick={() => onDelete(order.id)}>
              <IconTrash size={17} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
});

export default OrderRow;
