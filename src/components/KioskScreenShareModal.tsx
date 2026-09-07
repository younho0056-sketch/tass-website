"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Group,
  Text,
  Stack,
  Badge,
  Paper,
  Alert,
  Loader
} from '@mantine/core';
import {
  IconScreenShare,
  IconScreenShareOff,
  IconAlertCircle,
  IconCheck,
  IconDeviceTv,
  IconRadioactive
} from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

const DEFAULT_STATIONS = [
  '1번 키오스크 (설계/공정)',
  '2번 키오스크 (절단/가공)',
  '3번 키오스크 (용접/도장)',
  '4번 키오스크 (조립/출고)',
];

interface KioskScreenShareModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function KioskScreenShareModal({ opened, onClose }: KioskScreenShareModalProps) {
  const [onlinePresence, setOnlinePresence] = useState<Record<string, any>>({});
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  // Subscribe to Supabase Realtime Presence & Broadcast Signaling
  useEffect(() => {
    if (!supabase) return;

    // Presence Channel
    const presenceChannel = supabase.channel('kiosk-webrtc-presence', {
      config: { presence: { key: 'admin-dashboard' } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const activeMap: Record<string, any> = {};
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.stationId) {
              activeMap[p.stationId] = p;
            }
          });
        });
        setOnlinePresence(activeMap);
      })
      .subscribe();

    // Broadcast Signaling Channel
    const signalingChannel = supabase.channel('kiosk-webrtc-signaling');
    channelRef.current = signalingChannel;

    signalingChannel
      .on('broadcast', { event: 'signal_answer' }, (payload: any) => {
        if (payload?.payload?.targetStationId === activeStation && pcRef.current) {
          const answer = new RTCSessionDescription(payload.payload.answer);
          pcRef.current.setRemoteDescription(answer).catch((err) => {
            console.error('Failed to set remote description on answer:', err);
          });
        }
      })
      .on('broadcast', { event: 'signal_ice' }, (payload: any) => {
        if (payload?.payload?.targetStationId === activeStation && pcRef.current && payload?.payload?.candidate) {
          const candidate = new RTCIceCandidate(payload.payload.candidate);
          pcRef.current.addIceCandidate(candidate).catch((err) => {
            console.error('Failed to add ICE candidate:', err);
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(signalingChannel);
    };
  }, [activeStation]);

  // Clean up WebRTC peer connection & media tracks
  const stopScreenShare = () => {
    if (channelRef.current && activeStation) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal_stop',
        payload: { targetStationId: activeStation },
      });
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setIsSharing(false);
    setActiveStation(null);
    setErrorMessage(null);
  };

  // Start Screen Sharing to target kiosk station
  const startScreenShare = async (stationId: string) => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('이 브라우저는 화면 공유 API(getDisplayMedia)를 지원하지 않습니다.');
      }

      // 1. Capture Screen Media Stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      streamRef.current = stream;
      setActiveStation(stationId);
      setIsSharing(true);

      // Handle user clicking native browser "Stop Sharing" floating button
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // 2. Create WebRTC Peer Connection (STUN Server)
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // 3. Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 4. Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal_ice',
            payload: {
              targetStationId: stationId,
              candidate: event.candidate,
              from: 'Admin',
            },
          });
        }
      };

      // 5. Create Offer & Set Local Description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Broadcast Offer to Target Kiosk Station
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal_offer',
          payload: {
            targetStationId: stationId,
            offer: pc.localDescription,
            from: 'Admin',
          },
        });
      }
    } catch (err: any) {
      console.error('WebRTC Screen Share Error:', err);
      stopScreenShare();
      if (err.name !== 'NotAllowedError') {
        setErrorMessage(err.message || '화면 공유 시작 중 오류가 발생했습니다.');
      }
    }
  };

  const handleModalClose = () => {
    if (!isSharing) {
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleModalClose}
      title={
        <Group gap="xs">
          <IconScreenShare size={24} color="#2563eb" />
          <Text fw={900} size="lg" c="blue.8">
            🖥️ 현장 키오스크 1:1 실시간 화면 공유 (WebRTC)
          </Text>
        </Group>
      }
      size="lg"
      centered
      radius="lg"
      styles={{
        content: { backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' },
        header: { backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' },
      }}
    >
      <Stack gap="md" py="xs">
        <Text size="sm" c="gray.6" fw={600}>
          사무실 PC의 특정 도면/CAD/창 화면을 현장 키오스크로 실시간 P2P 송출합니다.
        </Text>

        {errorMessage && (
          <Alert icon={<IconAlertCircle size={18} />} color="red" variant="light" radius="md">
            <Text size="xs">{errorMessage}</Text>
          </Alert>
        )}

        {isSharing ? (
          <Paper p="md" radius="lg" style={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', textAlign: 'center' }}>
            <Stack align="center" gap="sm">
              <Group gap="xs">
                <Loader size="sm" color="blue" />
                <Badge color="blue" size="lg" variant="filled">
                  🟢 {activeStation}로 화면 공유 송출 중
                </Badge>
              </Group>
              <Text size="xs" c="blue.9" fw={700}>
                브라우저 공유 스트림이 연결되었습니다. 현장 키오스크 화면에 즉시 표출됩니다.
              </Text>
              <Button
                color="red"
                size="md"
                radius="md"
                onClick={stopScreenShare}
                leftSection={<IconScreenShareOff size={20} />}
                mt="xs"
                style={{ fontWeight: 900 }}
              >
                ⏹️ 화면 공유 중지
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="xs">
            <Text size="xs" fw={800} c="dimmed">
              화면을 송출할 대상 현장 키오스크를 선택하세요:
            </Text>

            {DEFAULT_STATIONS.map((station) => {
              const isOnline = Boolean(onlinePresence[station]);

              return (
                <Paper
                  key={station}
                  p="md"
                  radius="md"
                  style={{
                    backgroundColor: '#f8fafc',
                    border: isOnline ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <IconDeviceTv size={22} color={isOnline ? '#2563eb' : '#94a3b8'} />
                      <Stack gap={2}>
                        <Text fw={800} size="md" c={isOnline ? 'blue.8' : 'dark'}>
                          {station}
                        </Text>
                        <Badge color={isOnline ? 'teal' : 'gray'} size="xs" variant="light">
                          {isOnline ? '🟢 온라인 (접속 중)' : '⚪ 오프라인 (대기)'}
                        </Badge>
                      </Stack>
                    </Group>

                    <Button
                      color="blue"
                      size="sm"
                      radius="md"
                      onClick={() => startScreenShare(station)}
                      leftSection={<IconScreenShare size={18} />}
                      style={{ fontWeight: 800 }}
                    >
                      화면 공유
                    </Button>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" size="sm" onClick={onClose}>
            {isSharing ? '창 닫기 (공유 유지)' : '닫기'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
