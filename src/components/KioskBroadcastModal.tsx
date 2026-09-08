"use client";

import React, { useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Textarea,
  Checkbox,
  SegmentedControl,
  Paper,
  ActionIcon,
  Badge,
  Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSpeakerphone,
  IconSend,
  IconVolume,
  IconVolumeOff,
  IconClock,
  IconSparkles,
  IconBuildingFactory2,
  IconUsers
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

interface KioskBroadcastModalProps {
  opened: boolean;
  onClose: () => void;
}

export type BroadcastPayload = {
  targetStation: 'all' | '1' | '2' | '3' | '4';
  message: string;
  playSound: boolean;
  timestamp: number;
};

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

export default function KioskBroadcastModal({ opened, onClose }: KioskBroadcastModalProps) {
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

          // Clean up channel subscription after sending
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

      // Clear input and close modal
      setMessage('');
      onClose();
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
        {/* 송출 대상 선택 */}
        <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={700} c="gray.8">
                🎯 송출 대상 키오스크 선택
              </Text>
              <Badge color={targetStation === 'all' ? 'blue' : 'teal'} variant="light" size="sm">
                {targetStation === 'all' ? '전체 키오스크 송출' : `${targetStation}번 공정 키오스크`}
              </Badge>
            </Group>

            <SegmentedControl
              value={targetStation}
              onChange={(val) => setTargetStation(val as 'all' | '1' | '2' | '3' | '4')}
              data={TARGET_OPTIONS}
              fullWidth
              color="blue"
              size="sm"
              radius="md"
              styles={{
                root: { backgroundColor: '#ffffff', border: '1px solid #cbd5e1' },
                label: { fontWeight: 700, padding: '8px 4px', fontSize: '13px' }
              }}
            />
          </Stack>
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

        {/* 직접 입력창 */}
        <Paper p="sm" radius="md" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
          <Stack gap="xs">
            <Text size="sm" fw={700} c="gray.8">
              📝 방송 / 공지 문구 입력
            </Text>
            <Textarea
              placeholder="현장에 실시간으로 음성(TTS) 및 팝업 안내할 내용을 입력하세요."
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

        {/* 옵션 체크박스 */}
        <Group justify="space-between" align="center" px="xs">
          <Checkbox
            checked={playSound}
            onChange={(e) => setPlaySound(e.currentTarget.checked)}
            label={
              <Group gap={6} align="center">
                {playSound ? <IconVolume size={18} color="#2563eb" /> : <IconVolumeOff size={18} color="#94a3b8" />}
                <Text size="sm" fw={700} c={playSound ? 'blue.9' : 'gray.6'}>
                  소리 알림 포함 (띵동 차임벨 + 음성 읽기 TTS)
                </Text>
              </Group>
            }
            color="blue"
            radius="sm"
          />
          <Text size="xs" c="dimmed">
            * 10초간 대형 오버레이 표출
          </Text>
        </Group>

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
          공지 / 방송 실시간 전송
        </Button>
      </Stack>
    </Modal>
  );
}
