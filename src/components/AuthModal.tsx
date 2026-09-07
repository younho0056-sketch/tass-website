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
  const [modalStep, setModalStep] = useState<'pin' | 'mode_select'>('pin');
  const inputRef = useRef<HTMLInputElement>(null);
  const isUserInteracted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthModalOpen) {
      setPin('');
      setError(null);
      setModalStep('pin');
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
      // Show mode selection step upon successful authentication
      setModalStep('mode_select');
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
    setModalStep('pin');
    isUserInteracted.current = false;
    closeAuthModal();
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      router.push('/');
    }
  };

  const handleSelectAdminMode = () => {
    closeAuthModal();
    setModalStep('pin');
    const destination = targetUrl && targetUrl !== '/' ? targetUrl : '/orders';
    router.push(destination);
  };

  const handleSelectKioskMode = () => {
    closeAuthModal();
    setModalStep('pin');
    router.push('/kiosk');
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
          <Text fw={800} size="md">
            {modalStep === 'pin' ? '시스템 접속 인증 (PIN)' : '접속 모드 선택'}
          </Text>
        </Group>
      }
      centered
      radius="md"
      overlayProps={{
        backgroundOpacity: 0.75,
        blur: 6,
      }}
      size={modalStep === 'pin' ? 330 : 420}
      styles={{
        content: { maxWidth: modalStep === 'pin' ? '330px' : '420px', width: '100%' }
      }}
    >
      {modalStep === 'pin' ? (
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
      ) : (
        <Stack gap="md" py="xs">
          <Text size="sm" c="dimmed" ta="center" fw={700}>
            접속하실 시스템 모드를 선택해 주세요.
          </Text>

          {/* Option 1: Office/Admin Mode */}
          <Paper
            withBorder
            p="md"
            radius="lg"
            style={{
              cursor: 'pointer',
              borderColor: '#3b82f6',
              backgroundColor: '#f0f7ff',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={handleSelectAdminMode}
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={4}>
                <Group gap="xs" align="center">
                  <Text fw={900} size="lg" c="blue.8">🏢 사무 / 관리자 모드</Text>
                  <Badge color="blue" size="xs" variant="filled">Admin</Badge>
                </Group>
                <Text size="xs" c="gray.7" fw={600}>
                  수주, 거래처, 견적, 일정 등 종합 관리자 대시보드로 이동합니다.
                </Text>
              </Stack>
              <Button color="blue" size="sm" radius="md" style={{ minWidth: '70px' }}>
                선택
              </Button>
            </Group>
          </Paper>

          {/* Option 2: Field Kiosk Mode */}
          <Paper
            withBorder
            p="md"
            radius="lg"
            style={{
              cursor: 'pointer',
              borderColor: '#10b981',
              backgroundColor: '#ecfdf5',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={handleSelectKioskMode}
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={4}>
                <Group gap="xs" align="center">
                  <Text fw={900} size="lg" c="teal.8">🏭 현장 키오스크 모드</Text>
                  <Badge color="teal" size="xs" variant="filled">Kiosk</Badge>
                </Group>
                <Text size="xs" c="gray.7" fw={600}>
                  공장 현장 전용 고대비·대형 터치 완료 처리 화면(/kiosk)으로 이동합니다.
                </Text>
              </Stack>
              <Button color="teal" size="sm" radius="md" style={{ minWidth: '70px' }}>
                선택
              </Button>
            </Group>
          </Paper>

          <Button variant="subtle" color="gray" size="xs" onClick={handleClose} mt="xs">
            취소 및 닫기
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
