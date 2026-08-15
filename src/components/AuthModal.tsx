"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Stack, Text, Group, Alert, Paper, Badge, ActionIcon } from '@mantine/core';
import { IconAlertCircle, IconShieldCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, targetUrl } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isUserInteracted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthModalOpen) {
      setPin('');
      setError(null);
      isUserInteracted.current = false;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 120);
    }
  }, [isAuthModalOpen]);

  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    return (
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia('(pointer: coarse)').matches
    );
  };

  const executeLogin = (inputPin: string) => {
    if (!inputPin.trim()) {
      setError('비밀번호(PIN) 4자리를 입력해 주세요.');
      return;
    }

    const result = login(inputPin);
    if (result.success) {
      setPin('');
      setError(null);
      isUserInteracted.current = false;
      if (targetUrl) {
        router.push(targetUrl);
      }
    } else {
      setError(result.error || '비밀번호가 올바르지 않습니다.');
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setError(null);

    // [Mobile]: 4자리 입력 시 터치 편의를 위해 즉시 자동 로그인 검증 실행
    // [PC]: 원치 않는 자동 제출 방지를 위해 Enter 키 또는 [시스템 접속] 클릭으로만 제출
    if (isMobileDevice() && isUserInteracted.current && val.length === 4) {
      executeLogin(val);
    }
  };

  const markUserInteracted = () => {
    isUserInteracted.current = true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    isUserInteracted.current = true;
    executeLogin(pin);
  };

  const handleClose = () => {
    setPin('');
    setError(null);
    isUserInteracted.current = false;
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
          <Text fw={800} size="lg">시스템 접속 인증 (PIN)</Text>
        </Group>
      }
      centered
      radius="lg"
      overlayProps={{
        backgroundOpacity: 0.75,
        blur: 6,
      }}
      size="sm"
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        <Stack gap="md" pt="xs">
          <Text size="xs" c="dimmed" ta="center" fw={600}>
            TASS 시스템 접근을 위해 PIN 비밀번호 4자리를 입력해 주세요.
          </Text>

          <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Text size="xs" fw={700} c="gray.7" mb={6}>💡 접속 권한 안내</Text>
            <Group gap="xs" mb={4}>
              <Badge color="teal" size="sm" variant="filled">직원 권한</Badge>
              <Text size="xs" c="gray.6">조회, 검색, A4/송장 출력 가능</Text>
            </Group>
            <Group gap="xs">
              <Badge color="blue" size="sm" variant="filled">관리자 권한</Badge>
              <Text size="xs" c="gray.6">등록, 수정, 삭제, AI 전권 이용 가능</Text>
            </Group>
          </Paper>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
              {error}
            </Alert>
          )}

          {/* Large Mobile Numeric Keypad Input with Security Masking & Device Submission Handling */}
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              name="tass_pin_no_autofill"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="new-password"
              autoCapitalize="off"
              spellCheck={false}
              value={pin}
              onKeyDown={markUserInteracted}
              onPointerDown={markUserInteracted}
              onTouchStart={markUserInteracted}
              onChange={handlePinChange}
              placeholder="••••"
              autoFocus
              className="text-2xl tracking-widest text-center"
              style={{
                width: '100%',
                height: '60px',
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '12px',
                textAlign: 'center',
                borderRadius: '12px',
                border: error ? '2px solid #ef4444' : '2px solid #3b82f6',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.18)',
                transition: 'all 0.2s ease-in-out'
              }}
            />
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setShowPin(!showPin)}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            >
              {showPin ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </ActionIcon>
          </div>

          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="gray" onClick={handleClose}>
              취소
            </Button>
            <Button type="submit" color="blue" size="md" radius="md" rightSection={<IconShieldCheck size={18} />}>
              시스템 접속
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
