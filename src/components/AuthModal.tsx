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
            padding: '3px 8px',
            borderRadius: '6px',
            fontWeight: 900,
            fontSize: '13px',
            letterSpacing: '1px'
          }}>
            TASS
          </div>
          <Text fw={800} size="md">시스템 접속 인증 (PIN)</Text>
        </Group>
      }
      centered
      radius="md"
      overlayProps={{
        backgroundOpacity: 0.75,
        blur: 6,
      }}
      size={330}
      styles={{
        content: { maxWidth: '330px', width: '100%' }
      }}
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        <Stack gap="sm" pt="xs">
          <Text size="xs" c="dimmed" ta="center" fw={600}>
            PIN 비밀번호 4자리를 입력해 주세요.
          </Text>

          {error && (
            <Alert icon={<IconAlertCircle size={15} />} color="red" variant="light" radius="md" p="xs">
              <Text size="xs">{error}</Text>
            </Alert>
          )}

          {/* Numeric Keypad Input with Security Masking */}
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
                height: '52px',
                fontSize: '24px',
                fontWeight: 900,
                letterSpacing: '10px',
                textAlign: 'center',
                borderRadius: '10px',
                border: error ? '2px solid #ef4444' : '2px solid #3b82f6',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                boxShadow: '0 3px 10px rgba(59, 130, 246, 0.15)',
                transition: 'all 0.2s ease-in-out'
              }}
            />
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setShowPin(!showPin)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)'
              }}
            >
              {showPin ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </ActionIcon>
          </div>

          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={handleClose}>
              취소
            </Button>
            <Button type="submit" color="blue" size="sm" radius="md" rightSection={<IconShieldCheck size={16} />}>
              시스템 접속
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
