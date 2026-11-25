"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Box, Button, Group, Text, Badge, Menu, ActionIcon, Modal, Stack, TextInput, Select,
  NumberInput, Textarea, Checkbox, Alert, Loader, Anchor, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCloudUpload, IconDots, IconDownload, IconExternalLink, IconFile, IconFileSpreadsheet,
  IconFileTypeDoc, IconFileTypePdf, IconPencil, IconPhoto, IconTrash, IconTruckDelivery,
  IconFileDownload, IconCheck, IconX, IconArrowBackUp, IconInfoCircle,
} from '@tabler/icons-react';
import { parseEstimateFile } from '@/lib/estimateParser';
import { MAX_ESTIMATE_FILE_BYTES, PROCESS_STEPS, type EstimateFileItem } from '@/lib/estimateFiles';

type Props = {
  /** 탭·검색으로 걸러진 파일 */
  files: EstimateFileItem[];
  /** 걸러지기 전 전체 개수 (빈 화면 안내 문구용) */
  totalCount: number;
  partnerNames: string[];
  canEdit: boolean;
  onChanged: () => void;
  onOrder: (file: EstimateFileItem) => void;
};

type FormValues = {
  projectName: string;
  partnerName: string;
  quantity: number;
  amount: number | '';
  estimateDate: string;
  deliveryTerm: string;
  processSteps: string[];
  memo: string;
};

type FormState =
  | { mode: 'upload'; file: File; values: FormValues; notes: string[]; index: number; total: number }
  | { mode: 'edit'; item: EstimateFileItem; values: FormValues; notes: string[] };

const NO_PERMISSION = '직원 권한(1234)은 견적서 파일을 올리거나 고칠 수 없습니다. 관리자 비밀번호(0056)로 로그인해 주세요.';

function fileKind(name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return { icon: IconFileTypePdf, color: '#E03131', label: 'PDF' };
  if (['xlsx', 'xls', 'xlsm', 'csv'].includes(ext)) return { icon: IconFileSpreadsheet, color: '#2F9E44', label: '엑셀' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return { icon: IconPhoto, color: '#7048E8', label: '사진' };
  if (['doc', 'docx', 'hwp', 'hwpx'].includes(ext)) return { icon: IconFileTypeDoc, color: '#1C7ED6', label: '문서' };
  return { icon: IconFile, color: '#868E96', label: ext.toUpperCase() || '파일' };
}

const shortDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : '');
const fileUrl = (id: number, download = false) => `/api/estimate-files/${id}/file${download ? '?download=1' : ''}`;

