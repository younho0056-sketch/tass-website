"use client";

import { useEffect, useState, Suspense, useMemo } from 'react';
import { Button, Stack, Checkbox, Table, Text, Badge, TextInput, ActionIcon } from '@mantine/core';
import { IconPrinter, IconX, IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';

import PageHeaderBanner from '@/components/PageHeaderBanner';

type Partner = {
  id: number;
  type: string;
  name: string;
  manager: string | null;
  phone: string | null;
  tel: string | null;
  fax: string | null;
  address: string | null;
};

function LabelsPageContent() {
  const searchParams = useSearchParams();
  const preselectId = searchParams.get('id');

  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/partners')
      .then(res => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPartners(data);
          if (preselectId) {
            setSelected([parseInt(preselectId)]);
          }
        }
      });
  }, [preselectId]);

  // 실시간 검색 필터링 로직
  const filteredPartners = useMemo(() => {
    if (!searchQuery.trim()) return partners;

    const query = searchQuery.replace(/\s+/g, '').toLowerCase();

    return partners.filter(p => {
      const name = (p.name || '').replace(/\s+/g, '').toLowerCase();
      const manager = (p.manager || '').replace(/\s+/g, '').toLowerCase();
      const address = (p.address || '').replace(/\s+/g, '').toLowerCase();
      const type = (p.type || '').replace(/\s+/g, '').toLowerCase();
      const phone = (p.phone || '').replace(/\s+/g, '').toLowerCase();
      const tel = (p.tel || '').replace(/\s+/g, '').toLowerCase();

      return name.includes(query) || manager.includes(query) || address.includes(query) || type.includes(query) || phone.includes(query) || tel.includes(query);
    });
  }, [partners, searchQuery]);

  const toggleSelection = (id: number) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filteredIds = filteredPartners.map(p => p.id);
    const areAllFilteredSelected = filteredIds.every(id => selected.includes(id));

    if (areAllFilteredSelected) {
      setSelected(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelected(prev => {
        const newSelection = new Set([...prev, ...filteredIds]);
        return Array.from(newSelection);
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedPartners = partners.filter(p => selected.includes(p.id));

  // 전체 선택 체크박스 상태 계산
  const filteredIds = filteredPartners.map(p => p.id);
  const areAllFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.includes(id));
  const isIndeterminate = filteredIds.some(id => selected.includes(id)) && !areAllFilteredSelected;

  return (
    <>
      {/* SCREEN VIEW (Hidden during printing) */}
      <Stack gap="lg" className="print:hidden print-hidden no-print">
        <PageHeaderBanner 
          title="TASS 맞춤형 택배 송장 출력" 
          subtitle="거래처별 맞춤 라벨 및 운송장 출력 시스템"
        >
          <Button 
            leftSection={<IconPrinter size={16} />} 
            onClick={handlePrint}
            disabled={selected.length === 0}
            color="blue.6"
            variant="filled"
            size="sm"
          >
            {selected.length > 0 ? `${selected.length}개 송장 라벨 인쇄하기` : '선택 송장 라벨 인쇄'}
          </Button>
        </PageHeaderBanner>

        {/* 실시간 검색창 */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <TextInput
            placeholder="업체명, 담당자, 주소, 연락처, 구분으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery ? (
                <ActionIcon variant="transparent" onClick={() => setSearchQuery('')} color="gray">
                  <IconX size={16} />
                </ActionIcon>
              ) : null
            }
            size="md"
            radius="md"
          />
          <Text size="sm" c="dimmed" mt="xs">
            {searchQuery ? `검색 결과: 총 ${filteredPartners.length}건` : `전체 거래처: 총 ${partners.length}건`}
          </Text>
        </div>

        <div className="glass-panel table-responsive-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Table striped highlightOnHover withTableBorder>
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
                <Table.Th>구분</Table.Th>
                <Table.Th>업체명</Table.Th>
                <Table.Th>담당자</Table.Th>
                <Table.Th>주소</Table.Th>
                <Table.Th>휴대폰</Table.Th>
                <Table.Th>회사전화</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredPartners.map(p => (
                <Table.Tr key={p.id} style={{ backgroundColor: selected.includes(p.id) ? 'rgba(51, 154, 240, 0.1)' : 'transparent' }}>
                  <Table.Td>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onChange={() => toggleSelection(p.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge color={p.type === '매입처' ? 'red' : 'green'} variant="light">{p.type}</Badge>
                  </Table.Td>
                  <Table.Td fw={500}>{p.name}</Table.Td>
                  <Table.Td>{p.manager || '-'}</Table.Td>
                  <Table.Td>{p.address || '주소 없음'}</Table.Td>
                  <Table.Td>{p.phone || '-'}</Table.Td>
                  <Table.Td>{p.tel || '-'}</Table.Td>
                </Table.Tr>
              ))}
              
              {/* 검색 결과가 없을 경우 */}
              {filteredPartners.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} ta="center" py="xl" c="dimmed">
                    {searchQuery ? "검색 결과와 일치하는 거래처가 없습니다." : "등록된 거래처가 없습니다."}
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>

      {/* PRINT VIEW (Hidden on screen) */}
      <div className="hidden print:block">
        <style type="text/css" media="print">
          {`
            @page { 
              size: A4 portrait; 
              margin: 0; 
            }
            html, body { 
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important; 
              padding: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important; 
              color: #000000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            header, nav, aside, footer, .no-print, .print-hidden, .print\\:hidden, .mantine-AppShell-header, .mantine-AppShell-navbar { 
              display: none !important; 
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .mantine-AppShell-main, .mantine-AppShell-root {
              padding: 0 !important;
              margin: 0 !important;
              height: 100% !important;
              background: #ffffff !important;
            }

            .print\\:block { 
              display: block !important; 
            }

            .print-container {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              width: 100% !important;
              height: 100vh !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              page-break-inside: avoid !important;
              page-break-before: avoid !important;
            }

            .shipping-label-box {
              width: 170mm !important;
              margin: auto !important;
              box-shadow: none !important;
              border: 2px solid #000000 !important;
              background: #ffffff !important;
              page-break-inside: avoid !important;
              padding: 10mm !important;
              border-radius: 4px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 150mm;
            }

            .tass-header {
              border-bottom: 2px solid #000;
              padding-bottom: 4mm;
              margin-bottom: 6mm;
            }

            .info-row {
              margin-bottom: 4mm;
              font-size: 14pt;
              line-height: 1.5;
            }

            .label-bold {
              font-weight: bold;
              width: 90px;
              display: inline-block;
            }

            .tass-logo {
              font-weight: 900;
              font-size: 26pt;
              text-align: right;
              color: #111;
              letter-spacing: 2px;
              border-top: 1px solid #ccc;
              padding-top: 4mm;
              margin-top: 8mm;
            }
          `}
        </style>
        
        {selectedPartners.map((p, idx) => (
          <div key={p.id} className="print-container" style={{ pageBreakAfter: idx < selectedPartners.length - 1 ? 'always' : 'avoid' }}>
            <div className="shipping-label-box">
              <div>
                {/* Header */}
                <div className="tass-header">
                  <Text fw={900} style={{ fontSize: '22pt', letterSpacing: '1px' }}>TASS</Text>
                  <Text size="xs" c="dimmed">Technology About Safety Systems</Text>
                </div>
                
                {/* Sender Info */}
                <div style={{ marginBottom: '10mm' }}>
                  <Text fw={700} size="md" mb={6}>[보내는 사람]</Text>
                  <Text size="md">타스 (TASS) | 최윤호 010-2621-0056</Text>
                  <Text size="md">부산 사상구 감전천로 137</Text>
                </div>

                {/* Receiver Info */}
                <div>
                  <Text fw={900} mb={12} style={{ fontSize: '18pt' }}>[받는 사람]</Text>
                  <div className="info-row"><span className="label-bold">업체명:</span> <strong style={{ fontSize: '16pt' }}>{p.name}</strong></div>
                  <div className="info-row"><span className="label-bold">담당자:</span> {p.manager || '담당자 앞'}</div>
                  <div className="info-row"><span className="label-bold">휴대폰:</span> {p.phone || '-'}</div>
                  <div className="info-row"><span className="label-bold">회사전화:</span> {p.tel || '-'}</div>
                  <div className="info-row"><span className="label-bold">주소:</span> {p.address || '-'}</div>
                </div>
              </div>

              {/* Footer Logo */}
              <div className="tass-logo">
                TASS
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function LabelsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LabelsPageContent />
    </Suspense>
  );
}
