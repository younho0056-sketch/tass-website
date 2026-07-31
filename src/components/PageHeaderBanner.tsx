"use client";

import { Paper, Title, Text, Group } from '@mantine/core';
import { ReactNode } from 'react';

type PageHeaderBannerProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export default function PageHeaderBanner({ 
  title, 
  subtitle = 'TASS Technology About Safety Systems - 통합 관리 시스템', 
  children 
}: PageHeaderBannerProps) {
  return (
    <Paper 
      p={{ base: 'md', sm: 'xl' }} 
      radius="lg" 
      className="page-header-banner print:hidden print-hidden no-print"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.78), rgba(10, 25, 47, 0.78)), url('https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=2000&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '160px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        color: '#ffffff',
        boxShadow: '0 8px 30px rgba(10, 25, 47, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        marginBottom: '24px',
      }}
    >
      <div style={{ flex: '1 1 260px' }}>
        <Title order={1} style={{ color: '#ffffff', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.5px' }}>
          {title}
        </Title>
        <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.85)', marginTop: '4px', fontWeight: 500 }}>
          {subtitle}
        </Text>
      </div>
      {children && (
        <Group gap="sm" wrap="wrap" style={{ flex: '0 1 auto' }}>
          {children}
        </Group>
      )}
    </Paper>
  );
}
