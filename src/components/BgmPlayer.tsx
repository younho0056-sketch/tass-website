"use client";

import { useState, useRef, useEffect } from 'react';
import { Button, Tooltip, Group, Text } from '@mantine/core';
import { Volume2, VolumeX } from 'lucide-react';

export default function BgmPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3; // 기본 볼륨 30% 설정
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Autoplay blocked or play request interrupted:', err);
          setIsPlaying(false);
        });
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bgm.mp3" loop preload="auto" />
      
      {/* 화면 우측 하단 플로팅 BGM 컨트롤 버튼 (모든 기기/화면 100% 노출 보장) */}
      <div 
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
        }}
      >
        <Tooltip label={isPlaying ? 'BGM 일시정지 (웅장한 오케스트라)' : 'BGM 켜기 (웅장한 오케스트라)'} position="left" withArrow>
          <Button
            onClick={togglePlay}
            size="md"
            radius="xl"
            variant={isPlaying ? 'gradient' : 'filled'}
            gradient={{ from: 'blue', to: 'cyan' }}
            style={{
              backgroundColor: isPlaying ? undefined : 'rgba(15, 23, 42, 0.90)',
              border: isPlaying ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isPlaying ? '0 0 20px rgba(37, 99, 235, 0.7)' : '0 4px 15px rgba(0, 0, 0, 0.5)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '0 18px',
              height: '44px',
              cursor: 'pointer'
            }}
            leftSection={
              isPlaying ? (
                <Volume2 size={20} style={{ color: '#38bdf8' }} />
              ) : (
                <VolumeX size={20} style={{ color: '#94a3b8' }} />
              )
            }
          >
            <Group gap={6} align="center">
              <Text fw={800} size="sm" style={{ color: '#ffffff', letterSpacing: '0.5px' }}>
                {isPlaying ? '🎵 BGM ON' : '🔇 BGM 켜기'}
              </Text>
            </Group>
          </Button>
        </Tooltip>
      </div>
    </>
  );
}

