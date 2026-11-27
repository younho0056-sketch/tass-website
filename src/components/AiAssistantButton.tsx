"use client";

import { Button, type ButtonProps } from '@mantine/core';
import { IconRobot } from '@tabler/icons-react';
import { openTassAi } from '@/lib/tassAi';

type Props = Omit<ButtonProps, 'variant' | 'children'> & {
  /** banner: 페이지 상단 배너용 / header: 상단 메뉴 줄용 (작게) */
  look?: 'banner' | 'header';
};

/** 누르면 TASS AI 비서 창이 열린다 (휴대폰에서는 화면 전체로) */
export default function AiAssistantButton({ look = 'banner', style, ...rest }: Props) {
  const header = look === 'header';
  return (
    <Button
      {...rest}
      size={header ? 'xs' : 'sm'}
      radius="md"
      variant="filled"
      color="blue"
      px={header ? undefined : 10}
      className={header ? undefined : 'ai-banner-btn'}
      leftSection={<IconRobot size={header ? 15 : 16} />}
      onClick={openTassAi}
      style={{ fontWeight: 800, borderRadius: header ? 6 : undefined, ...(style as object) }}
    >
      AI 비서
    </Button>
  );
}
