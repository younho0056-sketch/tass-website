"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  OptionalPortal,
  Paper,
  Group,
  Text,
  Box,
  Badge,
  ActionIcon,
  TextInput,
  ScrollArea,
  Stack,
  Transition,
  Tooltip,
} from '@mantine/core';
import {
  IconRobot,
  IconX,
  IconSend,
  IconTrash,
  IconSparkles,
  IconChevronUp,
  IconPhoneCall,
  IconPackage,
  IconAlertCircle,
  IconChartBar,
  IconMicrophone,
  IconPlayerStopFilled,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@/context/AuthContext';
import { TASS_AI_OPEN_EVENT } from '@/lib/tassAi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ---- 음성 인식(말로 질문) / 음성 합성(답변 읽어주기) : 브라우저 내장 기능 사용 ----
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** 화면용 답변을 소리로 읽기 좋게 다듬는다 (마크다운·이모지 제거, 너무 길면 줄임) */
function toSpeech(text: string): string {
  let t = text
    .replace(/\*\*|__|`|#+\s/g, '')
    .replace(/^\s*[*\-•]\s+/gm, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (t.length > 700) t = `${t.slice(0, 700)}… 나머지는 화면에서 확인해 주세요.`;
  return t;
}

const VOICE_PREF_KEY = 'tass-ai-read-aloud';

export default function TassAiAssistant({ hideTriggerOnMobile = false }: { hideTriggerOnMobile?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { isAuthenticated, openAuthModal } = useAuth();
  const pendingOpenRef = useRef(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! **TASS 현장 AI 비서**입니다. 🤖\n\n거래처 연락처, 납품 건수, 공정 현황 등 필요하신 정보를 말씀해 주세요.',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 음성
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [readAloud, setReadAloud] = useState<boolean>(
    () => typeof window !== 'undefined' && window.localStorage.getItem(VOICE_PREF_KEY) === '1'
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && !isMobile) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isMobile]);

  // 창을 닫으면 듣기·읽기 중지
  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.abort();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  /** 사내 DB를 답하는 비서라서, PIN 인증 전에는 먼저 PIN을 받고 연다 (홈 화면은 누구나 볼 수 있음) */
  const requestOpen = () => {
    if (!isAuthenticated) {
      pendingOpenRef.current = true;
      const here = window.location.pathname;
      openAuthModal(here === '/' ? '/#ai' : here);
      return;
    }
    setIsOpen(true);
  };
  const requestOpenRef = useRef(requestOpen);
  useEffect(() => {
    requestOpenRef.current = requestOpen;
  });

  // 다른 화면의 'AI 비서' 버튼이 보내는 신호
  useEffect(() => {
    const onOpen = () => requestOpenRef.current();
    window.addEventListener(TASS_AI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TASS_AI_OPEN_EVENT, onOpen);
  }, []);

  // PIN 인증이 끝나면 기다리던 창을 연다
  useEffect(() => {
    if (isAuthenticated && pendingOpenRef.current) {
      pendingOpenRef.current = false;
      setIsOpen(true);
    }
  }, [isAuthenticated]);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  /** 답변을 소리로 읽기 (긴 글은 문장 단위로 나눠야 크롬에서 중간에 끊기지 않음) */
  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const clean = toSpeech(text);
    if (!clean) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const koVoice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ko'));
    const parts = clean.split(/(?<=[.?!])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      if (koVoice) u.voice = koVoice;
      if (i === 0) u.onstart = () => setSpeaking(true);
      if (i === parts.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      synth.speak(u);
    });
  };

  const toggleReadAloud = () => {
    const next = !readAloud;
    setReadAloud(next);
    window.localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0');
    if (!next) stopSpeaking();
  };

  const handleSend = async (userPrompt?: string, opts?: { voice?: boolean }) => {
    const query = (userPrompt || input).trim();
    if (!query || loading) return;
    const byVoice = opts?.voice === true;
    stopSpeaking();

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: byVoice,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('API 응답에 실패했습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: accumulatedText }
              : msg
          )
        );
      }

      // 말로 물어본 질문, 또는 '답변 읽어주기'를 켰을 때는 소리로 읽어 준다
      if (byVoice || readAloud) speak(accumulatedText);
    } catch (err: any) {
      console.error('Chat stream error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  '⚠️ 죄송합니다. DB 및 AI 시스템 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  /** 마이크 버튼: 누르고 말하면 말이 끝날 때 자동으로 질문을 보낸다 */
  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      alert('이 브라우저에서는 음성 인식을 쓸 수 없습니다. 휴대폰은 크롬(Chrome) 또는 사파리(Safari) 브라우저에서 사용해 주세요.');
      return;
    }
    // 아이폰은 버튼을 누른 순간에 소리 재생을 한 번 허용해 둬야 나중에 답변을 읽을 수 있다
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
    setSpeaking(false);

    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    transcriptRef.current = '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      transcriptRef.current = text;
      setInput(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        alert('마이크 사용이 막혀 있습니다. 브라우저 주소창 옆 설정에서 마이크를 허용해 주세요.');
      }
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = transcriptRef.current.trim();
      if (text) void handleSendRef.current(text, { voice: true });
    };
    recognitionRef.current = rec;
    setInput('');
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: '대화 내용이 초기화되었습니다. 무엇이든 질문해 주세요!',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    { label: '📞 거래처 연락처', prompt: '아크 담당자 연락처 알려줘', icon: IconPhoneCall },
    { label: '📦 이번달 납품 완료', prompt: '이번 달 납품 완료된 건 몇 개야?', icon: IconPackage },
    { label: '⚠️ 납기 임박 목록', prompt: '납기 임박한 수주 목록 알려줘', icon: IconAlertCircle },
    { label: '📊 공정 현황 요약', prompt: '전체 공정 현황 알려줘', icon: IconChartBar },
  ];

  return (
    <Box style={{ position: 'relative', width: '100%', zIndex: 99 }}>
      {/* Expanded Chat Window Popover (Opens Upward) */}
      <Transition transition="pop-bottom-left" duration={200} mounted={isOpen}>
        {(styles) => (
          <OptionalPortal withinPortal={!!isMobile}>
          <Paper
            shadow="xl"
            radius="lg"
            style={{
              ...styles,
              ...(isMobile
                ? { position: 'fixed', inset: 0, width: '100%', height: '100dvh', zIndex: 1000 }
                : { position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: '340px', height: '480px' }),
              backgroundColor: '#18181b', // Dark B&W monochrome theme
              color: '#ffffff',
              border: '1px solid #27272a',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: isMobile ? 0 : '16px',
            }}
          >
            {/* Header */}
            <Group
              justify="space-between"
              p="sm"
              style={{
                borderBottom: '1px solid #27272a',
                backgroundColor: '#09090b',
              }}
            >
              <Group gap={6} align="center">
                <Box
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconRobot size={18} />
                </Box>
                <div>
                  <Group gap={6} align="center">
                    <Text size="sm" fw={800} style={{ color: '#ffffff', lineHeight: 1.2 }}>
                      TASS AI 비서
                    </Text>
                    <Badge size="xs" color="gray" variant="filled" style={{ fontSize: '10px', height: '18px', padding: '0 5px' }}>
                      DB 실시간
                    </Badge>
                  </Group>
                  <Text size="10px" c="gray.5" style={{ lineHeight: 1 }}>
                    Supabase Live Sync
                  </Text>
                </div>
              </Group>

              <Group gap={4}>
                <Tooltip
                  label={speaking ? '읽기 멈추기' : readAloud ? '답변 읽어주기 끄기' : '모든 답변 소리로 읽어주기'}
                  position="top"
                  withArrow
                >
                  <ActionIcon
                    size="sm"
                    variant={readAloud ? 'filled' : 'subtle'}
                    color={readAloud ? 'blue' : 'gray'}
                    onClick={speaking ? stopSpeaking : toggleReadAloud}
                    style={{ borderRadius: '6px' }}
                    aria-label="답변 읽어주기"
                  >
                    {speaking ? <IconPlayerStopFilled size={14} /> : readAloud ? <IconVolume size={14} /> : <IconVolumeOff size={14} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="대화 내용 초기화" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    onClick={handleClear}
                    style={{ borderRadius: '6px' }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={() => setIsOpen(false)}
                  style={{ borderRadius: '6px' }}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            </Group>

            {/* Quick Suggestion Chips */}
            <Box p="xs" style={{ borderBottom: '1px solid #27272a', backgroundColor: '#18181b' }}>
              <Text size="11px" c="gray.4" mb={6} fw={600}>
                ⚡ 자주 묻는 질문 퀵 클릭
              </Text>
              <Group gap={4}>
                {quickPrompts.map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    color="gray"
                    size="sm"
                    style={{
                      cursor: 'pointer',
                      borderColor: '#3f3f46',
                      color: '#e4e4e7',
                      fontSize: '11px',
                      padding: '4px 8px',
                      height: 'auto',
                      textTransform: 'none',
                      backgroundColor: '#27272a',
                    }}
                    onClick={() => handleSend(item.prompt)}
                  >
                    {item.label}
                  </Badge>
                ))}
              </Group>
            </Box>

            {/* Message History Container */}
            <ScrollArea viewportRef={scrollRef} style={{ flex: 1 }} p="sm">
              <Stack gap="xs">
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                    }}
                  >
                    <Group gap={4} mb={2} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'}>
                      <Text size="10px" c="gray.5">
                        {msg.role === 'user' ? '사용자' : '🤖 TASS AI'} • {msg.timestamp}
                      </Text>
                    </Group>

                    <Paper
                      p="xs"
                      radius="md"
                      style={{
                        backgroundColor: msg.role === 'user' ? '#ffffff' : '#27272a',
                        color: msg.role === 'user' ? '#000000' : '#f4f4f5',
                        border: msg.role === 'user' ? 'none' : '1px solid #3f3f46',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content ? (
                        formatMarkdownText(msg.content)
                      ) : (
                        <Group gap={4} align="center">
                          <IconSparkles size={14} className="animate-spin" />
                          <Text size="xs" c="gray.4">
                            실시간 DB 정보 조회 중...
                          </Text>
                        </Group>
                      )}
                    </Paper>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>

            {/* Input Bar */}
            <Box p="xs" style={{ borderTop: '1px solid #27272a', backgroundColor: '#09090b' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Tooltip label={listening ? '듣는 중 — 누르면 멈춤' : '말로 질문하기'} withArrow>
                    <ActionIcon
                      type="button"
                      onClick={toggleListening}
                      disabled={loading}
                      size={isMobile ? 48 : 'md'}
                      radius="xl"
                      variant="filled"
                      color={listening ? 'red' : 'blue'}
                      className={listening ? 'animate-pulse' : undefined}
                      aria-label="말로 질문하기"
                      style={{ flexShrink: 0 }}
                    >
                      {listening ? <IconPlayerStopFilled size={isMobile ? 22 : 14} /> : <IconMicrophone size={isMobile ? 24 : 15} />}
                    </ActionIcon>
                  </Tooltip>
                  <TextInput
                    ref={inputRef}
                    placeholder={listening ? '듣고 있어요… 말씀하세요' : '질문을 입력하세요... (Enter 전송)'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                    size={isMobile ? 'md' : 'xs'}
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      input: {
                        backgroundColor: '#18181b',
                        color: '#ffffff',
                        borderColor: '#3f3f46',
                        borderRadius: '8px',
                        fontSize: isMobile ? '16px' : '12px',
                        '&:focus': {
                          borderColor: '#ffffff',
                        },
                      },
                    }}
                  />
                  <ActionIcon
                    type="submit"
                    color="white"
                    variant="filled"
                    size="md"
                    disabled={!input.trim() || loading}
                    style={{
                      borderRadius: '8px',
                      backgroundColor: input.trim() && !loading ? '#ffffff' : '#3f3f46',
                      color: '#000000',
                    }}
                  >
                    <IconSend size={14} />
                  </ActionIcon>
                </Group>
              </form>
              {isMobile && (
                <Text size="11px" c="gray.5" mt={6} ta="center">
                  🎤 파란 마이크를 누르고 말씀하시면 답변을 소리로 읽어 드립니다
                </Text>
              )}
            </Box>
          </Paper>
          </OptionalPortal>
        )}
      </Transition>

      {/* Mini Card Widget Trigger (Sidebar Bottom) */}
      <Paper
        p="xs"
        radius="md"
        visibleFrom={hideTriggerOnMobile ? 'sm' : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : requestOpen())}
        style={{
          cursor: 'pointer',
          backgroundColor: isOpen ? '#18181b' : '#f8fafc',
          border: isOpen ? '1px solid #27272a' : '1px solid #e2e8f0',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: isOpen ? '#ffffff' : '#09090b',
                color: isOpen ? '#000000' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconRobot size={18} />
            </Box>
            <div style={{ overflow: 'hidden' }}>
              <Group gap={6} align="center" wrap="nowrap">
                <Text size="xs" fw={800} style={{ color: isOpen ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap' }}>
                  🤖 TASS AI 비서
                </Text>
                <Badge
                  size="xs"
                  color={isOpen ? 'gray' : 'blue'}
                  variant="filled"
                  style={{ fontSize: '9px', height: '16px', padding: '0 4px' }}
                >
                  LIVE DB
                </Badge>
              </Group>
              <Text
                size="10px"
                style={{
                  color: isOpen ? '#a1a1aa' : '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                무엇이든 물어보세요 (거래처, 납품건수)
              </Text>
            </div>
          </Group>

          <ActionIcon
            size="xs"
            variant="subtle"
            color={isOpen ? 'gray' : 'dark'}
            style={{ flexShrink: 0 }}
          >
            <IconChevronUp
              size={14}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </ActionIcon>
        </Group>
      </Paper>
    </Box>
  );
}

// Helper: Bold parsing for markdown formatting
function formatMarkdownText(text: string) {
  const parts = text.replace(/^(\s*)[*-]\s+/gm, '$1• ').split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
