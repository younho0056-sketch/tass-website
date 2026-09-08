"use client";

import React, { useState } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  SegmentedControl,
  Button,
  Textarea,
  Checkbox,
  Badge,
  Card,
  SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSpeakerphone,
  IconSend,
  IconVolume,
  IconVolumeOff,
  IconSparkles,
  IconRadio,
  IconCheck
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { BroadcastPayload } from '@/components/KioskBroadcastModal';

const TARGET_OPTIONS = [
  { label: '📢 전체 키오스크', value: 'all' },
  { label: '1번 (설계/공정)', value: '1' },
  { label: '2번 (절단/가공)', value: '2' },
  { label: '3번 (용접/도장)', value: '3' },
  { label: '4번 (조립/출고)', value: '4' },
];

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
  const [targetStation, setTargetStation] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  const [message, setMessage] = useState<string>('');
  const [playSound, setPlaySound] = useState<boolean>(true);
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
      const payload: BroadcastPayload = {
        targetStation,
        message: message.trim(),
        playSound,
        timestamp: Date.now(),
      };

      const broadcastChannel = supabase.channel('kiosk-broadcast');
      
      await broadcastChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'notice',
            payload,
          });

          setTimeout(() => {
            supabase.removeChannel(broadcastChannel);
          }, 1000);
        }
      });

      notifications.show({
        title: '📢 방송 전송 완료',
        message: `${targetStation === 'all' ? '전체 키오스크' : `${targetStation}번 키오스크`}로 공지가 실시간 송출되었습니다.`,
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
                현장 작업 키오스크 화면에 대형 비상/공지 팝업을 띄우고, 음성(TTS) 및 알림음으로 실시간 전달합니다.
              </Text>
            </div>
          </Group>
        </Group>

        <Paper p="xl" radius="lg" shadow="sm" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
          <Stack gap="xl">
            {/* 1. 송출 대상 선택 */}
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="md" fw={700} style={{ color: '#1e293b' }}>
                  🎯 1. 송출 대상 키오스크 선택
                </Text>
                <Badge color={targetStation === 'all' ? 'blue' : 'teal'} variant="filled" size="md">
                  {targetStation === 'all' ? '전체 키오스크 대상' : `${targetStation}번 키오스크 대상`}
                </Badge>
              </Group>

              <SegmentedControl
                value={targetStation}
                onChange={(val) => setTargetStation(val as 'all' | '1' | '2' | '3' | '4')}
                data={TARGET_OPTIONS}
                fullWidth
                color="blue"
                size="md"
                radius="md"
                styles={{
                  root: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px' },
                  label: { fontWeight: 700, padding: '10px 4px', fontSize: '14px' }
                }}
              />
            </Stack>

            {/* 2. 빠른 템플릿 버튼 */}
            <Stack gap="xs">
              <Text size="md" fw={700} style={{ color: '#1e293b' }}>
                ⚡ 2. 빠른 문구 템플릿
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
                📝 3. 방송 / 공지 문구 직접 입력
              </Text>
              <Textarea
                placeholder="현장에 실시간으로 음성(TTS) 및 팝업 안내할 내용을 입력하세요."
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

            {/* 4. 옵션 & 전송 버튼 */}
            <Stack gap="md">
              <Checkbox
                checked={playSound}
                onChange={(e) => setPlaySound(e.currentTarget.checked)}
                label={
                  <Group gap={6} align="center">
                    {playSound ? <IconVolume size={20} color="#2563eb" /> : <IconVolumeOff size={20} color="#94a3b8" />}
                    <Text size="md" fw={700} c={playSound ? 'blue.9' : 'gray.6'}>
                      소리 알림 포함 (띵동 차임벨 효과음 + 한국어 음성 읽기 TTS)
                    </Text>
                  </Group>
                }
                color="blue"
                size="md"
              />

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
                📢 현장 키오스크 공지 / 방송 실시간 송출하기
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
