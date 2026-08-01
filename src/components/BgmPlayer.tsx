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
      <Tooltip label={isPlaying ? 'BGM 일시정지 (웅장한 오케스트라)' : 'BGM 켜기 (웅장한 오케스트라)'} position="bottom" withArrow>
        <Button
          onClick={togglePlay}
          size="xs"
          radius="xl"
          variant={isPlaying ? 'gradient' : 'filled'}
          gradient={{ from: 'blue', to: 'cyan' }}
          style={{
            backgroundColor: isPlaying ? undefined : 'rgba(30, 41, 59, 0.8)',
            border: isPlaying ? '1px solid rgba(56, 189, 248, 0.8)' : '1px solid rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: isPlaying ? '0 0 14px rgba(37, 99, 235, 0.6)' : 'none',
            transition: 'all 0.2s ease',
            padding: '0 12px',
            height: '32px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center'
          }}
          leftSection={
            isPlaying ? (
              <Volume2 size={16} style={{ color: '#38bdf8' }} />
            ) : (
              <VolumeX size={16} style={{ color: '#94a3b8' }} />
            )
          }
        >
          <Group gap={4} align="center">
            <Text fw={700} size="xs" style={{ color: '#ffffff', letterSpacing: '0.3px', lineHeight: 1 }}>
              {isPlaying ? '🎵 BGM ON' : '🔇 BGM OFF'}
            </Text>
          </Group>
        </Button>
      </Tooltip>
    </>
  );
}


