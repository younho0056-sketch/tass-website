"use client";

import { AppShell, Burger, Group, NavLink, Title, Text, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUsers, IconFileDescription, IconPrinter, IconListCheck, IconFileSpreadsheet } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BgmPlayer from '@/components/BgmPlayer';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();

  const handleNavClick = () => {
    if (opened) toggle();
  };

  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
      style={{ backgroundColor: 'transparent' }}
    >
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

          <Text size="xs" style={{ color: '#94a3b8', fontWeight: 500 }} visibleFrom="sm">
            Technology About Safety Systems
          </Text>
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
          href="/labels"
          label="송장 출력"
          leftSection={<IconPrinter size="1.1rem" stroke={1.5} />}
          active={pathname === '/labels'}
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
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
