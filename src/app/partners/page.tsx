"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Table, TextInput, Button, Group, Modal, SimpleGrid,
  TagsInput, ActionIcon, CopyButton, Tooltip, Stack,
  Badge, Select, MultiSelect, FileButton, Text, Textarea, Checkbox
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconMail, IconPrinter, IconDownload, IconUpload, IconPencil, IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import * as xlsx from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';

type Partner = {
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

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSpecialties, setFilterSpecialties] = useState<string[]>([]);

  // Modal & Form state
  const [opened, { open, close }] = useDisclosure(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [mounted, setMounted] = useState(false);
  const [type, setType] = useState('매출처');
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tel, setTel] = useState('');
  const [fax, setFax] = useState('');
  const [specialty, setSpecialty] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/partners');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPartners(data);
      } else {
        setPartners([]);
      }
    } catch {
      setPartners([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchPartners();
  }, [fetchPartners]);

  // 동적 분야(태그) 추출
  const dynamicSpecialties = useMemo(() => {
    const set = new Set<string>();
    partners.forEach(p => {
      if (p.specialty) {
        p.specialty.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set);
  }, [partners]);

  const resetForm = () => {
    setName('');
    setManager('');
    setEmail('');
    setPhone('');
    setTel('');
    setFax('');
    setAddress('');
    setMemo('');
    setSpecialty([]);
    setType('매출처');
    setEditingPartner(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    open();
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setType(partner.type || '매출처');
    setName(partner.name || '');
    setManager(partner.manager || '');
    setEmail(partner.email || '');
    setPhone(partner.phone || '');
    setTel(partner.tel || '');
    setFax(partner.fax || '');
    setAddress(partner.address || '');
    setMemo(partner.memo || '');
    setSpecialty(partner.specialty ? partner.specialty.split(',').filter(Boolean) : []);
    open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const bodyData = { 
      type, name, manager, email, phone, tel, fax, address, memo,
      specialty: specialty.join(',') 
    };

    try {
      const url = editingPartner ? `/api/partners/${editingPartner.id}` : '/api/partners';
      const method = editingPartner ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || '오류가 발생했습니다.');
        return;
      }

      close();
      resetForm();
      fetchPartners();
    } catch (err) {
      alert('요청 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('이 거래처를 삭제하시겠습니까?')) {
      await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      setSelectedIds(prev => prev.filter(i => i !== id));
      fetchPartners();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}개의 거래처를 일괄 삭제하시겠습니까?`)) {
      try {
        const res = await fetch('/api/partners', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        });
        if (res.ok) {
          setSelectedIds([]);
          fetchPartners();
        } else {
          const data = await res.json();
          alert('삭제 실패: ' + (data.error || '오류 발생'));
        }
      } catch (e) {
        alert('일괄 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handlePrintLabel = (id: number) => {
    router.push(`/labels?id=${id}`);
  };

  const filteredPartners = useMemo(() => {
    if (!Array.isArray(partners)) return [];
    return partners.filter(p => {
      const matchSearch = p.name.includes(search) || (p.manager && p.manager.includes(search));
      const matchType = filterType ? p.type === filterType : true;
      const partnerSpecialties = p.specialty ? p.specialty.split(',') : [];
      const matchSpecialty = filterSpecialties.length > 0 
        ? filterSpecialties.some(s => partnerSpecialties.includes(s))
        : true;
      
      return matchSearch && matchType && matchSpecialty;
    });
  }, [partners, search, filterType, filterSpecialties]);

  const filteredIds = useMemo(() => filteredPartners.map(p => p.id), [filteredPartners]);
  const areAllFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const isIndeterminate = filteredIds.some(id => selectedIds.includes(id)) && !areAllFilteredSelected;

  const toggleAll = () => {
    if (areAllFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const emailsToCopy = filteredPartners.map(p => p.email).filter(Boolean).join(', ');

  const exportToExcel = () => {
    if (filteredPartners.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }
    const dataToExport = filteredPartners.map(p => ({
      구분: p.type,
      업체명: p.name,
      분야: p.specialty,
      담당자: p.manager || '',
      휴대폰: p.phone || '',
      회사전화: p.tel || '',
      팩스: p.fax || '',
      이메일: p.email || '',
      주소: p.address || '',
      비고: p.memo || ''
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '거래처목록');
    xlsx.writeFile(workbook, 'TASS_거래처목록.xlsx');
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/partners/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        let msg = `엑셀 데이터 등록 완료: ${data.count}건이 신규 등록되었습니다.`;
        if (data.duplicateCount > 0) {
          msg += `\n\n[중복 차단 안내] 기존 DB에 존재하는 ${data.duplicateCount}건의 업체는 등록이 제외되었습니다:\n${data.duplicateNames.join(', ')}`;
        }
        alert(msg);
        fetchPartners();
      } else {
        alert('엑셀 업로드 실패: ' + data.error);
      }
    } catch (err) {
      alert('업로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <Stack gap="lg">
      <PageHeaderBanner title="거래처 관리" subtitle="TASS 협력업체, 매입처, 매출처 DB 및 송장 출력 시스템">
        {selectedIds.length > 0 && (
          <Button color="red" variant="filled" size="sm" onClick={handleBulkDelete} leftSection={<IconTrash size={15} />}>
            선택 삭제 ({selectedIds.length})
          </Button>
        )}
        <CopyButton value={emailsToCopy}>
          {({ copied, copy }) => (
            <Button 
              color="gray.0" 
              variant="outline" 
              size="sm"
              onClick={copy} 
              leftSection={<IconMail size={15} />}
              disabled={!emailsToCopy}
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.6)' }}
            >
              {copied ? '복사 완료' : '메일 복사'}
            </Button>
          )}
        </CopyButton>
        <Button 
          color="gray.0" 
          variant="outline" 
          size="sm"
          leftSection={<IconDownload size={15} />}
          onClick={exportToExcel}
          style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.6)' }}
        >
          엑셀 다운로드
        </Button>
        <FileButton onChange={handleImport} accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
          {(props) => (
            <Button {...props} color="gray.0" variant="outline" size="sm" leftSection={<IconUpload size={15} />} style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              엑셀 일괄 등록
            </Button>
          )}
        </FileButton>
        <Button color="blue.6" variant="filled" size="sm" leftSection={<IconPlus size={15} />} onClick={handleOpenCreate}>
          새 거래처 등록
        </Button>
      </PageHeaderBanner>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="glass-panel" p="md">
        <TextInput 
          placeholder="업체명 또는 담당자 검색..." 
          value={search} 
          onChange={(e) => setSearch(e.currentTarget.value)} 
          label="검색"
        />
        <Select
          label="구분 필터"
          placeholder="전체"
          data={['매입처', '매출처', '협력사']}
          value={filterType}
          onChange={setFilterType}
          clearable
        />
        <MultiSelect
          label="분야(태그) 필터"
          placeholder="선택..."
          data={dynamicSpecialties}
          value={filterSpecialties}
          onChange={setFilterSpecialties}
          clearable
        />
      </SimpleGrid>

      <div className="glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>
                <Checkbox
                  checked={areAllFilteredSelected}
                  indeterminate={isIndeterminate}
                  onChange={toggleAll}
                  disabled={filteredPartners.length === 0}
                />
              </Table.Th>
              <Table.Th w={85}>구분</Table.Th>
              <Table.Th w={150}>업체명</Table.Th>
              <Table.Th>분야</Table.Th>
              <Table.Th w={100}>담당자</Table.Th>
              <Table.Th w={125}>휴대폰</Table.Th>
              <Table.Th w={125}>회사전화</Table.Th>
              <Table.Th w={110}>팩스</Table.Th>
              <Table.Th w={140}>이메일</Table.Th>
              <Table.Th>주소</Table.Th>
              <Table.Th w={100}>비고</Table.Th>
              <Table.Th w={130}>작업</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredPartners.map(p => (
              <Table.Tr key={p.id} style={{ backgroundColor: selectedIds.includes(p.id) ? 'rgba(51, 154, 240, 0.08)' : undefined }}>
                <Table.Td>
                  <Checkbox
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelection(p.id)}
                  />
                </Table.Td>
                <Table.Td>
                  <Badge 
                    color={p.type === '매입처' ? 'gray' : p.type === '협력사' ? 'dark' : 'blue'} 
                    variant={p.type === '매출처' ? 'filled' : 'light'}
                    size="sm"
                  >
                    {p.type}
                  </Badge>
                </Table.Td>
                <Table.Td fw={700}>{p.name}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    {p.specialty ? p.specialty.split(',').filter(Boolean).map(s => (
                      <Badge key={s} size="xs" variant="outline" color="gray">{s}</Badge>
                    )) : '-'}
                  </Group>
                </Table.Td>
                <Table.Td>{p.manager || '-'}</Table.Td>
                <Table.Td>{p.phone || '-'}</Table.Td>
                <Table.Td>{p.tel || '-'}</Table.Td>
                <Table.Td>{p.fax || '-'}</Table.Td>
                <Table.Td>
                  <Tooltip label={p.email || ''} disabled={!p.email}>
                    <Text truncate="end" size="sm" style={{ maxWidth: 130 }}>{p.email || '-'}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={p.address || ''} disabled={!p.address}>
                    <Text truncate="end" size="sm" style={{ maxWidth: 150 }}>{p.address || '-'}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Tooltip label={p.memo || ''} disabled={!p.memo}>
                    <Text truncate="end" size="sm" style={{ maxWidth: 90 }}>{p.memo || '-'}</Text>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="수정">
                      <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handleOpenEdit(p)}>
                        <IconPencil size={17} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="송장 출력">
                      <ActionIcon color="dark" variant="subtle" size="sm" onClick={() => handlePrintLabel(p.id)}>
                        <IconPrinter size={17} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="삭제">
                      <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDelete(p.id)}>
                        <IconTrash size={17} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {filteredPartners.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={12} ta="center" py="xl" c="dimmed">
                  등록된 거래처가 없습니다.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>

      <Modal 
        opened={mounted && opened} 
        onClose={close} 
        title={editingPartner ? "거래처 정보 수정" : "새 거래처 등록"} 
        size="lg"
        zIndex={300}
        withinPortal={true}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Select 
              label="구분" 
              data={['매입처', '매출처', '협력사']} 
              value={type} 
              onChange={(val) => setType(val || '매출처')} 
              required
            />
            <TextInput 
              label="업체명" 
              required 
              value={name} 
              onChange={(e) => setName(e.currentTarget.value)} 
            />
            <TagsInput 
              label="분야 (태그 추가 가능)" 
              placeholder="태그 입력 후 엔터"
              data={dynamicSpecialties} 
              value={specialty} 
              onChange={setSpecialty} 
            />
            <Group grow>
              <TextInput label="담당자" value={manager} onChange={(e) => setManager(e.currentTarget.value)} />
              <TextInput label="휴대폰" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            </Group>
            <Group grow>
              <TextInput label="회사전화" value={tel} onChange={(e) => setTel(e.currentTarget.value)} />
              <TextInput label="팩스" value={fax} onChange={(e) => setFax(e.currentTarget.value)} />
            </Group>
            <TextInput label="이메일" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            <TextInput label="주소" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
            <Textarea label="비고" value={memo} onChange={(e) => setMemo(e.currentTarget.value)} minRows={2} />
            <Button type="submit" color="dark" fullWidth mt="md">
              {editingPartner ? "수정사항 저장하기" : "등록하기"}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
