"use client";

import { useState, useRef } from 'react';
import { 
  Container, Stack, Paper, Title, Text, Badge, Group, ActionIcon, 
  Modal, Button, TextInput, Textarea, Select, SimpleGrid, ThemeIcon 
} from '@mantine/core';
import { 
  IconChevronLeft, IconChevronRight, IconPlus, IconTrash, 
  IconZoomIn, IconSettings, IconCheck, IconUpload, IconX, IconPhoto 
} from '@tabler/icons-react';

export type ProductItem = {
  id: string;
  name: string;
  category: string;
  desc: string;
  imageUrl: string;
};

// 5 High quality industrial sample products
const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: '스마트 고강도 안전 가드레일',
    category: '안전 가드레일',
    desc: '충격 흡수 댐퍼 및 실시간 휨 감지 IoT 센서가 내장된 산업 현장용 고강도 가드레일',
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'prod-2',
    name: '20/40ft 컨테이너 자동 스프레더',
    category: '스프레더 솔루션',
    desc: '항만 크레인 하역 작업 시 컨테이너 유격 자동 조절 및 유압 락킹 시스템',
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'prod-3',
    name: '산업용 ESS 에너지 저장 인프라',
    category: 'ESS & 친환경',
    desc: '탄소 중립 실현을 위한 대용량 배터리 열관리 및 스마트 BMS 연동 ESS 컨테이너',
    imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'prod-4',
    name: '항만 물류 무인 이송 AGV',
    category: '물류 자동화',
    desc: '터미널 내 컨테이너 고속 이송을 위한 라이다(LiDAR) 기반 자율주행 AGV',
    imageUrl: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'prod-5',
    name: '스마트 현장 통합 안전 모니터링 허브',
    category: '안전 센서 팩',
    desc: '위험 지역 무단 침입 감지 및 가스/열화상 카메라 연동 지능형 컨트롤러',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop'
  }
];