export default function EstimateFileBoard({ files, totalCount, partnerNames, canEdit, onChanged, onOrder }: Props) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<File[]>([]);
  const queueTotal = useRef(0);
  const [reading, setReading] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  /** 대기열의 다음 파일을 읽어서 확인 창을 띄운다 */
  const openNext = async () => {
    const next = queueRef.current.shift();
    if (!next) {
      setForm(null);
      return;
    }
    const index = queueTotal.current - queueRef.current.length;
    setReading(next.name);
    const parsed = await parseEstimateFile(next, partnerNames);
    setReading(null);

    const notes: string[] = [];
    notes.push(
      parsed.projectNameFound
        ? '견적서에서 공사명을 읽었습니다. 맞는지 확인해 주세요.'
        : '파일 안에서 공사명을 찾지 못해 파일 이름으로 채웠습니다. 고쳐서 저장해 주세요.'
    );
    notes.push(
      parsed.processSteps
        ? '견적서의 ■ 표시대로 공정을 체크했습니다.'
        : '견적서에 공정 표시가 없어 전체 공정을 체크해 두었습니다.'
    );

    setForm({
      mode: 'upload',
      file: next,
      index,
      total: queueTotal.current,
      notes,
      values: {
        projectName: parsed.projectName,
        partnerName: parsed.partnerName || '',
        quantity: parsed.quantity || 1,
        amount: parsed.amount ?? '',
        estimateDate: parsed.estimateDate || '',
        deliveryTerm: parsed.deliveryTerm || '',
        processSteps: parsed.processSteps && parsed.processSteps.length > 0 ? parsed.processSteps : [...PROCESS_STEPS],
        memo: '',
      },
    });
  };

  const handleFiles = (list: FileList | File[] | null) => {
    const picked = Array.from(list || []);
    if (picked.length === 0) return;
    if (!canEdit) {
      alert(NO_PERMISSION);
      return;
    }
    const tooBig = picked.filter((f) => f.size > MAX_ESTIMATE_FILE_BYTES);
    const ok = picked.filter((f) => f.size > 0 && f.size <= MAX_ESTIMATE_FILE_BYTES);
    if (tooBig.length > 0) {
      alert(`4MB가 넘는 파일은 올릴 수 없습니다.\n${tooBig.map((f) => `· ${f.name}`).join('\n')}\n\n엑셀에서 PDF로 저장할 때 '최소 크기(온라인 게시)'를 고르면 용량이 줄어듭니다.`);
    }
    if (ok.length === 0) return;
    const busy = !!form || !!reading;
    queueRef.current.push(...ok);
    queueTotal.current = busy ? queueTotal.current + ok.length : ok.length;
    if (!busy) void openNext();
  };

  // 보드 밖에 떨어뜨려도 브라우저가 파일을 열어버리지 않고 그대로 올라가게
  const handleFilesRef = useRef(handleFiles);
  useEffect(() => {
    handleFilesRef.current = handleFiles;
  });
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      handleFilesRef.current(e.dataTransfer?.files || null);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const setValues = (patch: Partial<FormValues>) =>
    setForm((prev) => (prev ? ({ ...prev, values: { ...prev.values, ...patch } } as FormState) : prev));

  const closeForm = () => {
    queueRef.current = [];
    setForm(null);
  };

  const skipCurrent = () => {
    if (form?.mode === 'upload' && queueRef.current.length > 0) void openNext();
    else closeForm();
  };

  const saveForm = async () => {
    if (!form) return;
    const v = form.values;
    if (!v.projectName.trim()) {
      alert('공사명을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (form.mode === 'upload') {
        const body = new FormData();
        body.append('file', form.file);
        body.append('projectName', v.projectName.trim());
        body.append('partnerName', v.partnerName);
        body.append('quantity', String(v.quantity || 1));
        body.append('amount', v.amount === '' ? '' : String(v.amount));
        body.append('estimateDate', v.estimateDate);
        body.append('deliveryTerm', v.deliveryTerm);
        body.append('processSteps', JSON.stringify(v.processSteps));
        body.append('memo', v.memo);
        const res = await fetch('/api/estimate-files', { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '저장하지 못했습니다.');
      } else {
        const res = await fetch(`/api/estimate-files/${form.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...v, amount: v.amount === '' ? null : v.amount }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '저장하지 못했습니다.');
      }
      onChanged();
      if (form.mode === 'upload' && queueRef.current.length > 0) await openNext();
      else setForm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: EstimateFileItem) => {
    if (!canEdit) {
      alert(NO_PERMISSION);
      return;
    }
    setForm({
      mode: 'edit',
      item,
      notes: [],
      values: {
        projectName: item.projectName,
        partnerName: item.partnerName || '',
        quantity: item.quantity || 1,
        amount: item.amount ?? '',
        estimateDate: item.estimateDate || '',
        deliveryTerm: item.deliveryTerm || '',
        processSteps: item.processSteps,
        memo: item.memo || '',
      },
    });
  };

  const changeStatus = async (item: EstimateFileItem, status: string) => {
    if (!canEdit) {
      alert(NO_PERMISSION);
      return;
    }
    const res = await fetch(`/api/estimate-files/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) alert('상태를 바꾸지 못했습니다.');
    onChanged();
  };

  const remove = async (item: EstimateFileItem) => {
    if (!canEdit) {
      alert(NO_PERMISSION);
      return;
    }
    const extra = item.orderId ? '\n(공정관리에 등록된 수주는 지워지지 않고 그대로 남습니다.)' : '';
    if (!confirm(`'${item.projectName}' 견적서 파일을 삭제할까요? 삭제하면 되돌릴 수 없습니다.${extra}`)) return;
    const res = await fetch(`/api/estimate-files/${item.id}`, { method: 'DELETE' });
    if (!res.ok) alert('삭제하지 못했습니다.');
    else notifications.show({ message: '견적서 파일을 삭제했습니다.', color: 'gray', autoClose: 2500 });
    onChanged();
  };

  const partnerData = form && form.values.partnerName && !partnerNames.includes(form.values.partnerName)
    ? [form.values.partnerName, ...partnerNames]
    : partnerNames;

  return (
    <Box
      className="glass-panel"
      p="md"
      style={{
        position: 'relative',
        minHeight: 'max(380px, calc(100vh - 480px))',
        outline: dragging ? '3px dashed #339AF0' : undefined,
        outlineOffset: -6,
        transition: 'outline-color 120ms',
      }}
    >
      {/* 위쪽 안내 + 버튼 */}
      <Group justify="space-between" mb="md" gap="xs">
        <div>
          <Text fw={800} size="md">견적서 파일 보드</Text>
          <Text size="xs" c="dimmed">
            PDF·엑셀 견적서를 이 칸으로 끌어다 놓으면 올라갑니다. 아이콘을 누르면 파일이 열립니다.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            component="a"
            href="/templates/tass-estimate-template.xlsx"
            download="TASS_견적서_양식.xlsx"
            variant="default"
            size="xs"
            leftSection={<IconFileDownload size={15} />}
          >
            견적서 양식 받기
          </Button>
          <Button
            size="xs"
            leftSection={<IconCloudUpload size={15} />}
            onClick={() => (canEdit ? inputRef.current?.click() : alert(NO_PERMISSION))}
          >
            파일 올리기
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.xlsx,.xls,.xlsm,.jpg,.jpeg,.png,.hwp,.hwpx,.doc,.docx"
            onChange={(e) => {
              handleFiles(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
        </Group>
      </Group>

      {/* 파일 아이콘 목록 */}
      {files.length > 0 ? (
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          {files.map((item) => (
            <FileTile
              key={item.id}
              item={item}
              canEdit={canEdit}
              onOrder={() => (canEdit ? onOrder(item) : alert(NO_PERMISSION))}
              onEdit={() => openEdit(item)}
              onStatus={(s) => changeStatus(item, s)}
              onDelete={() => remove(item)}
            />
          ))}
        </Box>
      ) : (
        <Stack align="center" justify="center" gap={6} style={{ minHeight: 260, color: '#94A3B8' }}>
          <IconCloudUpload size={56} stroke={1.3} />
          <Text fw={700} c="dimmed">
            {totalCount === 0 ? '견적서 파일(PDF·엑셀)을 여기로 끌어다 놓으세요' : '이 탭에 해당하는 견적서가 없습니다.'}
          </Text>
          {totalCount === 0 && (
            <Text size="xs" c="dimmed">휴대폰에서는 위의 ‘파일 올리기’ 버튼을 누르세요.</Text>
          )}
        </Stack>
      )}

      {/* 끌어다 놓는 중 */}
      {dragging && (
        <Stack
          align="center"
          justify="center"
          gap={4}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'rgba(231, 245, 255, 0.85)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <IconCloudUpload size={60} color="#1C7ED6" />
          <Text fw={800} c="blue.8">여기에 놓으면 견적서가 올라갑니다</Text>
        </Stack>
      )}

      {/* 파일 읽는 중 */}
      <Modal opened={!!reading} onClose={() => {}} withCloseButton={false} centered size="sm" zIndex={310}>
        <Group gap="sm" wrap="nowrap">
          <Loader size="sm" />
          <Text size="sm">
            견적서 내용을 읽는 중입니다…
            <Text span c="dimmed" size="xs" display="block" truncate>{reading}</Text>
          </Text>
        </Group>
      </Modal>

      {/* 올리기 / 정보 수정 확인 창 */}
      <Modal
        opened={!!form}
        onClose={closeForm}
        centered
        size="lg"
        zIndex={300}
        title={
          form && (
            <div>
              <Text fw={800}>
                {form.mode === 'upload' ? '견적서 올리기' : '견적서 정보 수정'}
                {form.mode === 'upload' && form.total > 1 && (
                  <Text span c="dimmed" size="sm" ml={6}>({form.index}/{form.total})</Text>
                )}
              </Text>
              <Text size="xs" c="dimmed" truncate maw={480}>
                {form.mode === 'upload' ? form.file.name : form.item.fileName}
              </Text>
            </div>
          )
        }
      >
        {form && (
          <Stack gap="sm">
            {form.notes.length > 0 && (
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                {form.notes.map((n) => (
                  <Text key={n} size="xs">{n}</Text>
                ))}
              </Alert>
            )}
            <TextInput
              label="공사명 (아이콘 아래 제목)"
              value={form.values.projectName}
              onChange={(e) => setValues({ projectName: e.currentTarget.value })}
              required
              data-autofocus
            />
            <Group grow align="flex-start">
              <Select
                label="거래처"
                placeholder="거래처 선택 또는 검색"
                data={partnerData}
                value={form.values.partnerName || null}
                onChange={(val) => setValues({ partnerName: val || '' })}
                searchable
                clearable
                nothingFoundMessage="거래처 DB에 없는 이름입니다"
                comboboxProps={{ zIndex: 320 }}
              />
              <NumberInput
                label="수량"
                min={1}
                value={form.values.quantity}
                onChange={(val) => setValues({ quantity: typeof val === 'number' ? val : 1 })}
              />
            </Group>
            <Group grow align="flex-start">
              <NumberInput
                label="견적 금액 (원)"
                min={0}
                thousandSeparator=","
                value={form.values.amount}
                onChange={(val) => setValues({ amount: typeof val === 'number' ? val : '' })}
              />
              <TextInput
                label="견적일자"
                type="date"
                value={form.values.estimateDate}
                onChange={(e) => setValues({ estimateDate: e.currentTarget.value })}
              />
            </Group>
            <TextInput
              label="납품기한"
              placeholder="예: 발주 후 3주 이내"
              value={form.values.deliveryTerm}
              onChange={(e) => setValues({ deliveryTerm: e.currentTarget.value })}
            />
            <div>
              <Text size="sm" fw={600} mb={6}>진행할 공정 (발주하면 공정관리로 그대로 넘어갑니다)</Text>
              <Group gap="md">
                {PROCESS_STEPS.map((name) => (
                  <Checkbox
                    key={name}
                    label={name}
                    checked={form.values.processSteps.includes(name)}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      const cur = form.values.processSteps;
                      setValues({
                        processSteps: PROCESS_STEPS.filter((s) => (s === name ? on : cur.includes(s))),
                      });
                    }}
                  />
                ))}
              </Group>
            </div>
            <Textarea
              label="비고"
              placeholder="참고할 내용이 있으면 적어 주세요"
              value={form.values.memo}
              onChange={(e) => setValues({ memo: e.currentTarget.value })}
              minRows={2}
              autosize
            />
            <Group justify="flex-end" gap="xs" mt="xs">
              <Button variant="default" onClick={skipCurrent} disabled={saving}>
                {form.mode === 'upload' && form.index < form.total ? '이 파일 건너뛰기' : '취소'}
              </Button>
              <Button color="dark" onClick={saveForm} loading={saving} leftSection={<IconCheck size={16} />}>
                {form.mode === 'upload' ? '저장하고 올리기' : '저장'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}

function FileTile({
  item, canEdit, onOrder, onEdit, onStatus, onDelete,
}: {
  item: EstimateFileItem;
  canEdit: boolean;
  onOrder: () => void;
  onEdit: () => void;
  onStatus: (status: string) => void;
  onDelete: () => void;
}) {
  const kind = fileKind(item.fileName);
  const Icon = kind.icon;
  const ordered = item.status === '수주성공';

  let footer: ReactNode;
  if (ordered) {
    footer = (
      <Anchor href="/orders" underline="never">
        <Badge color="teal" variant="filled" size="sm" leftSection={<IconCheck size={11} />}>
          발주완료{item.projectNo ? ` · ${item.projectNo}` : ''}
        </Badge>
      </Anchor>
    );
  } else if (item.status === '수주취소') {
    footer = <Badge color="red" variant="outline" size="sm">수주취소</Badge>;
  } else {
    footer = (
      <Group gap={6} justify="center" wrap="nowrap">
        {item.status === '견적완료' && <Badge color="blue" variant="light" size="sm">견적완료</Badge>}
        <Button size="compact-xs" color="blue" leftSection={<IconTruckDelivery size={13} />} onClick={onOrder}>
          발주
        </Button>
      </Group>
    );
  }

  return (
    <Box
      style={{
        position: 'relative',
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: '14px 10px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
      }}
    >
      <Menu position="bottom-end" withinPortal shadow="md" width={180}>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm" style={{ position: 'absolute', top: 6, right: 6 }} aria-label="메뉴">
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item component="a" href={fileUrl(item.id)} target="_blank" leftSection={<IconExternalLink size={14} />}>
            파일 열기
          </Menu.Item>
          <Menu.Item component="a" href={fileUrl(item.id, true)} leftSection={<IconDownload size={14} />}>
            내려받기
          </Menu.Item>
          {canEdit && (
            <>
              <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>정보 수정</Menu.Item>
              <Menu.Divider />
              {!ordered && item.status !== '견적완료' && (
                <Menu.Item leftSection={<IconCheck size={14} />} onClick={() => onStatus('견적완료')}>견적완료로 표시</Menu.Item>
              )}
              {!ordered && item.status !== '수주취소' && (
                <Menu.Item leftSection={<IconX size={14} />} onClick={() => onStatus('수주취소')}>수주취소로 표시</Menu.Item>
              )}
              {!ordered && item.status !== '견적중' && (
                <Menu.Item leftSection={<IconArrowBackUp size={14} />} onClick={() => onStatus('견적중')}>견적중으로 되돌리기</Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>삭제</Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <Tooltip label="눌러서 파일 열기" openDelay={400}>
        <a href={fileUrl(item.id)} target="_blank" rel="noopener" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
          <Icon size={54} stroke={1.4} color={kind.color} />
        </a>
      </Tooltip>

      <Text
        fw={700}
        size="sm"
        ta="center"
        lineClamp={2}
        title={item.projectName}
        style={{ whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere', lineHeight: 1.3, minHeight: '2.6em' }}
      >
        {item.projectName}
      </Text>
      <Text size="xs" c="dimmed" ta="center" truncate="end" w="100%" title={item.partnerName || ''}>
        {item.partnerName || '거래처 미지정'}
        {shortDate(item.estimateDate) && ` · ${shortDate(item.estimateDate)}`}
      </Text>
      {item.amount ? (
        <Text size="xs" fw={700} c="dark.5">₩{item.amount.toLocaleString()}</Text>
      ) : null}
      <Box mt={2}>{footer}</Box>
    </Box>
  );
}
