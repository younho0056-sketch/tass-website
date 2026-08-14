"use client";

import React, { memo } from 'react';
import { Table, Badge, Tooltip, Text, Group, Stack, Progress, ActionIcon } from '@mantine/core';
import { IconPencil, IconPrinter, IconTrash } from '@tabler/icons-react';

export type ProcessStep = {
  name: string;
  status: '대기' | '진행중' | '완료';
  active: boolean;
};

export type Order = {
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

interface OrderRowProps {
  order: Order;
  daysLeft: number | null;
  isUrgent: boolean;
  onToggleStep: (order: Order, stepName: string) => void;
  onOpenEdit: (order: Order) => void;
  onDelete: (id: number) => void;
  onShowPartnerDetail: (partnerName: string, order?: Order) => void;
  onPrintSingleOrderInvoice: (order: Order) => void;
}

const OrderRow = memo(function OrderRow({
  order,
  daysLeft,
  isUrgent,
  onToggleStep,
  onOpenEdit,
  onDelete,
  onShowPartnerDetail,
  onPrintSingleOrderInvoice
}: OrderRowProps) {
  return (
    <Table.Tr 
      style={{
        backgroundColor: isUrgent ? 'rgba(254, 226, 226, 0.40)' : undefined
      }}
    >
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Badge 
          color={order.status === '완료' ? 'green' : isUrgent ? 'red' : 'blue'} 
          variant={isUrgent ? 'filled' : 'light'}
          size="md"
        >
          {isUrgent ? '납기임박' : order.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Tooltip label="거래처 상세 정보 보기">
          <Text 
            fw={700} 
            c="blue.7"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => onShowPartnerDetail(order.partnerName, order)}
          >
            {order.partnerName}
          </Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        <Text fw={600}>{order.itemName}</Text>
        <Text size="xs" c="dimmed">{order.quantity}개</Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{order.orderDate || '-'}</Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Group gap={4} wrap="nowrap" align="center">
          <Text 
            size="sm" 
            fw={isUrgent ? 900 : 600} 
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
              style={{ fontWeight: 800 }}
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

          {/* 공정 스텝 라이브 체크 뱃지 목록 */}
          <Group gap={4} wrap="wrap">
            {(order.steps || []).filter(s => s.active).map(s => (
              <Badge
                key={s.name}
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
                {s.status === '완료' ? `✓ ${s.name} 완료` : s.status === '진행중' ? `▶ ${s.name} 진행중` : s.name}
              </Badge>
            ))}
          </Group>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
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
