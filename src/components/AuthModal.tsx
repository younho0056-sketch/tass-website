"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Stack, Text, Group, Alert, Paper, Badge, ActionIcon } from '@mantine/core';
import { IconAlertCircle, IconShieldCheck, IconEye, IconEyeOff, IconKey } from '@tabler/icons-react';
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

    // 4자리 입력 시 즉시 로그인 검증 실행
    if (val.length === 4) {
      executeLogin(val);
    }
  };

  const handleNumpadPress = (digit: string) => {
    isUserInteracted.current = true;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);

      if (inputRef.current) {
        inputRef.current.focus();
      }

      if (nextPin.length === 4) {
        executeLogin(nextPin);
      }
    }
  };

  const handleNumpadBackspace = () => {
    isUserInteracted.current = true;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleNumpadClear = () => {
    isUserInteracted.current = true;
    setPin('');
    setError(null);
    if (inputRef.current) {
      inputRef.current.focus();
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
      radius="lg"
      overlayProps={{
        backgroundOpacity: 0.75,
        blur: 6,
      }}
      size={modalStep === 'pin' ? 660 : 440}
      styles={{
        content: { maxWidth: modalStep === 'pin' ? '660px' : '440px', width: '100%' }
      }}
    >
      {modalStep === 'pin' ? (
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch pt-1">
            {/* Left Column: Guidance & Input & Actions */}
            <div className="flex flex-col justify-between space-y-4">
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge color="blue" variant="light" size="sm" leftSection={<IconKey size={12} />}>
                    터치 / 키보드 지원
                  </Badge>
                </Group>

                <Text size="sm" fw={700} c="gray.8">
                  PIN 비밀번호 4자리를 입력해 주세요.
                </Text>

                {error && (
                  <Alert icon={<IconAlertCircle size={15} />} color="red" variant="light" radius="md" p="xs">
                    <Text size="xs" fw={600}>{error}</Text>
                  </Alert>
                )}

                {/* PIN Input field with security mask toggle */}
                <div className="relative mt-1">
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
                    className="w-full h-14 text-2xl font-black text-center tracking-[10px] rounded-xl border-2 transition-all outline-none"
                    style={{
                      borderColor: error ? '#ef4444' : '#3b82f6',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                    }}
                  />
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  >
                    {showPin ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                  </ActionIcon>
                </div>

                <Text size="xs" c="dimmed" fw={500} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  💡 터치 모니터 환경에서는 오른쪽 숫자 키패드를 눌러 PIN을 쉽게 입력할 수 있습니다.
                </Text>
              </Stack>

              {/* Action Buttons */}
              <Group justify="space-between" mt="md" className="pt-2 border-t border-slate-100">
                <Button variant="subtle" color="gray" size="sm" onClick={handleClose}>
                  취소
                </Button>
                <Button
                  type="submit"
                  color="blue"
                  size="md"
                  radius="md"
                  disabled={pin.length < 4}
                  rightSection={<IconShieldCheck size={18} />}
                  className="px-5 font-bold shadow-sm"
                >
                  시스템 접속
                </Button>
              </Group>
            </div>

            {/* Right Column: Virtual Numpad (3x4 Grid) */}
            <div className="bg-slate-50/80 border border-slate-200/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="text-xs font-bold text-slate-500 mb-2 flex items-center justify-between px-1">
                <span>가상 키패드 (Virtual Numpad)</span>
                <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                  {pin.length} / 4 자리
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {/* Digits 1 to 9 */}
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleNumpadPress(digit)}
                    className="h-14 sm:h-16 flex items-center justify-center text-2xl font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:bg-blue-50 active:bg-blue-600 active:text-white active:scale-95 transition-all duration-150 select-none touch-manipulation cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}

                {/* Row 4: [전체삭제] [ 0 ] [ ⌫ (지우기) ] */}
                <button
                  type="button"
                  onClick={handleNumpadClear}
                  className="h-14 sm:h-16 flex items-center justify-center text-xs sm:text-sm font-extrabold text-rose-600 bg-rose-50 border border-rose-200/80 rounded-xl hover:bg-rose-100 active:bg-rose-600 active:text-white active:scale-95 transition-all duration-150 select-none touch-manipulation cursor-pointer"
                >
                  전체삭제
                </button>

                <button
                  type="button"
                  onClick={() => handleNumpadPress('0')}
                  className="h-14 sm:h-16 flex items-center justify-center text-2xl font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:bg-blue-50 active:bg-blue-600 active:text-white active:scale-95 transition-all duration-150 select-none touch-manipulation cursor-pointer"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handleNumpadBackspace}
                  className="h-14 sm:h-16 flex items-center justify-center text-sm font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl hover:bg-amber-100 active:bg-amber-600 active:text-white active:scale-95 transition-all duration-150 select-none touch-manipulation cursor-pointer"
                >
                  ⌫ 지우기
                </button>
              </div>
            </div>
          </div>
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
