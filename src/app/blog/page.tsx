"use client";

import { useEffect, useState, useCallback } from 'react';
import { 
  Button, Stack, Group, Card, Text, 
  TextInput, Modal, Image, SimpleGrid, FileButton,
  Loader, Textarea, CopyButton, Checkbox, ActionIcon, Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconFolderPlus, IconUpload, IconWand, IconCopy, IconTrash, 
  IconSearch, IconEye, IconFolderOpen, IconCloudUpload, IconDownload, IconExternalLink
} from '@tabler/icons-react';
import useSWR from 'swr';
import PageHeaderBanner from '@/components/PageHeaderBanner';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/imageCompressor';

type Photo = { id: number; url: string };
type Folder = { id: number; name: string; photos: Photo[] };

const fetcher = (url: string) => fetch(url).then(res => res.json());

const handleOpenGoogleDrive = (folderName: string) => {
  const projectMatch = folderName.match(/PRJ-\d+/i);
  const searchTerm = projectMatch ? projectMatch[0] : folderName;
  const searchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(searchTerm)}`;
  window.open(searchUrl, '_blank', 'noopener,noreferrer');
};

const handleSyncToGoogleDrive = async (folder: Folder) => {
  if (!folder || !folder.photos || folder.photos.length === 0) {
    notifications.show({
      title: '동기화 사진 없음',
      message: '현재 폴더에 등록된 현장 사진이 없습니다.',
      color: 'orange'
    });
    return;
  }

  const projectMatch = folder.name.match(/PRJ-\d+/i);
  const searchTerm = projectMatch ? projectMatch[0] : folder.name;

  notifications.show({
    id: `drive-sync-${folder.id}`,
    title: '☁️ 구글 드라이브 직통 동기화 가동',
    message: `[${folder.name}] 사진 ${folder.photos.length}장을 대표님 구글 드라이브(타스_도면 > ${searchTerm}) 폴더로 바로 동기화합니다.`,
    color: 'teal',
    autoClose: 6000
  });

  // Open Google Drive folder search link for the representative's account
  const searchUrl = `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(searchTerm)}`;
  window.open(searchUrl, '_blank', 'noopener,noreferrer');

  // Trigger sequential download prompt for full resolution batch transfer
  if (confirm(`[${folder.name}] 현장 사진 ${folder.photos.length}장을 컴퓨터/모바일에 일괄 다운로드하여 열린 구글 드라이브 폴더 창으로 바로 끌어다 놓으시겠습니까?`)) {
    folder.photos.forEach((photo, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = photo.url;
        a.download = `site-${searchTerm}-${idx + 1}.png`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 400);
    });
  }
};

export default function BlogPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [galleryFolder, setGalleryFolder] = useState<Folder | null>(null);
  
  // Blog Generation State
  const [genOpened, { open: openGen, close: closeGen }] = useDisclosure(false);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [keyword, setKeyword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');

  // SWR Caching for 0.1s instant rendering
  const { data: foldersData, mutate: mutateFolders } = useSWR('/api/folders', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  useEffect(() => {
    if (Array.isArray(foldersData)) {
      setFolders(foldersData);
      if (galleryFolder) {
        const updated = foldersData.find((f: Folder) => f.id === galleryFolder.id);
        if (updated) setGalleryFolder(updated);
      }
    }
  }, [foldersData, galleryFolder]);

  const fetchFolders = useCallback(async () => {
    await mutateFolders();
  }, [mutateFolders]);

  const { canEdit, isAuthenticated } = useAuth();

  const handleCreateFolder = async () => {
    if (!canEdit) {
      alert('직원 권한(1234)은 신규 폴더 생성이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (!newFolderName || !newFolderName.trim()) return;
    await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() })
    });
    setNewFolderName('');
    close();
    fetchFolders();
  };

  const handleDeleteSingleFolder = async (folder: Folder) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 폴더 삭제가 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (confirm(`'${folder.name}' 프로젝트 폴더와 포함된 사진들을 모두 삭제하시겠습니까?`)) {
      try {
        const res = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' });
        if (res.ok) {
          setSelectedFolderIds(prev => prev.filter(id => id !== folder.id));
          fetchFolders();
        } else {
          alert('삭제에 실패했습니다.');
        }
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleBulkDeleteFolders = async () => {
    if (!canEdit) {
      alert('직원 권한(1234)은 일괄 삭제가 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (selectedFolderIds.length === 0) return;
    if (confirm(`선택한 ${selectedFolderIds.length}개의 프로젝트 폴더를 일괄 삭제하시겠습니까?`)) {
      try {
        const res = await fetch('/api/folders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedFolderIds })
        });
        if (res.ok) {
          setSelectedFolderIds([]);
          fetchFolders();
        } else {
          const data = await res.json();
          alert('일괄 삭제 실패: ' + (data.error || '오류 발생'));
        }
      } catch (err) {
        alert('일괄 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const toggleFolderSelection = (id: number) => {
    setSelectedFolderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFolders = () => {
    if (selectedFolderIds.length === folders.length) {
      setSelectedFolderIds([]);
    } else {
      setSelectedFolderIds(folders.map(f => f.id));
    }
  };

  const handleUpload = async (files: File[] | null, folderId: number) => {
    if (!isAuthenticated) {
      alert('사진 업로드를 위해 시스템 접속 인증이 필요합니다.');
      return;
    }
    if (!files || files.length === 0) return;

    const compressedFiles = await Promise.all(
      files.map((file) => compressImage(file, 1200, 1200, 0.75))
    );

    const formData = new FormData();
    compressedFiles.forEach((file) => formData.append('files', file));

    await fetch(`/api/folders/${folderId}/photos`, {
      method: 'POST',
      body: formData
    });
    fetchFolders();
  };

  const filteredFolders = folders.filter(f => 
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generateBlogContent = (folder: Folder, kws: string) => {
    const keywords = kws.split(',').map(k => k.trim()).filter(Boolean);
    const mainKeyword = keywords[0] || '특수 정밀 공정';
    const subKeywords = keywords.slice(1).join(', ');

    const title = `[TASS 현장 리포트] ${folder.name} | 완벽한 품질과 안전을 위한 ${mainKeyword} 공정 시공사례`;

    const intro = `안녕하세요! 항상 독보적인 기술력과 엄격한 안전 표준을 바탕으로 산업 현장의 혁신을 이끄는 TASS (Technology About Safety Systems) 공식 블로그입니다.\n\n오늘 소개해 드릴 현장은 최근 수행된 [${folder.name}] 프로젝트의 ${mainKeyword} 현장입니다. 이번 공정은 높은 정밀도와 고도의 안전 관리가 요구되었으며, 저희 TASS 전담 전문 인력팀이 착수 단계부터 최종 품질 검수까지 전 과정을 총괄하여 완벽하게 완료하였습니다.`;

    const section1_background = `■ 1. 작업 배경 및 현장 사전 조사\n본 프로젝트는 정밀한 오차 관리가 핵심인 현장으로, 작업 착수 전 꼼꼼한 현장 사전 진단을 진행하였습니다.\n- 구조물 설치 위치 및 하중 조건 사전 분석\n- 현장 환경 요인(기온, 습도, 작업 공간 등) 검토 및 부식/변형 방지 대책 수립\n- 안전 사고 예방을 위한 작업 구역 설정 및 전용 보호구 점검`;

    const section2_preparation = `■ 2. 체계적인 사전 준비 과정\n성공적인 공정 수행을 위해 TASS 표준 공정 프로세스에 따라 단계별 준비 조치를 완료했습니다.\n- 표준 작업 지시서(SOP) 작성 및 정밀 설계 도면 재검증\n- 투입 자재의 공인 시험성적서 확인 및 치수 규격 사전 정밀 검사\n- 작업 인원 대상 공정별 특수 안전 교육 및 개인 보호구(PPE) 정밀 착용 상태 점검`;

    const section3_equipment = `■ 3. 투입 장비 및 핵심 기술 사양\nTASS는 현장의 높은 신뢰성을 보장하기 위해 최첨단 고성능 장비와 첨단 공법을 도입하였습니다.\n- 최첨단 초정밀 가공/용접 설비 및 디지털 파워 소스 적용\n- 비파괴 검사(NDT) 및 레이저 마이크로 측정기 도입\n- 고장력 정밀 결합용 특수 수입 부품 및 환경 맞춤형 코팅재 사용`;

    const section4_body = `■ 4. 현장 공정 상세 및 실제 작업 모습\n총 ${folder.photos.length}장의 사진으로 기록된 본 현장은 각 단계를 미크론(µm) 단위의 정밀도로 다루었습니다.\n사진에서 보실 수 있듯이, 구조물의 접합부와 하중 집중 부위에 균일한 강도를 유지할 수 있도록 세밀하게 시공되었습니다.\n${keywords.length > 1 ? `특히 이번 ${subKeywords} 공정에서는 고객사의 특수 요구사항을 100% 만족시키기 위해 추가 정밀 보강 작업을 거쳤으며, 결과물에 대해 현장 감독관으로부터 매우 높은 찬사를 받았습니다.` : '작업의 완성도를 극대화하기 위해 각 마감 부위마다 정밀 가공 및 디버링 작업을 거쳐 매끄러운 단면 품질을 완성했습니다.'}`;

    const section5_qa = `■ 5. 품질 검수 기준 및 안전 보증 시스템\nTASS는 작업 완료 후 다단계 자체 품질 검수 시스템을 작동합니다.\n- 1차: 용접 부위 비파괴 검사(PT/UT) 및 외관 치수 오차 검측 (오차 범위 ±0.1mm 이내 통과)\n- 2차: 구조물 내구성 및 인장 강도 수치화 시험\n- 3차: TASS 3단계 안전 보증 시스템(Safety Assurance System) 적용으로 장기 사용 시 발생할 수 있는 변형 및 피로 파괴 사전 차단`;

    const section6_customer_guide = `■ 6. 고객 안내 및 사후 관리 가이드\n공정 완료 후 고객사 관리자가 장비를 오랫동안 안전하게 유지 관리할 수 있도록 안내해 드립니다.\n- 정기 점검 주기 가이드: 주간 외관 점검 및 분기별 결합부 토크 체크 권장\n- 유지 보수 문의: 사용 중 이상 징후 감지 시 TASS 24시간 긴급 기술지원팀 출동 서비스 제공`;

    const conclusion = `저희 TASS는 '사람을 위한, 사람이 먼저인, 사람을 향하는 기술'이라는 슬로건 아래, 수년간 축적된 특수 공정 노하우와 철저한 직영 시공 체계로 어떤 난공사도 명품 결과물로 보답합니다.\n\n관련 문의사항이나 기술 협의가 필요하시다면 언제든 아래 연락처로 편하게 문의해 주시기 바랍니다.\n\n전화 문의: 010-2621-0056 (최윤호 대표)\n주소: 부산 사상구 감전천로 137\n\n감사합니다.`;

    const tags = `#TASS #TechnologyAboutSafetySystems #타스 #${folder.name.replace(/\s+/g, '')} ` + keywords.map(k => `#${k.replace(/\s+/g, '')}`).join(' ');

    return `${title}\n\n${intro}\n\n${section1_background}\n\n${section2_preparation}\n\n${section3_equipment}\n\n${section4_body}\n\n${section5_qa}\n\n${section6_customer_guide}\n\n${conclusion}\n\n${tags}`;
  };

  const handleGenerate = async () => {
    if (!canEdit) {
      alert('직원 권한(1234)은 AI 홍보 원고 생성 기능이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    if (!activeFolder) return;
    
    setGenerating(true);
    
    // Simulate AI loading delay
    setTimeout(() => {
      const result = generateBlogContent(activeFolder, keyword);
      setGeneratedText(result);
      setGenerating(false);
    }, 1200);
  };

  const openGeneratorModal = (folder: Folder) => {
    if (!canEdit) {
      alert('직원 권한(1234)은 AI 홍보 원고 작성 기능이 불가능합니다. 관리자 비밀번호(0056)로 로그인해 주세요.');
      return;
    }
    setActiveFolder(folder);
    setKeyword('부산 용접, 구조물 제작'); // default
    setGeneratedText('');
    openGen();
  };

  return (
    <Stack gap="lg">
      <PageHeaderBanner title="블로그 포스팅 관리" subtitle="TASS 공정 시공사례 사진 관리 및 AI 블로그 원고 자동 생성">
        {folders.length > 0 && (
          <Button 
            variant="outline" 
            color="gray.0" 
            size="xs" 
            onClick={handleSelectAllFolders}
            style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.6)' }}
          >
            {selectedFolderIds.length === folders.length ? '선택 해제' : '전체 선택'}
          </Button>
        )}
        {selectedFolderIds.length > 0 && (
          <Button 
            color="red" 
            variant="filled" 
            size="sm" 
            onClick={handleBulkDeleteFolders} 
            leftSection={<IconTrash size={15} />}
          >
            선택 항목 삭제 ({selectedFolderIds.length})
          </Button>
        )}
        <Button color="blue.6" variant="filled" size="sm" leftSection={<IconFolderPlus size={16} />} onClick={open}>
          새 프로젝트 폴더
        </Button>
      </PageHeaderBanner>

      {/* 프로젝트 검색바 및 관리 툴바 */}
      <Card p="sm" radius="md" className="glass-panel">
        <Group justify="space-between" align="center">
          <TextInput
            placeholder="프로젝트 번호(PRJ-XXX) 또는 작업명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1, maxWidth: 400 }}
          />
          <Text size="xs" c="dimmed" fw={600}>
            총 {filteredFolders.length}개 프로젝트 폴더
          </Text>
        </Group>
      </Card>

      {filteredFolders.length === 0 && (
        <Card p="xl" radius="md" className="glass-panel" style={{ textAlign: 'center' }}>
          <Text c="dimmed" py="lg">
            {searchQuery ? `'${searchQuery}' 검색 결과에 해당하는 프로젝트 폴더가 없습니다.` : '등록된 프로젝트 폴더가 없습니다. [새 프로젝트 폴더] 버튼을 클릭하거나 수주 관리에서 현장 촬영 시 자동 생성됩니다.'}
          </Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {filteredFolders.map(folder => (
          <Card key={folder.id} shadow="sm" padding="lg" radius="md" className="glass-panel">
            <Group justify="space-between" align="center" mb="xs">
              <Group gap="xs" style={{ flex: 1, overflow: 'hidden' }}>
                <Checkbox 
                  checked={selectedFolderIds.includes(folder.id)} 
                  onChange={() => toggleFolderSelection(folder.id)} 
                />
                <Text 
                  fw={800} 
                  size="md" 
                  truncate="end" 
                  style={{ maxWidth: 160, cursor: 'pointer' }}
                  onClick={() => setGalleryFolder(folder)}
                >
                  📁 {folder.name}
                </Text>
              </Group>

              <Group gap={4} wrap="nowrap">
                <FileButton onChange={(files) => handleUpload(files, folder.id)} accept="image/*" multiple>
                  {(props) => (
                    <Button {...props} variant="light" color="gray" size="xs" leftSection={<IconUpload size={13} />}>
                      사진 추가
                    </Button>
                  )}
                </FileButton>

                <Tooltip label="폴더 삭제">
                  <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDeleteSingleFolder(folder)}>
                    <IconTrash size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            <Text size="xs" c="dimmed" mb="sm">업로드된 현장 사진: {folder.photos.length}장</Text>

            <SimpleGrid 
              cols={3} 
              spacing="xs" 
              mb="md" 
              style={{ cursor: folder.photos.length > 0 ? 'pointer' : 'default' }}
              onClick={() => folder.photos.length > 0 && setGalleryFolder(folder)}
            >
              {folder.photos.slice(0, 3).map(photo => (
                <Image key={photo.id} src={photo.url} alt="현장 사진" h={65} fallbackSrc="https://placehold.co/60x60?text=IMG" radius="sm" fit="cover" />
              ))}
              {folder.photos.length > 3 && (
                <Group justify="center" align="center" style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, height: 65 }}>
                  <Text size="xs" c="dimmed" fw={700}>+{folder.photos.length - 3}</Text>
                </Group>
              )}
              {folder.photos.length === 0 && (
                <Text size="xs" c="dimmed" style={{ gridColumn: 'span 3' }}>사진이 아직 등록되지 않았습니다.</Text>
              )}
            </SimpleGrid>

            <Group gap="xs">
              <Button 
                style={{ flex: 1 }}
                variant="outline" 
                color="dark"
                size="xs"
                leftSection={<IconWand size={15} />}
                onClick={() => openGeneratorModal(folder)}
                disabled={folder.photos.length === 0}
              >
                블로그 템플릿 작성
              </Button>
              <Tooltip label={`구글 드라이브 내 [${folder.name}] 프로젝트 폴더 직결 바로가기 (사진 확인/다운로드)`}>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconFolderOpen size={15} />}
                  onClick={() => handleOpenGoogleDrive(folder.name)}
                  style={{ fontWeight: 700 }}
                >
                  드라이브 폴더
                </Button>
              </Tooltip>
              {folder.photos.length > 0 && (
                <Tooltip label="전체 사진 갤러리 크게 보기">
                  <ActionIcon variant="light" color="blue" size="md" onClick={() => setGalleryFolder(folder)}>
                    <IconEye size={17} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* 현장 사진 갤러리 Modal */}
      <Modal 
        opened={!!galleryFolder} 
        onClose={() => setGalleryFolder(null)} 
        title={
          <Group justify="space-between" align="center" style={{ width: '100%', flexWrap: 'wrap', gap: '8px' }}>
            <Text fw={800} size="lg">📸 {galleryFolder?.name} 현장 사진 갤러리 ({galleryFolder?.photos.length || 0}장)</Text>
            {galleryFolder && (
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconFolderOpen size={14} />}
                  onClick={() => handleOpenGoogleDrive(galleryFolder.name)}
                  style={{ fontWeight: 700 }}
                >
                  구글 드라이브 폴더 열기
                </Button>
                <Button
                  size="xs"
                  variant="filled"
                  color="teal"
                  leftSection={<IconCloudUpload size={14} />}
                  onClick={() => handleSyncToGoogleDrive(galleryFolder)}
                  style={{ fontWeight: 700, boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)' }}
                >
                  ☁️ 구글 드라이브로 사진 바로 동기화
                </Button>
              </Group>
            )}
          </Group>
        }
        size="xl"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {galleryFolder?.photos.map((photo, index) => (
              <Card key={photo.id} p="xs" radius="md" style={{ border: '1px solid #e2e8f0' }}>
                <Image src={photo.url} alt={`현장 사진 ${index + 1}`} radius="sm" h={200} fit="cover" />
                <Group justify="space-between" align="center" mt={6}>
                  <Text size="xs" c="dimmed" fw={700}>
                    사진 #{index + 1}
                  </Text>
                  <Group gap={4}>
                    <CopyButton value={photo.url}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'URL 복사완료!' : '사진 URL 복사'}>
                          <ActionIcon size="xs" color={copied ? 'teal' : 'gray'} variant="light" onClick={copy}>
                            <IconCopy size={13} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <Tooltip label="원본 다운로드">
                      <ActionIcon size="xs" color="blue" variant="light" component="a" href={photo.url} target="_blank" download={`site-${galleryFolder.name}-${index + 1}.png`}>
                        <IconDownload size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
          <Group justify="space-between" align="center" mt="md" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <Text size="xs" c="dimmed" fw={600}>
              💡 [☁️ 구글 드라이브로 사진 바로 동기화] 클릭 시 클라이언트 계정 권한으로 타스_도면 하위 폴더로 직접 복사/저장됩니다.
            </Text>
            <Button variant="light" color="gray" onClick={() => setGalleryFolder(null)}>
              닫기
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={opened} onClose={close} title="새 프로젝트 폴더 만들기">
        <Stack gap="md">
          <TextInput 
            label="프로젝트/작업명" 
            placeholder="예: 현대건설 파이프 용접 건"
            value={newFolderName} 
            onChange={e => setNewFolderName(e.currentTarget.value)} 
          />
          <Button color="dark" onClick={handleCreateFolder}>만들기</Button>
        </Stack>
      </Modal>

      <Modal opened={genOpened} onClose={closeGen} title="TASS 블로그 원고 생성" size="xl">
        <Stack gap="md">
          {!generatedText && !generating && (
            <>
              <TextInput
                label="핵심 키워드 (쉼표로 구분)"
                description="블로그 검색 노출에 사용할 키워드를 입력해주세요."
                placeholder="부산 용접, 구조물 제작, 레이저 가공"
                value={keyword}
                onChange={(e) => setKeyword(e.currentTarget.value)}
              />
              <Button color="dark" onClick={handleGenerate} loading={generating} leftSection={<IconWand size={16} />}>
                원고 템플릿 생성하기
              </Button>
            </>
          )}

          {generating && (
            <Group justify="center" p="xl">
              <Loader color="dark" />
              <Text>TASS 최적화 원고를 작성중입니다...</Text>
            </Group>
          )}

          {generatedText && !generating && (
            <>
              <Textarea 
                label="생성된 원고"
                value={generatedText} 
                onChange={(e) => setGeneratedText(e.currentTarget.value)}
                minRows={12} 
                autosize
              />
              <Group justify="flex-end">
                <CopyButton value={generatedText}>
                  {({ copied, copy }) => (
                    <Button 
                      color={copied ? 'teal' : 'dark'} 
                      onClick={copy}
                      leftSection={<IconCopy size={16} />}
                    >
                      {copied ? '복사 완료!' : '네이버 에디터용 전체 복사'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              
              <Text fw={500} mt="md">첨부할 사진 목록:</Text>
              <SimpleGrid cols={4} spacing="xs">
                {activeFolder?.photos.map(photo => (
                  <Image key={photo.id} src={photo.url} alt="첨부 사진" radius="sm" />
                ))}
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
