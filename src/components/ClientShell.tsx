"use client";

import { useEffect } from 'react';
import { AppShell, Burger, Group, NavLink, Title, Text, Box, Badge, Button, Paper, Stack, Center } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUsers, IconFileDescription, IconPrinter, IconListCheck, IconFileSpreadsheet, IconBuildingBank, IconLock, IconLogout, IconKey, IconTools, IconCalendar } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BgmPlayer from '@/components/BgmPlayer';
import PWAInstallButton from '@/components/PWAInstallButton';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/context/AuthContext';

import SystemMonitorWidget from '@/components/SystemMonitorWidget';
import TassAiAssistant from '@/components/TassAiAssistant';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const { isAuthenticated, role, logout, openAuthModal } = useAuth();

  const handleNavClick = () => {
    if (opened) toggle();
  };

  useEffect(() => {
    if (pathname !== '/' && !isAuthenticated) {
      openAuthModal(pathname);
    }
  }, [pathname, isAuthenticated, openAuthModal]);

  // Background prefetching for 0.1s instant menu switching
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefetchRoutes = ['/api/orders', '/api/folders', '/api/partners', '/api/estimates', '/api/schedules'];
      prefetchRoutes.forEach(url => {
        fetch(url).catch(() => {});
      });
    }
  }, []);

  if (pathname === '/') {
    return (
      <>
        {children}
        <AuthModal />
      </>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
      style={{ backgroundColor: 'transparent' }}
    >
      <AuthModal />

      <AppShell.Header 
        style={{ 
          backgroundColor: '#0f172a', 
          borderBottom: '1px solid #1e293b', 
          borderRadius: 0 
        }}
      >
        <Group h="100%" px={{ base: 'xs', sm: 'md' }} justify="space-between" wrap="nowrap">
          <Group gap="xs" align="center" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="#ffffff" />
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Group gap="xs" style={{ cursor: 'pointer' }} wrap="nowrap">
                <div style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '1px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  TASS
                </div>
                <Title order={3} visibleFrom="sm" style={{ color: '#ffffff', fontWeight: 800, fontSize: '18px', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                  TASS 관리자 시스템
                </Title>
              </Group>
            </Link>

            <Group gap="md" align="center" visibleFrom="sm">
              <BgmPlayer />
              <Text
                component="a"
                href="https://miro.com/welcomeonboard/SGlTYUl4SGNxU3FYODN1cmNhcUhObEcwdlVKeVA2OVU2R1U0dmtETHRVbUlNWHlndStSLzBGamRmQ2tPS0dpSVJVNi9tT0V2TjlSTEFtdTB3UVh2NnRXNUFiYmIwTUNzZlNmbkd2UVYzb0ZJSU5TTXJmL0Q1a2xQYjRtRVQ3Y3N0R2lncW1vRmFBVnlLcVJzTmdFdlNRPT0hdjE=?share_link_id=662419925150"
                target="_blank"
                rel="noopener noreferrer"
                c="white"
                fw={700}
                size="sm"
                style={{ textDecoration: 'none', cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.2s', display: 'inline-flex', alignItems: 'center' }}
              >
                미로
              </Text>
              <Text
                component="a"
                href="http://tass-korea.com/page_home02"
                target="_blank"
                rel="noopener noreferrer"
                c="white"
                fw={700}
                size="sm"
                style={{ textDecoration: 'none', cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.2s', display: 'inline-flex', alignItems: 'center' }}
              >
                타스홈페이지
              </Text>
            </Group>
          </Group>

          <Group gap="xs" align="center" wrap="nowrap">
            <PWAInstallButton />
            
            {/* 권한 상태 표시 배지 */}
            {isAuthenticated ? (
              <Group gap={4} align="center" wrap="nowrap">
                {role === 'admin' ? (
                  <>
                    <Badge visibleFrom="sm" color="blue" size="md" variant="filled" radius="md" style={{ borderRadius: '6px' }}>
                      🔑 관리자 (수정권한)
                    </Badge>
                    <Badge hiddenFrom="sm" color="blue" size="xs" variant="filled" radius="md" style={{ borderRadius: '6px', paddingLeft: '4px', paddingRight: '4px' }}>
                      🔑 관리자
                    </Badge>
                  </>
                ) : (
                  <>
                    <Badge visibleFrom="sm" color="teal" size="md" variant="filled" radius="md" style={{ borderRadius: '6px' }}>
                      👁️ 직원 (조회/출력)
                    </Badge>
                    <Badge hiddenFrom="sm" color="teal" size="xs" variant="filled" radius="md" style={{ borderRadius: '6px', paddingLeft: '4px', paddingRight: '4px' }}>
                      👁️ 직원
                    </Badge>
                  </>
                )}
                <Button 
                  size="xs" 
                  variant="subtle" 
                  color="gray.4" 
                  radius="md"
                  onClick={logout}
                  leftSection={<IconLogout size={14} />}
                  px={{ base: 6, sm: 'xs' }}
                  style={{ borderRadius: '6px' }}
                >
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
              </Group>
            ) : (
              <Button 
                size="xs" 
                color="blue" 
                radius="md"
                onClick={() => openAuthModal(pathname)}
                leftSection={<IconLock size={14} />}
                px={{ base: 6, sm: 'xs' }}
                style={{ borderRadius: '6px' }}
              >
                <span className="hidden sm:inline">비밀번호 입력</span>
                <span className="inline sm:hidden">인증</span>
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', borderRadius: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
            MAIN MENU
          </Text>

          <NavLink
            component={Link}
            href="/calendar"
            label="📅 일정 관리"
            leftSection={<IconCalendar size="1.1rem" stroke={1.5} />}
            active={pathname === '/calendar' || pathname === '/schedules'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/partners"
            label="거래처 DB"
            leftSection={<IconUsers size="1.1rem" stroke={1.5} />}
            active={pathname === '/partners'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/estimates"
            label="견적 관리"
            leftSection={<IconFileSpreadsheet size="1.1rem" stroke={1.5} />}
            active={pathname === '/estimates'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/orders"
            label="공정 관리"
            leftSection={<IconListCheck size="1.1rem" stroke={1.5} />}
            active={pathname === '/orders'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/support-projects"
            label="나라 지원사업 공고"
            leftSection={<IconBuildingBank size="1.1rem" stroke={1.5} />}
            active={pathname === '/support-projects'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/labels"
            label="송장 출력"
            leftSection={<IconPrinter size="1.1rem" stroke={1.5} />}
            active={pathname === '/labels'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/equipment"
            label="장비/설비 관리"
            leftSection={<IconTools size="1.1rem" stroke={1.5} />}
            active={pathname === '/equipment'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px', marginBottom: '4px' }}
          />
          <NavLink
            component={Link}
            href="/blog"
            label="블로그 포스팅 관리"
            leftSection={<IconFileDescription size="1.1rem" stroke={1.5} />}
            active={pathname === '/blog'}
            onClick={handleNavClick}
            style={{ borderRadius: '8px' }}
          />
        </Box>

        {/* Real-time TASS AI Data Assistant & System Monitor Widgets */}
        <Stack gap="xs" mt="auto">
          <TassAiAssistant />
          <SystemMonitorWidget />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box p={{ base: 'xs', sm: 'md' }} style={{ minHeight: 'calc(100vh - 80px)', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
          {isAuthenticated ? (
            children
          ) : (
            <Center style={{ minHeight: 'calc(100vh - 120px)' }}>
              <Paper p="xl" radius="lg" shadow="md" style={{ maxWidth: 420, border: '1px solid #e2e8f0' }}>
                <Stack align="center" gap="md">
                  <div style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb'
                  }}>
                    <IconLock size={32} />
                  </div>
                  <Title order={3}>시스템 접근 제한</Title>
                  <Text size="sm" c="dimmed" ta="center">
                    보안 정책에 따라 TASS 시스템 진입을 위해 비밀번호(PIN) 인증이 필요합니다.
                  </Text>
                  <Button size="md" color="blue" fullWidth onClick={() => openAuthModal(pathname)}>
                    비밀번호 입력하여 접속
                  </Button>
                </Stack>
              </Paper>
            </Center>
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
