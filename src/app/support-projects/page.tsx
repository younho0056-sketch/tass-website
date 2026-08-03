"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Button, Stack, Group, Text, Badge, TextInput, 
  Modal, Table, ActionIcon, Tooltip, SimpleGrid, Card,
  SegmentedControl, Paper, Box
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconSearch, IconDownload, IconExternalLink, 
  IconClock, IconInfoCircle, IconRefresh
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import PageHeaderBanner from '@/components/PageHeaderBanner';
import { SupportProject } from '@/app/api/support-projects/route';

type SupportProjectWithDDay = SupportProject & {
  dDay: number;
  isUrgent: boolean;
};

function calculateDDay(endDateStr: string): number {
  if (!endDateStr) return 999;
  const target = new Date(endDateStr);
  target.setHours(23, 59, 59, 999);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const QUICK_TAGS = ['R&D', '재창업', 'Smart', '가로등', 'ESS', '스마트공장', '부산/경남'];

export default function SupportProjectsPage() {
  const [projects, setProjects] = useState<SupportProject[]>([]);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<SupportProjectWithDDay | null>(null);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [mounted, setMounted] = useState(false);

  const fetchProjects = useCallback(async (forceRefresh = false) => {
    try {
      // Check client-side sessionStorage cache first if not force refresh
      if (!forceRefresh && typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('tass_support_projects_cache');
        const cachedTime = sessionStorage.getItem('tass_support_projects_time');
        if (cached && cachedTime && (Date.now() - parseInt(cachedTime, 10) < 5 * 60 * 1000)) {
          setProjects(JSON.parse(cached));
          return;
        }
      }

      const res = await fetch('/api/support-projects');
      const data = await res.json();

      if (data.projects) {
        setProjects(data.projects);
        const now = Date.now();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('tass_support_projects_cache', JSON.stringify(data.projects));
          sessionStorage.setItem('tass_support_projects_time', now.toString());
        }
      }
    } catch (e) {
      console.error('Failed to fetch support projects:', e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchProjects();
  }, [fetchProjects]);

  // Compute D-Day & Metrics
  const projectsWithDDay = useMemo(() => {
    return projects.map(p => {
      const dDay = calculateDDay(p.endDate);
      const isUrgent = dDay >= 0 && dDay <= 5;
      return { ...p, dDay, isUrgent };
    });
  }, [projects]);

  const metrics = useMemo(() => {
    const total = projectsWithDDay.length;
    const urgent = projectsWithDDay.filter(p => p.isUrgent).length;
    const tpCount = projectsWithDDay.filter(p => p.orgCode === 'TP').length;
    const kstartupCount = projectsWithDDay.filter(p => p.orgCode === 'K_STARTUP').length;
    const bizCount = projectsWithDDay.filter(p => p.orgCode === 'BIZ_MADANG').length;
    const semasCount = projectsWithDDay.filter(p => p.orgCode === 'SEMAS').length;
    const irisCount = projectsWithDDay.filter(p => p.orgCode === 'IRIS').length;

    return { total, urgent, tpCount, kstartupCount, bizCount, semasCount, irisCount };
  }, [projectsWithDDay]);

  // Filtered List
  const filteredProjects = useMemo(() => {
    return projectsWithDDay.filter(p => {
      // Org Filter
      let matchOrg = true;
      if (orgFilter !== 'ALL') {
        matchOrg = p.orgCode === orgFilter;
      }

      // Search (title, tags, organization, category, description, target)
      const q = search.trim().toLowerCase();
      let matchSearch = true;
      if (q) {
        matchSearch = 
          p.title.toLowerCase().includes(q) ||
          p.organization.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.target.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q));
      }

      return matchOrg && matchSearch;
    });
  }, [projectsWithDDay, orgFilter, search]);

  // Urgent pinned list
  const urgentPinnedList = useMemo(() => {
    return filteredProjects
      .filter(p => p.isUrgent)
      .sort((a, b) => a.dDay - b.dDay);
  }, [filteredProjects]);

  // Handle Excel Export
  const handleExportExcel = () => {
    const exportData = filteredProjects.map((p, idx) => {
      const dDayStr = p.dDay < 0 
        ? `마감 (D+${Math.abs(p.dDay)})` 
        : p.dDay === 0 
          ? 'D-Day (오늘마감)' 
          : `D-${p.dDay}`;

      return {
        '번호': idx + 1,
        '공고ID': p.id,
        '공고기관': p.organization,
        '카테고리': p.category,
        '공고명': p.title,
        '지원대상': p.target,
        '지원규모': p.budget,
        '접수시작일': p.startDate,
        '접수마감일': p.endDate,
        '남은기간(D-Day)': dDayStr,
        '담당문의': p.contact,
        '태그/키워드': p.tags.join(', '),
        '공고링크': p.url
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 },  // 번호
      { wch: 12 }, // 공고ID
      { wch: 22 }, // 공고기관
      { wch: 14 }, // 카테고리
      { wch: 45 }, // 공고명
      { wch: 35 }, // 지원대상
      { wch: 30 }, // 지원규모
      { wch: 12 }, // 접수시작일
      { wch: 12 }, // 접수마감일
      { wch: 16 }, // D-Day
      { wch: 30 }, // 담당문의
      { wch: 30 }, // 태그
      { wch: 30 }  // 링크
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '나라지원사업공고');

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `TASS_나라지원사업공고_${todayStr}.xlsx`);
  };

  const getOrgBadgeColor = (code: string) => {
    switch (code) {
      case 'TP': return 'blue';
      case 'K_STARTUP': return 'grape';
      case 'BIZ_MADANG': return 'orange';
      case 'SEMAS': return 'teal';
      case 'IRIS': return 'cyan';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <PageHeaderBanner 
        title="🏛️ 나라 지원사업 통합 관제" 
        subtitle="부산/경남 TP, K-Startup, 기업마당, 소상공인진흥공단, IRiS 지원사업 실시간 모니터링 및 엑셀 다운로드"
      >
        <Button 
          variant="filled" 
          color="teal.6" 
          size="sm"
          leftSection={<IconDownload size={16} />}
          onClick={handleExportExcel}
          style={{ fontWeight: 700 }}
        >
          📊 지원공고 엑셀 다운로드
        </Button>
        <Button
          variant="outline"
          color="gray.0"
          size="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={() => fetchProjects(true)}
          style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}
        >
          새로고침
        </Button>
      </PageHeaderBanner>

      {/* 요약 통계 카드 */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
        <Paper p="md" className="glass-panel">
          <Text size="xs" c="dimmed" fw={700}>전체 공고</Text>
          <Text size="xl" fw={900} color="dark">{metrics.total}건</Text>
          <Text size="xs" c="gray.6">실시간 집계 중</Text>
        </Paper>
        <Paper p="md" className="glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
          <Group gap={4} align="center">
            <IconClock size={14} color="#ef4444" />
            <Text size="xs" c="red.7" fw={700}>🚨 마감 임박</Text>
          </Group>
          <Text size="xl" fw={900} color="red.7">{metrics.urgent}건</Text>
          <Text size="xs" c="red.6">D-5 이내 접수마감</Text>
        </Paper>
        <Paper p="md" className="glass-panel">
          <Text size="xs" c="blue.7" fw={700}>부산/경남 TP</Text>
          <Text size="xl" fw={900} color="blue.7">{metrics.tpCount}건</Text>
          <Text size="xs" c="dimmed">스마트공장/R&D</Text>
        </Paper>
        <Paper p="md" className="glass-panel">
          <Text size="xs" c="grape.7" fw={700}>K-Startup</Text>
          <Text size="xl" fw={900} color="grape.7">{metrics.kstartupCount}건</Text>
          <Text size="xs" c="dimmed">창업진흥원 전용</Text>
        </Paper>
        <Paper p="md" className="glass-panel">
          <Text size="xs" c="orange.7" fw={700}>기업마당</Text>
          <Text size="xl" fw={900} color="orange.7">{metrics.bizCount}건</Text>
          <Text size="xs" c="dimmed">중소벤처기업부</Text>
        </Paper>
        <Paper p="md" className="glass-panel">
          <Text size="xs" c="cyan.7" fw={700}>IRiS / 소상공인</Text>
          <Text size="xl" fw={900} color="cyan.7">{metrics.semasCount + metrics.irisCount}건</Text>
          <Text size="xs" c="dimmed">범부처 연구/설비</Text>
        </Paper>
      </SimpleGrid>

      {/* 기관 카테고리 필터 탭 */}
      <SegmentedControl
        value={orgFilter}
        onChange={setOrgFilter}
        data={[
          { label: `전체 보기 (${metrics.total})`, value: 'ALL' },
          { label: `부산/경남 TP (${metrics.tpCount})`, value: 'TP' },
          { label: `K-Startup (${metrics.kstartupCount})`, value: 'K_STARTUP' },
          { label: `기업마당 (${metrics.bizCount})`, value: 'BIZ_MADANG' },
          { label: `소상공인공단 (${metrics.semasCount})`, value: 'SEMAS' },
          { label: `IRiS 림스 (${metrics.irisCount})`, value: 'IRIS' },
        ]}
        size="md"
        radius="md"
        className="glass-panel"
        style={{ padding: '6px' }}
      />

      {/* 키워드 검색 & 퀵 태그 버튼 */}
      <Paper p="md" className="glass-panel">
        <Stack gap="xs">
          <TextInput
            placeholder="키워드 (예: R&D, 재창업, Smart, 가로등, ESS 등) 또는 공고명/기관명 검색..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={18} />}
            rightSection={search ? (
              <Button size="xs" variant="subtle" color="gray" onClick={() => setSearch('')}>초기화</Button>
            ) : null}
          />

          <Group gap={6} align="center" wrap="wrap">
            <Text size="xs" fw={700} c="dimmed">추천 키워드 퀵 필터:</Text>
            {QUICK_TAGS.map(tag => {
              const isSelected = search.toLowerCase() === tag.toLowerCase();
              return (
                <Badge
                  key={tag}
                  variant={isSelected ? 'filled' : 'outline'}
                  color={isSelected ? 'blue' : 'gray'}
                  size="sm"
                  style={{ cursor: 'pointer', textTransform: 'none' }}
                  onClick={() => setSearch(isSelected ? '' : tag)}
                >
                  #{tag}
                </Badge>
              );
            })}
          </Group>
        </Stack>
      </Paper>

      {/* 🚨 마감 임박 상단 핀 공고 Section */}
      {urgentPinnedList.length > 0 && (
        <Card p="md" radius="md" style={{ border: '2px solid #f87171', backgroundColor: '#fef2f2' }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <IconClock size={20} color="#dc2626" />
                <Text fw={900} size="md" c="red.8">🚨 마감 임박 긴급 공고 (D-5 이내)</Text>
                <Badge color="red" variant="filled" size="sm">{urgentPinnedList.length}건 마감임박</Badge>
              </Group>
              <Text size="xs" c="red.7" fw={600}>* 서류 접수 기한을 반드시 확인하세요</Text>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {urgentPinnedList.map(p => (
                <Paper key={p.id} p="sm" radius="sm" style={{ border: '1px solid #fca5a5', backgroundColor: '#ffffff' }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                    <Badge color={getOrgBadgeColor(p.orgCode)} size="xs" variant="light">{p.organization}</Badge>
                    <Badge color="red" variant="filled" size="md" style={{ fontWeight: 900 }}>
                      {p.dDay === 0 ? 'D-Day (오늘마감)' : `D-${p.dDay}`}
                    </Badge>
                  </Group>
                  
                  <Text fw={800} size="sm" color="dark" lineClamp={1} style={{ cursor: 'pointer' }} onClick={() => { setSelectedProject(p); openDetailModal(); }}>
                    {p.title}
                  </Text>
                  
                  <Group justify="space-between" align="center" mt={6}>
                    <Text size="xs" c="dimmed">마감일: {p.endDate}</Text>
                    <Button size="xs" variant="light" color="red" leftSection={<IconInfoCircle size={14} />} onClick={() => { setSelectedProject(p); openDetailModal(); }}>
                      상세보기
                    </Button>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {/* 공고 목록 테이블 */}
      <div className="glass-panel table-responsive-container">
        <Table striped highlightOnHover withTableBorder verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={110}>공고기관</Table.Th>
              <Table.Th w={100}>카테고리</Table.Th>
              <Table.Th style={{ minWidth: 260 }}>공고명</Table.Th>
              <Table.Th w={180}>지원규모</Table.Th>
              <Table.Th w={130}>접수마감일 (D-Day)</Table.Th>
              <Table.Th w={130}>작업</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredProjects.map(p => (
              <Table.Tr key={p.id} style={{ backgroundColor: p.isUrgent ? 'rgba(254, 226, 226, 0.25)' : undefined }}>
                <Table.Td>
                  <Badge color={getOrgBadgeColor(p.orgCode)} variant="light" size="sm">
                    {p.organization}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color="gray" variant="outline" size="xs">
                    {p.category}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text 
                      fw={700} 
                      size="sm" 
                      color="dark" 
                      style={{ cursor: 'pointer', wordBreak: 'keep-all' }}
                      onClick={() => { setSelectedProject(p); openDetailModal(); }}
                    >
                      {p.title}
                    </Text>
                    <Group gap={4} wrap="wrap">
                      {p.tags.map(t => (
                        <Text key={t} size="10px" c="dimmed" style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                          #{t}
                        </Text>
                      ))}
                    </Group>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" fw={600} color="dark" style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                    {p.budget}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="xs" fw={600}>{p.endDate}</Text>
                    <Badge 
                      color={p.isUrgent ? 'red' : 'blue'} 
                      variant={p.isUrgent ? 'filled' : 'light'} 
                      size="xs"
                      style={{ width: 'fit-content' }}
                    >
                      {p.dDay < 0 ? `마감 (D+${Math.abs(p.dDay)})` : p.dDay === 0 ? 'D-Day' : `D-${p.dDay}`}
                    </Badge>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="blue"
                      onClick={() => { setSelectedProject(p); openDetailModal(); }}
                    >
                      상세
                    </Button>
                    <Tooltip label="공모처 원본 페이지로 이동">
                      <ActionIcon 
                        component="a" 
                        href={p.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        color="gray" 
                        variant="subtle" 
                        size="sm"
                      >
                        <IconExternalLink size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}

            {filteredProjects.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} ta="center" py="xl" c="dimmed">
                  검색 조건 또는 해당 기관의 공고가 존재하지 않습니다.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>

      {/* 공고 상세 정보 모달 */}
      <Modal
        opened={mounted && detailModalOpened}
        onClose={closeDetailModal}
        title={`[지원공고 상세] ${selectedProject?.organization || ''}`}
        size="lg"
        zIndex={300}
        withinPortal={true}
      >
        {selectedProject && (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Badge color={getOrgBadgeColor(selectedProject.orgCode)} size="lg">
                {selectedProject.organization}
              </Badge>
              <Badge color={selectedProject.isUrgent ? 'red' : 'blue'} size="lg" variant="filled">
                {selectedProject.dDay < 0 ? '접수마감' : selectedProject.dDay === 0 ? 'D-Day (오늘마감)' : `D-${selectedProject.dDay}`}
              </Badge>
            </Group>

            <Text fw={900} size="lg" color="dark">{selectedProject.title}</Text>

            <Card padding="md" radius="sm" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <SimpleGrid cols={2} spacing="xs">
                <div>
                  <Text size="xs" c="dimmed" fw={700}>지원분야 카테고리</Text>
                  <Text size="sm" fw={600}>{selectedProject.category}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>접수 기간</Text>
                  <Text size="sm" fw={600}>{selectedProject.startDate} ~ {selectedProject.endDate}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>지원 대상</Text>
                  <Text size="sm" fw={600}>{selectedProject.target}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed" fw={700}>지원 규모/한도</Text>
                  <Text size="sm" fw={600}>{selectedProject.budget}</Text>
                </div>
              </SimpleGrid>
            </Card>

            <Box>
              <Text size="xs" c="dimmed" fw={700} mb={4}>공고 요약 내용</Text>
              <Text size="sm" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedProject.description}
              </Text>
            </Box>

            <Box>
              <Text size="xs" c="dimmed" fw={700} mb={4}>담당 문의처</Text>
              <Text size="sm" fw={600}>{selectedProject.contact}</Text>
            </Box>

            <Group gap={6} wrap="wrap">
              {selectedProject.tags.map(t => (
                <Badge key={t} size="sm" variant="outline" color="gray">#{t}</Badge>
              ))}
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeDetailModal}>닫기</Button>
              <Button 
                component="a" 
                href={selectedProject.url} 
                target="_blank" 
                rel="noreferrer"
                color="blue"
                leftSection={<IconExternalLink size={16} />}
              >
                원본 공고 사이트 바로가기
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
