"use client";

import { useRef } from 'react';
import { Stack, Paper, Title, Text, Badge, SimpleGrid, ThemeIcon, Group, ActionIcon } from '@mantine/core';
import { 
  IconShieldCheck, IconBuildingFactory2, IconCpu, 
  IconAnchor, IconChevronLeft, IconChevronRight 
} from '@tabler/icons-react';

export type PartnerLogoItem = {
  name: string;
  logo: string;
};

export const PARTNERS_LOGO_LIST: PartnerLogoItem[] = [
  { name: 'BNCT', logo: '/images/logos/bnct.png' },
  { name: 'BCT', logo: '/images/logos/bct.png' },
  { name: 'GCT', logo: '/images/logos/gct.png' },
  { name: 'PYNP', logo: '/images/logos/pynp.png' },
  { name: 'BPT', logo: '/images/logos/bpt.png' },
];

export default function CompanyIntroduction() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  // 4x loop array for seamless full-bleed widescreen marquee rolling (6~7 cards visible on PC)
  const marqueeItems = [
    ...PARTNERS_LOGO_LIST, 
    ...PARTNERS_LOGO_LIST, 
    ...PARTNERS_LOGO_LIST, 
    ...PARTNERS_LOGO_LIST
  ];

  return (
    <section 
      style={{
        position: 'relative',
        padding: '50px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
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

      {/* 3. Section Content Layer - Full-width Container on PC */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
        <Stack gap="lg">
          {/* Header Title */}
          <Stack gap="xs" align="center" ta="center">
            <Badge size="lg" variant="light" color="blue">ABOUT US</Badge>
            <Title order={2} style={{ color: '#ffffff', fontSize: 'min(4vw, 34px)', fontWeight: 900, textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
              Technology About Safety Systems — TASS
            </Title>
            <Text size="md" c="blue.3" fw={700} style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
              &ldquo;사람을 위한, 사람이 먼저인, 사람을 향하는 기술&rdquo;
            </Text>
          </Stack>

          {/* Main Intro Content Grid */}
          <Paper 
            p={{ base: 'md', sm: 'xl' }} 
            radius="lg" 
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.20)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <Stack gap="md">
              <Text size="sm" c="gray.2" style={{ lineHeight: 1.75, wordBreak: 'keep-all', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                <strong>주식회사 TASS</strong>는 산업 현장의 안전을 최우선으로 하는 스마트 안전 시스템 및 물류 자동화 설비 제조 전문 기업입니다. 
                첨단 엔지니어링 기술과 지속적인 연구개발을 바탕으로 사람이 안전하고 효율적으로 일할 수 있는 미래형 산업 환경을 구축하고 있습니다.
              </Text>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="xs">
                {/* Specialty Card 1 */}
                <Paper p="md" radius="md" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.18)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
                  <Group gap="sm" mb={4}>
                    <ThemeIcon color="blue" size="md" radius="md">
                      <IconShieldCheck size={18} />
                    </ThemeIcon>
                    <Text fw={800} size="sm" c="white">스마트 안전 가드레일</Text>
                  </Group>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                    충격 흡수 및 실시간 모니터링이 연동된 산업 현장용 고강도 안전 가드레일 시스템
                  </Text>
                </Paper>

                {/* Specialty Card 2 */}
                <Paper p="md" radius="md" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.18)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
                  <Group gap="sm" mb={4}>
                    <ThemeIcon color="cyan" size="md" radius="md">
                      <IconBuildingFactory2 size={18} />
                    </ThemeIcon>
                    <Text fw={800} size="sm" c="white">컨테이너 스프레더 솔루션</Text>
                  </Group>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                    항만 및 물류 터미널 하역 효율을 극대화하는 맞춤형 컨테이너 스프레더 설계 및 제어
                  </Text>
                </Paper>

                {/* Specialty Card 3 */}
                <Paper p="md" radius="md" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.18)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
                  <Group gap="sm" mb={4}>
                    <ThemeIcon color="teal" size="md" radius="md">
                      <IconCpu size={18} />
                    </ThemeIcon>
                    <Text fw={800} size="sm" c="white">ESS & 친환경 인프라</Text>
                  </Group>
                  <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>
                    에너지 저장 장치(ESS) 기술 및 탄소 중립을 지향하는 지속 가능한 스마트 그린 인프라 구축
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* Full-width Widescreen Partner Logo Carousel Section */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <Group justify="space-between" align="center" mb="sm">
                  <Group gap="xs">
                    <ThemeIcon color="blue.5" variant="light" size="sm" radius="xl">
                      <IconAnchor size={16} />
                    </ThemeIcon>
                    <Text fw={800} size="sm" c="white" style={{ letterSpacing: '-0.3px', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                      주요 파트너사 / 협력 기관 (주요 항만 터미널 및 물류 거점)
                    </Text>
                  </Group>
                  <Group gap={6}>
                    <ActionIcon 
                      variant="outline" 
                      color="gray.4" 
                      size="sm" 
                      radius="xl" 
                      onClick={handleScrollLeft}
                      style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                    >
                      <IconChevronLeft size={14} />
                    </ActionIcon>
                    <ActionIcon 
                      variant="outline" 
                      color="gray.4" 
                      size="sm" 
                      radius="xl" 
                      onClick={handleScrollRight}
                      style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                    >
                      <IconChevronRight size={14} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Marquee Track Container - Wide Screen Expansion */}
                <div 
                  ref={scrollContainerRef}
                  style={{
                    position: 'relative',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    padding: '10px 0',
                    width: '100%'
                  }}
                >
                  <div className="marquee-track-slow">
                    {marqueeItems.map((item, index) => (
                      <div
                        key={index}
                        className="partner-bright-card"
                        style={{
                          flex: '0 0 230px',
                          height: '80px',
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 24px',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {/* Transparent PNG Logo Only */}
                        <img 
                          src={item.logo} 
                          alt={item.name}
                          style={{
                            maxHeight: '52px',
                            maxWidth: '100%',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Stack>
          </Paper>
        </Stack>
      </div>

      <style jsx global>{`
        .partner-bright-card:hover {
          transform: translateY(-5px) scale(1.03);
          background-color: #ffffff !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.4) !important;
        }
        @keyframes marqueeRollSlow {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-25%); }
        }
        .marquee-track-slow {
          display: flex;
          width: max-content;
          gap: 20px;
          align-items: center;
          animation: marqueeRollSlow 35s linear infinite;
        }
        .marquee-track-slow:hover {
          animation-play-state: paused;
        }
        @media (min-width: 1024px) {
          .partner-bright-card {
            flex: 0 0 240px !important;
            height: 84px !important;
          }
        }
      `}</style>
    </section>
  );
}
