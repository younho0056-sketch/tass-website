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
      <Tooltip label={isPlaying ? 'BGM 일시정지' : '웅장한 오케스트라 BGM 재생'} position="bottom" withArrow>
        <Button
          onClick={togglePlay}
          variant={isPlaying ? 'gradient' : 'outline'}
          gradient={{ from: 'blue', to: 'cyan' }}
          size="xs"
          radius="xl"
          style={{
            borderColor: isPlaying ? 'transparent' : 'rgba(255, 255, 255, 0.3)',
            backgroundColor: isPlaying ? undefined : 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease',
            color: '#ffffff',
            boxShadow: isPlaying ? '0 0 14px rgba(37, 99, 235, 0.6)' : 'none',
            height: '34px',
            padding: '0 12px'
          }}
          leftSection={
            isPlaying ? (
              <Volume2 size={16} style={{ color: '#38bdf8' }} />
            ) : (
              <VolumeX size={16} style={{ color: '#94a3b8' }} />
            )
          }
        >
          <Group gap={6} align="center">
            <Text fw={700} size="xs" style={{ letterSpacing: '0.5px' }}>
              {isPlaying ? 'BGM ON' : 'BGM OFF'}
            </Text>
          </Group>
        </Button>
      </Tooltip>
    </>
  );
}
