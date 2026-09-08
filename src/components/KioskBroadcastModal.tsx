"use client";

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Textarea,
  Paper,
  Badge,
  Card
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSpeakerphone,
  IconSend,
  IconSparkles,
  IconBuildingFactory2
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

interface KioskBroadcastModalProps {
  opened: boolean;
  onClose: () => void;
}

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

export default function KioskBroadcastModal({ opened, onClose }: KioskBroadcastModalProps) {
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
        message: '모든 현장 키오스크 화면으로 공지가 즉시 실시간 송출되었습니다.',
        color: 'teal',
        icon: <IconSpeakerphone size={18} />,
      });

      setMessage('');
      onClose();
    } catch (err) {
      console.error('Failed to send global broadcast:', err);
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSpeakerphone size={24} style={{ color: '#2563eb' }} />
          <Text fw={800} size="lg" style={{ color: '#0f172a' }}>
            현장 방송 / 공지 송출 제어판
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
      centered
      overlayProps={{ opacity: 0.55, blur: 3 }}
    >
      <Stack gap="md" py="xs">
        {/* 송출 대상 안내 표시 (전체 현장 키오스크 고정) */}
        <Paper p="xs" px="md" radius="md" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconBuildingFactory2 size={20} color="#2563eb" />
              <Text size="sm" fw={800} c="blue.9">
                송출 대상: 전체 현장 키오스크 (모든 화면 동시 방송)
              </Text>
            </Group>
            <Badge color="blue" variant="filled" size="sm">
              전체 동시 송출
            </Badge>
          </Group>
        </Paper>

        {/* 빠른 템플릿 버튼 */}
        <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Stack gap="xs">
            <Text size="sm" fw={700} c="gray.8">
              ⚡ 빠른 문구 템플릿
            </Text>
            <Group gap="xs" wrap="wrap">
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <Button
                  key={idx}
                  size="xs"
                  variant="light"
                  color={tmpl.badgeColor}
                  radius="md"
                  onClick={() => handleTemplateClick(tmpl.text)}
                  leftSection={<IconSparkles size={14} />}
                  style={{ fontWeight: 700 }}
                >
                  {tmpl.label}
                </Button>
              ))}
            </Group>
          </Stack>
        </Paper>

        {/* 방송/공지 문구 입력창 */}
        <Paper p="sm" radius="md" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
          <Stack gap="xs">
            <Text size="sm" fw={700} c="gray.8">
              📝 공지 / 방송 문구 입력
            </Text>
            <Textarea
              placeholder="모든 현장 키오스크에 실시간 팝업 안내 및 음성(TTS)으로 송출할 문구를 입력하세요."
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              minRows={4}
              maxRows={8}
              autosize
              styles={{
                input: {
                  fontSize: '15px',
                  fontWeight: 600,
                  lineHeight: '1.5',
                  padding: '12px'
                }
              }}
            />
          </Stack>
        </Paper>

        {/* 대형 전송 버튼 */}
        <Button
          size="lg"
          color="blue"
          fullWidth
          radius="md"
          onClick={handleSendBroadcast}
          loading={isSending}
          disabled={!message.trim()}
          leftSection={<IconSend size={22} />}
          style={{
            height: '54px',
            fontSize: '17px',
            fontWeight: 900,
            letterSpacing: '0.5px',
            boxShadow: message.trim() ? '0 4px 14px rgba(37, 99, 235, 0.35)' : undefined
          }}
        >
          📢 전체 현장 키오스크 동시 방송 전송
        </Button>
      </Stack>
    </Modal>
  );
}
