"use client";

import { useEffect, useState } from 'react';
import { Modal, Stack, Group, TextInput, Select, NumberInput, Text, Checkbox, Textarea, Button, Paper, Anchor, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileText } from '@tabler/icons-react';
import { PROCESS_STEPS, todayString, dateFromText, nextProjectNo, type EstimateFileItem } from '@/lib/estimateFiles';

type Props = {
  file: EstimateFileItem | null;
  opened: boolean;
  onClose: () => void;
  partnerNames: string[];
  onDone: () => void;
};

/** 견적서 파일 → 공정관리 "새 수주 등록" (견적서 내용으로 미리 채운 창) */
export default function OrderFromEstimateModal({ file, opened, onClose, partnerNames, onDone }: Props) {
  const [loadingNo, setLoadingNo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectNo, setProjectNo] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [orderDate, setOrderDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [drawingUrl, setDrawingUrl] = useState('');
  const [steps, setSteps] = useState<string[]>([...PROCESS_STEPS]);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (!opened || !file) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPartnerName(file.partnerName || '');
    setItemName(file.projectName);
    setQuantity(file.quantity || 1);
    setOrderDate(todayString());
    setDueDate(dateFromText(file.deliveryTerm));
    setDrawingUrl('');
    setSteps(file.processSteps.length > 0 ? file.processSteps : [...PROCESS_STEPS]);
    setMemo(file.memo || '');
    setProjectNo('');
    setLoadingNo(true);
    let cancelled = false;
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProjectNo(nextProjectNo(Array.isArray(data.orders) ? data.orders : []));
      })
      .catch(() => {
        if (!cancelled) setProjectNo('PRJ-');
      })
      .finally(() => {
        if (!cancelled) setLoadingNo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, file]);

  const partnerData = partnerName && !partnerNames.includes(partnerName) ? [partnerName, ...partnerNames] : partnerNames;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!partnerName) {
      alert('거래처를 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const processSteps = PROCESS_STEPS.map((name) => ({ name, status: '대기', active: steps.includes(name), date: null }));
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectNo,
          drawingUrl,
          partnerName,
          itemName,
          quantity,
          orderDate: orderDate || todayString(),
          dueDate: dueDate || null,
          memo,
          processSteps,
        }),
      });
      const order = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(order.details || order.error || '수주 등록에 실패했습니다.');

      const link = await fetch(`/api/estimate-files/${file.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '수주성공', orderId: order.id, projectNo, partnerName }),
      });
      if (!link.ok) console.warn('견적서 파일에 발주 표시를 남기지 못했습니다.');

      notifications.show({
        title: '공정관리에 등록했습니다',
        message: `${projectNo} · ${itemName} (${partnerName})`,
        color: 'teal',
        autoClose: 4000,
      });
      onDone();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? `[수주 등록 실패]\n${err.message}` : '수주 등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={800}>새 수주 등록 (견적서에서 가져옴)</Text>} size="lg" zIndex={300} centered>
      {file && (
        <form onSubmit={submit}>
          <Stack gap="md">
            <Paper p="xs" radius="md" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
              <Group gap="xs" wrap="nowrap">
                <IconFileText size={18} color="#475569" style={{ flexShrink: 0 }} />
                <Text size="xs" style={{ minWidth: 0 }}>
                  <Anchor href={`/api/estimate-files/${file.id}/file`} target="_blank" size="xs" fw={700}>
                    {file.fileName}
                  </Anchor>
                  {file.amount ? ` · ₩${file.amount.toLocaleString()}` : ''}
                  <Text span c="dimmed" size="xs" display="block">
                    견적서 내용을 그대로 옮겨 왔습니다. 확인하고 납기일·비고만 입력하세요.
                  </Text>
                </Text>
              </Group>
            </Paper>

            <Group grow align="flex-start">
              <TextInput
                label="프로젝트 번호 (Project No.)"
                value={projectNo}
                onChange={(e) => setProjectNo(e.currentTarget.value)}
                rightSection={loadingNo ? <Loader size="xs" /> : null}
                required
              />
              <Select
                label="거래처 선택"
                placeholder="거래처를 선택하거나 검색하세요"
                data={partnerData}
                value={partnerName || null}
                onChange={(val) => setPartnerName(val || '')}
                searchable
                required
                comboboxProps={{ zIndex: 320 }}
              />
            </Group>

            <Group grow align="flex-start">
              <TextInput label="품목명" value={itemName} onChange={(e) => setItemName(e.currentTarget.value)} required />
              <NumberInput label="수량" min={1} value={quantity} onChange={(v) => setQuantity(typeof v === 'number' ? v : 1)} required />
            </Group>

            <Group grow align="flex-start">
              <TextInput label="발주일" type="date" value={orderDate} onChange={(e) => setOrderDate(e.currentTarget.value)} />
              <TextInput
                label="납기일"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.currentTarget.value)}
                description={file.deliveryTerm ? `견적서 납품기한: ${file.deliveryTerm}` : undefined}
              />
            </Group>

            <TextInput
              label="개별 도면 / 사진 구글 드라이브 링크 (선택)"
              placeholder="https://drive.google.com/file/d/..."
              value={drawingUrl}
              onChange={(e) => setDrawingUrl(e.currentTarget.value)}
            />

            <div>
              <Text size="sm" fw={600} mb={6}>적용할 공정 단계 (견적서에서 체크한 그대로):</Text>
              <Group gap="md">
                {PROCESS_STEPS.map((name) => (
                  <Checkbox
                    key={name}
                    label={name}
                    checked={steps.includes(name)}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      setSteps((prev) => PROCESS_STEPS.filter((s) => (s === name ? on : prev.includes(s))));
                    }}
                  />
                ))}
              </Group>
            </div>

            <Textarea
              label="비고"
              placeholder="작업 특이사항이나 고객 요청사항을 입력하세요"
              value={memo}
              onChange={(e) => setMemo(e.currentTarget.value)}
              minRows={2}
              autosize
            />

            <Button type="submit" fullWidth mt="xs" loading={saving} disabled={loadingNo}>
              수주 등록하기
            </Button>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
