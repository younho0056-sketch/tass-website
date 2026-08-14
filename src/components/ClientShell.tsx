"use client";

import { useEffect } from 'react';
import { AppShell, Burger, Group, NavLink, Title, Text, Box, Badge, Button, Paper, Stack, Center } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUsers, IconFileDescription, IconPrinter, IconListCheck, IconFileSpreadsheet, IconBuildingBank, IconLock, IconLogout, IconKey, IconTools } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BgmPlayer from '@/components/BgmPlayer';
import PWAInstallButton from '@/components/PWAInstallButton';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/context/AuthContext';

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
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md" align="center">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="#ffffff" />
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Group gap="xs" style={{ cursor: 'pointer' }}>
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
                <Title order={3} style={{ color: '#ffffff', fontWeight: 800, fontSize: '18px', letterSpacing: '0.3px' }}>
                  TASS 관리자 시스템
                </Title>
              </Group>
            </Link>

            <BgmPlayer />
          </Group>

          <Group gap="sm" align="center">
            <PWAInstallButton />
            
            {/* 권한 상태 표시 배지 */}
            {isAuthenticated ? (
              <Group gap="xs" align="center">
                {role === 'admin' ? (
                  <Badge color="blue" size="md" variant="filled" radius="md" leftSection={<IconKey size={12} />} style={{ borderRadius: '6px' }}>
                    🔑 관리자 (수정권한)
                  </Badge>
                ) : (
                  <Badge color="teal" size="md" variant="filled" radius="md" style={{ borderRadius: '6px' }}>
                    👁️ 직원 (조회/출력)
                  </Badge>
                )}
                <Button 
                  size="xs" 
                  variant="subtle" 
                  color="gray.4" 
                  radius="md"
                  onClick={logout}
                  leftSection={<IconLogout size={14} />}
                  style={{ borderRadius: '6px' }}
                >
                  로그아웃
                </Button>
              </Group>
            ) : (
              <Button 
                size="xs" 
                color="blue" 
                radius="md"
                onClick={() => openAuthModal(pathname)}
                leftSection={<IconLock size={14} />}
                style={{ borderRadius: '6px' }}
              >
                비밀번호 입력
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', borderRadius: 0 }}>
        <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
          MAIN MENU
        </Text>

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
