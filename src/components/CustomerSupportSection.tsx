"use client";

import { useState } from 'react';
import { 
  Container, Stack, Paper, Title, Text, Badge, SimpleGrid, 
  Group, ThemeIcon, TextInput, Textarea, Select, Button, Notification 
} from '@mantine/core';
import { 
  IconHeadset, IconPhone, IconMapPin, IconMail, IconClock, 
  IconSend, IconCheck 
} from '@tabler/icons-react';

export default function CustomerSupportSection() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<string | null>('제품 견적 문의');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !content.trim()) return;

    // Build mailto link for direct transmission to representative email
    const recipient = 'younho0055@naver.com';
    const subject = encodeURIComponent(`[TASS 홈페이지 문의] ${type || '일반 문의'} - ${name}`);
    const body = encodeURIComponent(
      `■ 성함 / 회사명: ${name}\n` +
      `■ 연락처: ${phone}\n` +
      `■ 문의 유형: ${type || '기타'}\n` +
      `■ 문의 일시: ${new Date().toLocaleString('ko-KR')}\n\n` +
      `[상세 문의 내용]\n${content}`
    );

    // Trigger mail client link
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    
    setSubmitted(true);
    setName('');
    setPhone('');
    setContent('');
    setTimeout(() => setSubmitted(false), 6000);
  };

  return (
    <section 
      style={{
        position: 'relative',
        padding: '50px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
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
        <Stack gap="lg">
          {/* Header Title */}
          <Stack gap="xs" align="center" ta="center">
            <Badge size="lg" variant="filled" color="blue.6">CUSTOMER SUPPORT</Badge>
            <Title order={2} style={{ color: '#ffffff', fontSize: 'min(4vw, 32px)', fontWeight: 900, textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>
              고객지원 및 제품 문의 (Contact & Support)
            </Title>
            <Text size="md" c="gray.3" fw={500} style={{ textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
              TASS의 스마트 안전 시스템 및 산업용 설비에 대해 무엇이든 문의해 주세요.
            </Text>
          </Stack>

          {/* Success Notification */}
          {submitted && (
            <Notification icon={<IconCheck size={18} />} color="teal" title="문의 접수 및 메일 연결 완료" onClose={() => setSubmitted(false)}>
              작성하신 문의 내용이 대표님 이메일(younho0055@naver.com)로 연결되었습니다. 빠른 시간 내 답변 드리겠습니다.
            </Notification>
          )}

          {/* Content Grid: Contact Info + Inquiry Form */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Contact Info Cards */}
            <Stack gap="sm">
              <Paper p="md" radius="lg" style={{ backgroundColor: 'rgba(15, 23, 42, 0.70)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <Group gap="md">
                  <ThemeIcon color="blue" size="lg" radius="md">
                    <IconMapPin size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} c="white" size="sm">본사 위치</Text>
                    <Text c="gray.3" size="xs">대한민국 부산광역시 (산업 현장 스마트 인프라 거점)</Text>
                  </div>
                </Group>
              </Paper>

              <Paper p="md" radius="lg" style={{ backgroundColor: 'rgba(15, 23, 42, 0.70)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <Group gap="md">
                  <ThemeIcon color="cyan" size="lg" radius="md">
                    <IconPhone size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} c="white" size="sm">대표 연락처</Text>
                    <Text c="gray.3" size="xs">TEL: 010-2621-0056 (실시간 1:1 담당자 상담 가능)</Text>
                  </div>
                </Group>
              </Paper>

              <Paper p="md" radius="lg" style={{ backgroundColor: 'rgba(15, 23, 42, 0.70)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <Group gap="md">
                  <ThemeIcon color="teal" size="lg" radius="md">
                    <IconMail size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} c="white" size="sm">이메일 문의</Text>
                    <Text 
                      component="a" 
                      href="mailto:younho0055@naver.com" 
                      c="blue.3" 
                      size="xs" 
                      fw={600}
                      style={{ textDecoration: 'none' }}
                    >
                      younho0055@naver.com
                    </Text>
                  </div>
                </Group>
              </Paper>

              <Paper p="md" radius="lg" style={{ backgroundColor: 'rgba(15, 23, 42, 0.70)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                <Group gap="md">
                  <ThemeIcon color="indigo" size="lg" radius="md">
                    <IconClock size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} c="white" size="sm">운영 시간</Text>
                    <Text c="gray.3" size="xs">평일 09:00 ~ 18:00 (토/일/공휴일 휴무)</Text>
                  </div>
                </Group>
              </Paper>
            </Stack>

            {/* Quick Inquiry Form */}
            <Paper p="lg" radius="lg" style={{ backgroundColor: 'rgba(30, 41, 59, 0.80)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 15px 35px rgba(0,0,0,0.3)' }}>
              <form onSubmit={handleSubmit}>
                <Stack gap="xs">
                  <Group gap="xs" mb={2}>
                    <ThemeIcon color="blue" size="sm" radius="md"><IconHeadset size={16} /></ThemeIcon>
                    <Text fw={800} size="md" c="white">온라인 간편 문의 접수</Text>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                    <TextInput 
                      label="성함 / 회사명" 
                      placeholder="홍길동 (주식회사 OOO)" 
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                    />
                    <TextInput 
                      label="연락처" 
                      placeholder="010-0000-0000" 
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                    />
                  </SimpleGrid>

                  <Select 
                    label="문의 유형" 
                    data={['제품 견적 문의', '기술 지원/스펙 문의', '파트너십/제휴 문의', '기타 문의']}
                    value={type}
                    onChange={setType}
                    styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                  />

                  <Textarea 
                    label="문의 내용" 
                    placeholder="필요하신 사양 및 문의 사항을 상세히 남겨주세요."
                    rows={3}
                    required
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    styles={{ input: { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' } }}
                  />

                  <Button type="submit" color="blue" size="sm" fullWidth rightSection={<IconSend size={16} />} mt={4}>
                    문의하기 제출 (younho0055@naver.com 전송)
                  </Button>
                </Stack>
              </form>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Container>
    </section>
  );
}
