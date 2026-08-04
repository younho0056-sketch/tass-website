"use client";

import { useRef } from 'react';
import { Group, Text, Button, Stack, Container, SimpleGrid, Paper, Badge } from '@mantine/core';
import { IconChevronDown, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import CompanyIntroduction from '@/components/CompanyIntroduction';
import KeyProductsSection from '@/components/KeyProductsSection';
import CustomerSupportSection from '@/components/CustomerSupportSection';
import BgmPlayer from '@/components/BgmPlayer';
import PWAInstallButton from '@/components/PWAInstallButton';

export default function LandingPage() {
  // Outer Scroll Snap Container Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Section Scroll Refs
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const aboutSectionRef = useRef<HTMLDivElement>(null);
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const supportSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      style={{
        position: 'relative',
        height: '100vh',
        width: '100%',
        overflowY: 'scroll',
        overflowX: 'hidden',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
        color: '#ffffff'
      }}
      className="scroll-snap-container"
    >
      {/* Sticky GNB Header Navigation */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(15, 23, 42, 0.80)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        {/* Left Side: Logo + BGM Player */}
        <Group gap="md" align="center">
          <Group gap="xs" style={{ cursor: 'pointer' }} onClick={() => scrollToSection(heroSectionRef)}>
            <div style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 900,
              fontSize: '16px',
              letterSpacing: '1px'
            }}>
              TASS
            </div>
            <Text fw={900} size="xl" style={{ color: 'white', letterSpacing: '2px', fontSize: '24px' }}>
              타스 (TASS)
            </Text>
          </Group>

          <BgmPlayer />
        </Group>

        {/* GNB Navigation Links: [회사소개 / 주요파트너사] -> [주요제품] -> [고객지원] */}
        <Group gap="xl" visibleFrom="sm">
          <Text 
            c="white" 
            fw={700} 
            style={{ cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.2s' }} 
            onClick={() => scrollToSection(aboutSectionRef)}
          >
            회사소개 / 주요파트너사
          </Text>
          <Text 
            c="white" 
            fw={700} 
            style={{ cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.2s' }} 
            onClick={() => scrollToSection(productsSectionRef)}
          >
            주요제품
          </Text>
          <Text 
            c="white" 
            fw={700} 
            style={{ cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.2s' }} 
            onClick={() => scrollToSection(supportSectionRef)}
          >
            고객지원
          </Text>
          
          <PWAInstallButton variant="header" />
          
          <Link href="/partners" style={{ textDecoration: 'none' }}>
            <Button color="blue.6" variant="filled" radius="xl" size="sm" rightSection={<IconArrowRight size={15} />}>
              관리자 시스템 접속
            </Button>
          </Link>
        </Group>
      </header>

      {/* SECTION 1: Hero Section (메인 비주얼) */}
      <div 
        ref={heroSectionRef}
        style={{
          position: 'relative',
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px 40px 20px',
          textAlign: 'center',
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

        {/* 2. Semi-Transparent Dark Overlay Layer (40% Opacity) */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.40)',
            zIndex: 1
          }} 
        />

        {/* 3. Foreground Content */}
        <Container size="lg" style={{ position: 'relative', zIndex: 2 }}>
          <Stack align="center" gap="md">
            <Badge 
              size="lg" 
              variant="filled" 
              color="blue.6" 
              style={{ letterSpacing: '2px', paddingLeft: '16px', paddingRight: '16px' }}
            >
              TASS INDUSTRIAL SYSTEMS & ENGINEERING
            </Badge>

            <Text 
              fw={900} 
              c="white" 
              style={{ 
                fontSize: 'min(5vw, 52px)', 
                lineHeight: 1.25,
                textShadow: '0 4px 20px rgba(0,0,0,0.9)',
                wordBreak: 'keep-all',
                marginTop: '10px'
              }}
            >
              사람을 위한, 사람이 먼저인, 사람을 향하는 기술
            </Text>
            
            <Text 
              size="lg" 
              c="gray.2" 
              fw={600} 
              style={{ 
                letterSpacing: '6px',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                marginBottom: '25px'
              }}
            >
              TECHNOLOGY ABOUT SAFETY SYSTEMS
            </Text>

            {/* Quick Access Minimal Cards */}
            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md" style={{ width: '100%', maxWidth: '1150px' }}>
              <Link href="/partners" style={{ textDecoration: 'none', display: 'block' }}>
                <Paper 
                  p="lg" 
                  radius="md" 
                  className="quick-card"
                  style={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.70)', 
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Text fw={800} size="md" c="white" ta="left">거래처 DB 관리</Text>
                    <IconArrowRight color="#ffffff" size={18} />
                  </Group>
                  <Text size="xs" c="gray.3" ta="left">협력사 / 매입처 / 매출처 DB</Text>
                </Paper>
              </Link>

              <Link href="/estimates" style={{ textDecoration: 'none', display: 'block' }}>
                <Paper 
                  p="lg" 
                  radius="md" 
                  className="quick-card"
                  style={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.70)', 
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Text fw={800} size="md" c="white" ta="left">견적서 관리</Text>
                    <IconArrowRight color="#ffffff" size={18} />
                  </Group>
                  <Text size="xs" c="gray.3" ta="left">A4 인쇄 & 엑셀 내보내기</Text>
                </Paper>
              </Link>

              <Link href="/orders" style={{ textDecoration: 'none', display: 'block' }}>
                <Paper 
                  p="lg" 
                  radius="md" 
                  className="quick-card"
                  style={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.70)', 
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Text fw={800} size="md" c="white" ta="left">수주 & 공정 관리</Text>
                    <IconArrowRight color="#ffffff" size={18} />
                  </Group>
                  <Text size="xs" c="gray.3" ta="left">진척도 & 엑셀 다운로드</Text>
                </Paper>
              </Link>

              <Link href="/support-projects" style={{ textDecoration: 'none', display: 'block' }}>
                <Paper 
                  p="lg" 
                  radius="md" 
                  className="quick-card"
                  style={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.70)', 
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Text fw={800} size="md" c="white" ta="left">나라 지원사업</Text>
                    <IconArrowRight color="#ffffff" size={18} />
                  </Group>
                  <Text size="xs" c="gray.3" ta="left">🏛️ 공고 관제 & 엑셀</Text>
                </Paper>
              </Link>

              <Link href="/blog" style={{ textDecoration: 'none', display: 'block' }}>
                <Paper 
                  p="lg" 
                  radius="md" 
                  className="quick-card"
                  style={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.70)', 
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Text fw={800} size="md" c="white" ta="left">블로그 포스팅</Text>
                    <IconArrowRight color="#ffffff" size={18} />
                  </Group>
                  <Text size="xs" c="gray.3" ta="left">AI 홍보 원고 자동 생성</Text>
                </Paper>
              </Link>
            </SimpleGrid>

            {/* Scroll Down Trigger */}
            <div 
              onClick={() => scrollToSection(aboutSectionRef)}
              style={{ 
                marginTop: '30px',
                cursor: 'pointer', 
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Text size="xs" c="gray.3" fw={600} style={{ letterSpacing: '2px', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>COMPANY OVERVIEW</Text>
              <IconChevronDown size={28} color="white" style={{ animation: 'bounce 2s infinite' }} />
            </div>
          </Stack>
        </Container>
      </div>

      {/* SECTION 2: Company Introduction & Partner Logo Section (#about) */}
      <div 
        ref={aboutSectionRef} 
        id="about"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
      >
        <CompanyIntroduction />
      </div>

      {/* SECTION 3: Key Products Showcase Section (#products) */}
      <div 
        ref={productsSectionRef} 
        id="products"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
      >
        <KeyProductsSection />
      </div>

      {/* SECTION 4: Customer Support & Contact Section (#support) */}
      <div 
        ref={supportSectionRef} 
        id="support"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}
      >
        <CustomerSupportSection />

        {/* Footer */}
        <footer style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          zIndex: 10
        }}>
          <Text size="xs" c="gray.5" fw={500}>
            © {new Date().getFullYear()} TASS Co., Ltd. All Rights Reserved. | 대한민국 부산 | TEL: 010-2621-0056
          </Text>
        </footer>
      </div>

      <style jsx global>{`
        html, body {
          overflow: hidden !important;
        }
        .scroll-snap-container {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .quick-card:hover {
          transform: translateY(-4px);
          background-color: rgba(30, 41, 59, 0.85) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-14px); }
          60% { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}