export default function KeyProductsSection() {
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // New Product Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string | null>('안전 가드레일');
  const [newDesc, setNewDesc] = useState('');
  
  // File Upload & Preview State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Use uploaded preview base64 data URL or default image fallback
    const finalImageUrl = previewUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=800&auto=format&fit=crop';

    const newProd: ProductItem = {
      id: `prod-${Date.now()}`,
      name: newName.trim(),
      category: newCategory || '기타',
      desc: newDesc.trim() || 'TASS 정품 스마트 산업 설비',
      imageUrl: finalImageUrl
    };

    setProducts(prev => [newProd, ...prev]);
    setNewName('');
    setNewDesc('');
    setFile(null);
    setPreviewUrl('');
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Duplicate items array for smooth continuous carousel display
  const sliderItems = products.length > 0 ? [...products, ...products] : [];

  return (
    <section 
      style={{
        position: 'relative',
        padding: '50px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* 1. Background Video Layer */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0
        }}
      >
        <source src="/videos/background.mp4" type="video/mp4" />
        <source src="https://cdn.pixabay.com/video/2019/04/23/23011-332483109_large.mp4" type="video/mp4" />
      </video>

      {/* 2. Semi-Transparent Dark Overlay (40% Opacity) */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.40)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1
        }}
      />

      {/* 3. Section Content Layer */}
      <Container size="lg" style={{ position: 'relative', zIndex: 2 }}>
        <Stack gap="xl">
          {/* Header Title Bar */}
          <Group justify="space-between" align="flex-end">
            <Stack gap="xs">
              <Badge size="lg" variant="filled" color="blue.6">PRODUCTS SHOWCASE</Badge>
              <Title order={2} style={{ color: '#ffffff', fontSize: 'min(4vw, 32px)', fontWeight: 900, textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
                TASS 주요 제품 및 스마트 설비 (Key Products)
              </Title>
              <Text size="sm" c="gray.3" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
                산업 현장의 안전과 하역 효율을 이끄는 TASS의 대표 라인업입니다. (사진 클릭 시 확대보기 가능)
              </Text>
            </Stack>

            <Group gap="xs">
              <Button 
                variant="light" 
                color="blue" 
                size="sm" 
                leftSection={<IconSettings size={16} />}
                onClick={() => setIsManageModalOpen(true)}
                radius="md"
              >
                제품 관리 (추가/삭제)
              </Button>

              <ActionIcon 
                variant="outline" 
                color="gray.4" 
                size="lg" 
                radius="xl" 
                onClick={handleScrollLeft}
                style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
              <ActionIcon 
                variant="outline" 
                color="gray.4" 
                size="lg" 
                radius="xl" 
                onClick={handleScrollRight}
                style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>
          </Group>

          {/* Product Slider Carousel */}
          <div 
            ref={scrollContainerRef}
            style={{
              position: 'relative',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '12px 0'
            }}
          >
            <div className="product-marquee-track">
              {sliderItems.map((item, index) => (
                <Paper
                  key={`${item.id}-${index}`}
                  radius="lg"
                  style={{
                    flex: '0 0 280px',
                    backgroundColor: 'rgba(30, 41, 59, 0.85)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  className="product-card-item"
                  onClick={() => setSelectedProduct(item)}
                >
                  {/* Image Container with Zoom Badge Overlay */}
                  <div style={{ position: 'relative', height: '180px', overflow: 'hidden', backgroundColor: '#0f172a' }}>
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.5s ease'
                      }}
                      className="product-card-img"
                    />
                    <div 
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(8px)',
                        padding: '6px',
                        borderRadius: '50%',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <IconZoomIn size={16} />
                    </div>
                    <Badge 
                      size="xs" 
                      variant="filled" 
                      color="blue.6" 
                      style={{ position: 'absolute', bottom: '12px', left: '12px' }}
                    >
                      {item.category}
                    </Badge>
                  </div>

                  {/* Card Content */}
                  <Stack gap="xs" p="md">
                    <Text fw={800} size="md" c="white" lineClamp={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" c="gray.3" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.desc}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </div>
          </div>
        </Stack>
      </Container>

      {/* 1. Image Zoom Lightbox Modal */}
      <Modal
        opened={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct ? selectedProduct.name : ''}
        size="lg"
        centered
        withinPortal={true}
        zIndex={300}
        styles={{
          header: { backgroundColor: '#0f172a', color: '#ffffff' },
          body: { backgroundColor: '#0f172a', color: '#ffffff', padding: '24px' },
          content: { border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', overflow: 'hidden' }
        }}
      >
        {selectedProduct && (
          <Stack gap="md">
            <div style={{ width: '100%', maxHeight: '420px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000000' }}>
              <img 
                src={selectedProduct.imageUrl} 
                alt={selectedProduct.name}
                style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }}
              />
            </div>
            <Group justify="space-between" align="center">
              <Badge size="md" color="blue" variant="filled">{selectedProduct.category}</Badge>
              <Text size="xs" c="gray.4">TASS Official Product Lineup</Text>
            </Group>
            <Text size="sm" c="gray.2" style={{ lineHeight: 1.7, fontSize: '1rem' }}>
              {selectedProduct.desc}
            </Text>
          </Stack>
        )}
      </Modal>

      {/* 2. Admin Product Management Modal */}
      <Modal
        opened={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title="TASS 주요 제품 관리 (등록 / 삭제)"
        size="lg"
        centered
        withinPortal={true}
        zIndex={300}
        styles={{
          header: { backgroundColor: '#1e293b', color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' },
          body: { backgroundColor: '#1e293b', color: '#ffffff', padding: '24px' },
          content: { border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px' }
        }}
      >
        <Stack gap="xl">
          {/* Add New Product Form */}
          <Paper p="md" radius="md" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <form onSubmit={handleAddProduct}>
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIcon color="blue" size="sm" radius="xl"><IconPlus size={14} /></ThemeIcon>
                  <Text fw={700} size="sm" c="white">신규 제품 등록</Text>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput 
                    label="제품명" 
                    placeholder="예: 스마트 가드레일 v2" 
                    required 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                  />
                  <Select 
                    label="카테고리" 
                    data={['안전 가드레일', '스프레더 솔루션', 'ESS & 친환경', '물류 자동화', '안전 센서 팩', '기타']} 
                    value={newCategory} 
                    onChange={setNewCategory}
                    styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                  />
                </SimpleGrid>

                {/* File Upload Selector (컴퓨터에서 사진 선택) */}
                <div>
                  <Text size="xs" fw={600} c="gray.3" mb={6}>
                    제품 사진 첨부 (내 컴퓨터에서 파일 선택)
                  </Text>
                  
                  {/* Hidden File Input */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />

                  {/* Dropzone Style Picker Box */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(59, 130, 246, 0.5)',
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      transition: 'all 0.25s ease'
                    }}
                    className="file-dropzone-box"
                  >
                    <Group justify="center" gap="xs" mb={4}>
                      <IconUpload size={24} color="#60a5fa" />
                      <IconPhoto size={24} color="#38bdf8" />
                    </Group>
                    <Text size="sm" fw={700} c="white">
                      {file ? file.name : '클릭하여 내 컴퓨터에서 이미지 파일 선택 (PNG, JPG, WEBP)'}
                    </Text>
                    <Text size="xs" c="gray.4" mt={2}>
                      {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '또는 파일 드래그 앤 드롭'}
                    </Text>
                  </div>

                  {/* Instant Image Preview Box */}
                  {previewUrl && (
                    <div style={{ marginTop: '12px' }}>
                      <Group justify="space-between" align="center" mb={6}>
                        <Text size="xs" c="blue.3" fw={700}>선택한 사진 미리보기 (Image Preview)</Text>
                        <Button 
                          size="xs" 
                          variant="subtle" 
                          color="red" 
                          leftSection={<IconX size={12} />}
                          onClick={() => { setFile(null); setPreviewUrl(''); }}
                        >
                          사진 취소
                        </Button>
                      </Group>
                      <div 
                        style={{ 
                          position: 'relative', 
                          width: '100%', 
                          height: '160px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: '1px solid rgba(59, 130, 246, 0.4)', 
                          backgroundColor: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <img 
                          src={previewUrl} 
                          alt="업로드 미리보기" 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Textarea 
                  label="제품 상세 설명" 
                  placeholder="제품 사양 및 특징을 입력하세요" 
                  rows={2} 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)}
                  styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                />

                <Button type="submit" color="blue" fullWidth leftSection={<IconCheck size={16} />}>
                  신규 제품 추가하기
                </Button>
              </Stack>
            </form>
          </Paper>

          {/* Currently Registered Products List */}
          <Stack gap="xs">
            <Text fw={700} size="sm" c="white">등록된 제품 목록 ({products.length}개)</Text>
            {products.map(prod => (
              <Group key={prod.id} justify="space-between" align="center" p="xs" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Group gap="sm">
                  <img src={prod.imageUrl} alt={prod.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div>
                    <Text fw={700} size="xs" c="white">{prod.name}</Text>
                    <Text size="xs" c="gray.4">{prod.category}</Text>
                  </div>
                </Group>
                <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteProduct(prod.id)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Modal>

      <style jsx global>{`
        .file-dropzone-box:hover {
          border-color: #3b82f6 !important;
          background-color: rgba(30, 41, 59, 0.8) !important;
        }
        .product-card-item:hover {
          transform: translateY(-6px) scale(1.02);
          border-color: rgba(59, 130, 246, 0.6) !important;
          box-shadow: 0 16px 36px rgba(37, 99, 235, 0.3) !important;
        }
        .product-card-item:hover .product-card-img {
          transform: scale(1.08);
        }
        @keyframes productMarqueeRoll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .product-marquee-track {
          display: flex;
          width: max-content;
          gap: 20px;
          animation: productMarqueeRoll 40s linear infinite;
        }
        .product-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
