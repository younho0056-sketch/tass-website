"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
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
} from '@tabler/icons-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function TassAiAssistant() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! **TASS 실시간 AI 데이터 비서**입니다. 🤖\n\nSupabase DB와 실시간 연동되어 거래처 담당자 연락처, 이번달 납품 완료 건수, 납기 임박 수주 목록 등을 바로 안내해 드립니다.',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSend = async (userPrompt?: string) => {
    const query = (userPrompt || input).trim();
    if (!query || loading) return;

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
          <Paper
            shadow="xl"
            radius="lg"
            style={{
              ...styles,
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: 0,
              width: '340px',
              height: '480px',
              backgroundColor: '#18181b', // Dark B&W monochrome theme
              color: '#ffffff',
              border: '1px solid #27272a',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '16px',
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
                <Group gap={6}>
                  <TextInput
                    ref={inputRef}
                    placeholder="질문을 입력하세요... (Enter 전송)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                    size="xs"
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        backgroundColor: '#18181b',
                        color: '#ffffff',
                        borderColor: '#3f3f46',
                        borderRadius: '8px',
                        fontSize: '12px',
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
            </Box>
          </Paper>
        )}
      </Transition>

      {/* Mini Card Widget Trigger (Sidebar Bottom) */}
      <Paper
        p="xs"
        radius="md"
        onClick={() => setIsOpen(!isOpen)}
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
  const parts = text.split(/(\*\*.*?\*\*)/g);
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
