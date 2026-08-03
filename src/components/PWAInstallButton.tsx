"use client";

import { useEffect, useState } from 'react';
import { Button, Tooltip, Modal, Text, Group, Stack, Badge } from '@mantine/core';
import { IconDeviceDesktopDown, IconCheck, IconInfoCircle } from '@tabler/icons-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallButton({ variant = 'header' }: { variant?: 'header' | 'hero' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [modalOpened, setModalOpened] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if app is running in standalone mode
    if (typeof window !== 'undefined') {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      
      if (isStandalone) {
        setIsInstalled(true);
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setInstalledSuccess(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          setInstalledSuccess(true);
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('[PWA] Installation prompt error:', err);
        setModalOpened(true);
      }
    } else {
      // If beforeinstallprompt hasn't fired or already standalone, open guidance modal
      setModalOpened(true);
    }
  };

  if (isInstalled) {
    return (
      <Tooltip label="TASS PC 전용 단독 앱이 실행 중입니다" position="bottom" withArrow>
        <Badge
          color="green"
          variant="light"
          size="lg"
          leftSection={<IconCheck size={14} />}
          style={{ cursor: 'default', textTransform: 'none', padding: '16px 12px' }}
        >
          PC 앱 실행 중
        </Badge>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip label="클릭하여 바탕화면 및 작업표시줄에 TASS PC 앱 설치" position="bottom" withArrow>
        <Button
          onClick={handleInstallClick}
          size={variant === 'hero' ? 'md' : 'xs'}
          radius="md"
          variant="gradient"
          gradient={{ from: 'blue', to: 'indigo', deg: 90 }}
          leftSection={<IconDeviceDesktopDown size={variant === 'hero' ? 20 : 16} />}
          style={{
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)',
            fontWeight: 700,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          📱 PC 앱 설치
        </Button>
      </Tooltip>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs">
            <IconInfoCircle size={22} color="#2563eb" />
            <Text fw={700} size="lg">TASS PC 앱 설치 안내</Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Stack gap="sm">
          {installedSuccess ? (
            <Text size="sm" c="green" fw={600}>
              🎉 TASS 스마트 현장 관리 시스템 PC 앱 설치가 성공적으로 진행되었습니다! 바탕화면 또는 시작 메뉴에서 단독 아이콘으로 실행하실 수 있습니다.
            </Text>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                브라우저 환경에 따라 자동 설치 팝업이 호출되거나 주소창에서 설치를 지원합니다.
              </Text>
              
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Text fw={700} size="xs" c="blue" mb={4}>💡 데스크톱 수동 설치 방법</Text>
                <Text size="xs" c="dark" style={{ lineHeight: 1.6 }}>
                  1. 브라우저 주소창 오른쪽에 위치한 <b>[앱 설치 아이콘 🖥️]</b> 클릭<br />
                  2. 또는 크롬/엣지 우측 상단 메뉴 <b>(⋮) ➔ &apos;TASS 설치...&apos;</b> 선택<br />
                  3. 바탕화면 및 작업표시줄에 아이콘이 바로 생성되어 단독 애플리케이션으로 실행됩니다.
                </Text>
              </div>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={() => setModalOpened(false)}>
              닫기
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
