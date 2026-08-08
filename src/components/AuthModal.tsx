"use client";

import React, { useState, useEffect } from 'react';
import { Modal, PasswordInput, Button, Stack, Text, Group, Alert, Paper, Badge } from '@mantine/core';
import { IconLock, IconAlertCircle, IconKey, IconEye, IconShieldCheck } from '@tabler/icons-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, targetUrl } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isAuthModalOpen) {
      setPin('');
      setError(null);
    }
  }, [isAuthModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin.trim()) {
      setError('비밀번호(PIN)를 입력해 주세요.');
      return;
    }

    const result = login(pin);
    if (result.success) {
      setPin('');
      setError(null);
      if (targetUrl) {
        router.push(targetUrl);
      }
    } else {
      setError(result.error || '비밀번호가 올바르지 않습니다.');
    }
  };

  const handleClose = () => {
    setPin('');
    setError(null);
    closeAuthModal();
    router.push('/');
  };

  return (
    <Modal
      opened={isAuthModalOpen}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <div style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '6px',
            fontWeight: 900,
            fontSize: '14px',
            letterSpacing: '1px'
          }}>
            TASS
          </div>
          <Text fw={800} size="lg">시스템 접속 인증</Text>
        </Group>
      }
      centered
      radius="md"
      overlayProps={{
        backgroundOpacity: 0.7,
        blur: 5,
      }}
      size="md"
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        <Stack gap="md" pt="xs">
          <Text size="sm" c="dimmed">
            TASS 관리자 시스템 및 업무 기능에 접근하기 위해 비밀번호(PIN)를 입력해 주세요.
          </Text>

          <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Text size="xs" fw={700} c="gray.7" mb={6}>💡 권한 안내</Text>
            <Group gap="xs" mb={4}>
              <Badge color="teal" size="sm" variant="filled">직원 권한</Badge>
              <Text size="xs" c="gray.6">조회, 검색, A4/송장 출력, 엑셀 내보내기 가능</Text>
            </Group>
            <Group gap="xs">
              <Badge color="blue" size="sm" variant="filled">관리자 권한</Badge>
              <Text size="xs" c="gray.6">등록, 수정, 삭제, AI 원고 작성 등 전권 가능</Text>
            </Group>
          </Paper>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
              {error}
            </Alert>
          )}

          <PasswordInput
            leftSection={<IconLock size={18} />}
            placeholder="비밀번호 4자리를 입력하세요"
            value={pin}
            onChange={(e) => setPin(e.currentTarget.value)}
            autoFocus
            size="md"
            maxLength={6}
            autoComplete="new-password"
            name="tass_pin_security"
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={handleClose}>
              취소
            </Button>
            <Button type="submit" color="blue" rightSection={<IconShieldCheck size={18} />}>
              시스템 접속
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
