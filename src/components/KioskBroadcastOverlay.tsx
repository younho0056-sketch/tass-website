"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Progress,
  Paper,
  Box,
  Badge
} from '@mantine/core';
import { IconSpeakerphone, IconVolume, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

interface KioskBroadcastOverlayProps {
  opened: boolean;
  message: string;
  onClose: () => void;
}

const DURATION_SECONDS = 10;

export default function KioskBroadcastOverlay({
  opened,
  message,
  onClose
}: KioskBroadcastOverlayProps) {
  const [timeLeft, setTimeLeft] = useState<number>(DURATION_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!opened) {
      setTimeLeft(DURATION_SECONDS);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(DURATION_SECONDS);

    const startTime = Date.now();
    const intervalMs = 100;

    timerRef.current = setInterval(() => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, DURATION_SECONDS - elapsedSec);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [opened, onClose]);

  const handleManualClose = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const progressPercent = (timeLeft / DURATION_SECONDS) * 100;

  if (!opened) return null;

  return (
    <Modal
      opened={opened}
      onClose={handleManualClose}
      withCloseButton={false}
      centered
      size="90%"
      radius="xl"
      zIndex={9999}
      overlayProps={{
        color: '#000000',
        opacity: 0.88,
        blur: 8
      }}
      styles={{
        content: {
          backgroundColor: '#0f172a',
          border: '3px solid #3b82f6',
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.6)',
          padding: '28px',
          color: '#ffffff',
          maxWidth: '920px',
          margin: '0 auto',
          zIndex: 9999
        }
      }}
    >
      <Stack gap="xl" align="center" py="md">
        {/* 상단 굵은 글씨 및 긴급 안내 배지 */}
        <Group gap="sm" align="center" justify="center">
          <Badge
            size="xl"
            color="red"
            variant="filled"
            leftSection={<IconAlertTriangle size={20} />}
            style={{
              padding: '12px 20px',
              fontSize: '16px',
              fontWeight: 900,
              borderRadius: '8px'
            }}
          >
            긴급 방송 / 사무실 공지
          </Badge>
          <Badge size="lg" color="blue" variant="filled" style={{ fontWeight: 800 }}>
            전체 현장 키오스크
          </Badge>
        </Group>

        {/* 타이틀 아이콘 & 헤더 */}
        <Group gap="md" align="center">
          <IconSpeakerphone size={46} style={{ color: '#60a5fa' }} />
          <Text
            fw={900}
            style={{
              fontSize: '30px',
              color: '#ffffff',
              letterSpacing: '1px',
              textAlign: 'center'
            }}
          >
            현장 긴급 안내 / 사무실 공지
          </Text>
        </Group>

        {/* 공지 문구 (대형 고대비 텍스트 박스) */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            backgroundColor: '#1e293b',
            border: '2px solid #475569',
            width: '100%',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)'
          }}
        >
          <Text
            fw={900}
            style={{
              fontSize: '30px',
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.6,
              wordBreak: 'keep-all',
              whiteSpace: 'pre-wrap'
            }}
          >
            {message}
          </Text>
        </Paper>

        {/* 10초 후 자동 닫힘 타이머 게이지 바 & 수동 확인 닫기 버튼 */}
        <Stack gap="xs" style={{ width: '100%' }}>
          <Group justify="space-between" align="center">
            <Group gap={6} align="center">
              <IconVolume size={20} color="#60a5fa" />
              <Text size="sm" c="blue.2" fw={700}>
                음성 및 차임벨 안내 진행 중
              </Text>
            </Group>
            <Text size="sm" c="gray.4" fw={700}>
              {Math.ceil(timeLeft)}초 후 자동 닫힘
            </Text>
          </Group>

          {/* Countdown Gauge Bar */}
          <Progress
            value={progressPercent}
            color="blue"
            size="xl"
            radius="xl"
            animated
            style={{ backgroundColor: '#334155' }}
          />

          <Box mt="md" style={{ display: 'flex', justifyCenter: 'center', width: '100%', justifyContent: 'center' }}>
            <Button
              size="xl"
              color="blue"
              radius="md"
              onClick={handleManualClose}
              leftSection={<IconCheck size={26} />}
              style={{
                width: '300px',
                height: '60px',
                fontSize: '19px',
                fontWeight: 900,
                backgroundColor: '#2563eb'
              }}
            >
              확인 (닫기)
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Modal>
  );
}
