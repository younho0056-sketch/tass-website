"use client";

import React, { useState } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Textarea,
  Badge,
  Card,
  SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSpeakerphone,
  IconSend,
  IconSparkles,
  IconCheck,
  IconBuildingFactory2
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

const QUICK_TEMPLATES = [
  {
    label: '🍱 점심시간 안내',
    text: '즐거운 점심시간입니다. 안전하게 작업 마무리 후 식사하세요.',
    badgeColor: 'orange'
  },
  {
    label: '🧹 작업 종료/청소',
    text: '금일 작업 종료 시간입니다. 현장 정리정돈 부탁드립니다.',
    badgeColor: 'blue'
  },
  {
    label: '🏢 사무실 호출',
    text: 'OOO 반장님, 사무실로 잠시 올라와 주세요.',
    badgeColor: 'violet'
  }
];

export default function BroadcastPage() {
  const [message, setMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleTemplateClick = (templateText: string) => {
    setMessage(templateText);
  };

  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      notifications.show({
        title: '입력 오류',
        message: '전송할 방송/공지 문구를 입력해 주세요.',
        color: 'red',
      });
      return;
    }

    setIsSending(true);

    try {
      const channel = supabase.channel('kiosk-global-broadcast');
      
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'global-notice',
            payload: {
              message: message.trim(),
              timestamp: Date.now(),
            },
          });

          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 1000);
        }
      });

      notifications.show({
        title: '📢 전체 현장 방송 전송 완료',
        message: '모든 현장 키오스크 화면으로 공지가 실시간 송출되었습니다.',
        color: 'teal',
        icon: <IconSpeakerphone size={18} />,
      });

      setMessage('');
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      notifications.show({
        title: '전송 실패',
        message: '방송 신호 전송 중 오류가 발생했습니다.',
        color: 'red',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <div style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IconSpeakerphone size={28} />
            </div>
            <div>
              <Title order={2} style={{ color: '#0f172a', fontWeight: 800 }}>
                현장 방송 / 공지 송출 제어판
              </Title>
              <Text size="sm" c="dimmed">
                접속 중인 모든 현장 키오스크 화면에 대형 공지 팝업과 차임벨 효과음 + 음성(TTS)을 실시간으로 전달합니다.
              </Text>
            </div>
          </Group>
        </Group>

        <Paper p="xl" radius="lg" shadow="sm" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
          <Stack gap="xl">
            {/* 1. 송출 대상 고정 표기 */}
            <Paper p="md" radius="md" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconBuildingFactory2 size={22} color="#2563eb" />
                  <Text size="md" fw={800} c="blue.9">
                    송출 대상: 전체 현장 키오스크 (모든 화면 동시 방송)
                  </Text>
                </Group>
                <Badge color="blue" variant="filled" size="md">
                  전체 동시 송출
                </Badge>
              </Group>
            </Paper>

            {/* 2. 빠른 템플릿 버튼 */}
            <Stack gap="xs">
              <Text size="md" fw={700} style={{ color: '#1e293b' }}>
                ⚡ 빠른 문구 템플릿
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                {QUICK_TEMPLATES.map((tmpl, idx) => (
                  <Card
                    key={idx}
                    padding="sm"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderColor: message === tmpl.text ? '#2563eb' : '#e2e8f0',
                      backgroundColor: message === tmpl.text ? '#eff6ff' : '#f8fafc'
                    }}
                    onClick={() => handleTemplateClick(tmpl.text)}
                  >
                    <Group justify="space-between" mb={4}>
                      <Badge color={tmpl.badgeColor} variant="light" size="sm">
                        {tmpl.label}
                      </Badge>
                      {message === tmpl.text && <IconCheck size={16} color="#2563eb" />}
                    </Group>
                    <Text size="xs" c="gray.7" style={{ lineHeight: 1.4 }}>
                      "{tmpl.text}"
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>

            {/* 3. 방송/공지 문구 입력 */}
            <Stack gap="xs">
              <Text size="md" fw={700} style={{ color: '#1e293b' }}>
                📝 방송 / 공지 문구 직접 입력
              </Text>
              <Textarea
                placeholder="현장에 실시간으로 음성(TTS) 및 대형 팝업 안내할 내용을 입력하세요."
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
                minRows={5}
                maxRows={10}
                autosize
                styles={{
                  input: {
                    fontSize: '16px',
                    fontWeight: 600,
                    lineHeight: '1.6',
                    padding: '14px',
                    borderRadius: '10px'
                  }
                }}
              />
            </Stack>

            {/* 4. 전송 버튼 */}
            <Button
              size="xl"
              color="blue"
              fullWidth
              radius="md"
              onClick={handleSendBroadcast}
              loading={isSending}
              disabled={!message.trim()}
              leftSection={<IconSend size={24} />}
              style={{
                height: '60px',
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '0.5px',
                boxShadow: message.trim() ? '0 6px 18px rgba(37, 99, 235, 0.4)' : undefined
              }}
            >
              📢 전체 현장 키오스크 공지 / 방송 실시간 송출하기
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
