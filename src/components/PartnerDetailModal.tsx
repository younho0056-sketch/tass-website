"use client";

import { Fragment, type ReactNode } from 'react';
import { Modal, Badge, Text, Group, Button, Stack, SimpleGrid, Anchor, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMapPin, IconPencil, IconPrinter } from '@tabler/icons-react';

export type PartnerDetail = {
  id: number;
  type: string;
  name: string;
  manager: string | null;
  email: string | null;
  phone: string | null;
  tel: string | null;
  fax: string | null;
  specialty: string;
  address: string | null;
  memo: string | null;
};

type Props = {
  partner: PartnerDetail | null;
  opened: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onEdit?: (partner: PartnerDetail) => void;
  onPrintLabel?: (partner: PartnerDetail) => void;
};

// 전화번호(지역번호/휴대폰/대표번호) 패턴 — 문자열 안의 번호만 골라 전화 링크로 만든다
const PHONE_RE = /(0\d{1,2}[-.)\s]?\d{3,4}[-.\s]?\d{4}|1[5-9]\d{2}-\d{4})/g;
const EMAIL_RE = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** 텍스트 안의 전화번호·이메일을 눌러서 바로 걸거나 보낼 수 있는 링크로 바꾼다 */
function linkify(text: string, re: RegExp, toHref: (match: string) => string): ReactNode[] {
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <Anchor
        key={i}
        href={toHref(part)}
        c="blue.7"
        fw={600}
        underline="always"
        style={{ whiteSpace: 'nowrap' }} // 번호 중간에서 줄바꿈되지 않게
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </Anchor>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

const telLinks = (text: string) => linkify(text, PHONE_RE, (n) => `tel:${n.replace(/[^\d]/g, '')}`);
const mailLinks = (text: string) => linkify(text, EMAIL_RE, (m) => `mailto:${m}`);

/** "취급: A, B | 기타 메모" 형식의 비고를 세부 품목과 나머지 비고로 나눈다 */
function splitMemo(memo: string | null) {
  if (!memo) return { items: '', note: '' };
  const parts = memo.split(/\s*\|\s*/).filter(Boolean);
  const itemPart = parts.find((p) => /^취급\s*:/.test(p));
  return {
    items: itemPart ? itemPart.replace(/^취급\s*:\s*/, '') : '',
    note: parts.filter((p) => p !== itemPart).join(' / '),
  };
}

/** "본사: 주소 / 공장: 주소" 형식의 주소를 지점별로 나눈다 (지점마다 지도 버튼) */
function splitAddresses(address: string | null) {
  if (!address) return [];
  return address
    .split(/\s+\/\s+/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^([^:]{1,40}):\s*(.+)$/);
      const label = m ? m[1].trim() : '';
      const full = m ? m[2].trim() : seg;
      // 지도 검색 정확도를 위해 괄호 속 동/호수 정보는 검색어에서 뺀다
      const query = full.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      return { label, full, query };
    });
}

function isMobileDevice() {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 모바일은 지도 앱을 먼저 열고(설치 안 됐으면 웹 지도로), PC는 새 탭에 웹 지도를 연다 */
function openMap(provider: 'kakao' | 'naver', query: string) {
  const q = encodeURIComponent(query);
  const webUrl =
    provider === 'kakao'
      ? `https://map.kakao.com/link/search/${q}`
      : `https://map.naver.com/p/search/${q}`;

  if (!isMobileDevice()) {
    window.open(webUrl, '_blank', 'noopener');
    return;
  }

  const appUrl =
    provider === 'kakao'
      ? `kakaomap://search?q=${q}`
      : `nmap://search?query=${q}&appname=${encodeURIComponent(window.location.hostname)}`;

  // 앱이 열리면 페이지가 백그라운드로 가므로, 1.5초 뒤에도 화면에 남아 있으면 웹 지도로 이동
  const fallback = window.setTimeout(() => {
    if (!document.hidden) window.location.href = webUrl;
  }, 1500);
  const cancel = () => {
    if (document.hidden) window.clearTimeout(fallback);
  };
  document.addEventListener('visibilitychange', cancel, { once: true });
  window.location.href = appUrl;
}

function Field({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <Box style={span ? { gridColumn: '1 / -1' } : undefined}>
      <Text size="xs" c="dimmed" fw={600} mb={4}>
        {label}
      </Text>
      <Box
        px="sm"
        py={8}
        style={{
          backgroundColor: '#F8FAFC',
          borderRadius: 10,
          minHeight: 38,
          fontSize: 'var(--mantine-font-size-sm)',
          color: '#111827',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
          lineHeight: 1.5,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function PartnerDetailModal({ partner, opened, onClose, canEdit, onEdit, onPrintLabel }: Props) {
  const isSmallScreen = useMediaQuery('(max-width: 48em)');

  const tags = partner?.specialty ? partner.specialty.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const [managerName, ...managerTitle] = (partner?.manager || '').trim().split(/\s+/);
  const { items, note } = splitMemo(partner?.memo ?? null);
  const addresses = splitAddresses(partner?.address ?? null);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen={!!isSmallScreen}
      size="xl"
      centered
      zIndex={300}
      withinPortal
      title={
        partner && (
          <Group gap="sm" wrap="nowrap">
            <Badge variant="outline" color="gray" radius="sm" size="md" style={{ flexShrink: 0 }}>
              {partner.type}
            </Badge>
            <div>
              <Text fw={800} size="lg" lh={1.2}>
                거래처 상세
              </Text>
              <Text size="sm" c="dimmed">
                {partner.name}
              </Text>
            </div>
          </Group>
        )
      }
    >
      {partner && (
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="sm" verticalSpacing="sm">
            <Field label="회사명">{partner.name}</Field>
            <Field label="분류">{tags[0] || '-'}</Field>

            <Field label="담당자 / 직급">
              {managerName ? (
                <>
                  <Text span fw={700} size="sm">
                    {managerName}
                  </Text>
                  {managerTitle.length > 0 && (
                    <Text span c="dimmed" size="sm" ml={6}>
                      {managerTitle.join(' ')}
                    </Text>
                  )}
                </>
              ) : (
                '-'
              )}
            </Field>
            <Field label="휴대폰번호">{partner.phone ? telLinks(partner.phone) : '-'}</Field>

            <Field label="일반 연락처">{partner.tel ? telLinks(partner.tel) : '-'}</Field>
            <Field label="팩스번호">{partner.fax || '-'}</Field>

            <Field label="이메일">{partner.email ? mailLinks(partner.email) : '-'}</Field>
            <Field label="품목">{tags.slice(1).join(', ') || '-'}</Field>

            <Field label="세부 품목" span>
              {items || '-'}
            </Field>

            <Field label="소재지(주소)" span>
              {addresses.length === 0
                ? '-'
                : addresses.map((a, i) => (
                    <Box key={i} mt={i > 0 ? 'sm' : 0}>
                      {a.label && (
                        <Text size="xs" fw={700} c="blue.8">
                          {a.label}
                        </Text>
                      )}
                      <Text size="sm">{a.full}</Text>
                      <Group gap={6} mt={6}>
                        <Button
                          size="xs"
                          variant="default"
                          leftSection={<IconMapPin size={14} color="#3b82f6" />}
                          onClick={() => openMap('kakao', a.query)}
                        >
                          카카오맵
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          leftSection={<IconMapPin size={14} color="#22c55e" />}
                          onClick={() => openMap('naver', a.query)}
                        >
                          네이버 지도
                        </Button>
                      </Group>
                    </Box>
                  ))}
            </Field>

            {note && (
              <Field label="비고" span>
                {note}
              </Field>
            )}
          </SimpleGrid>

          {(onPrintLabel || (canEdit && onEdit)) && (
            <Group justify="flex-end" gap="xs">
              {onPrintLabel && (
                <Button variant="default" size="sm" leftSection={<IconPrinter size={15} />} onClick={() => onPrintLabel(partner)}>
                  송장 출력
                </Button>
              )}
              {canEdit && onEdit && (
                <Button color="dark" size="sm" leftSection={<IconPencil size={15} />} onClick={() => onEdit(partner)}>
                  정보 수정
                </Button>
              )}
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}
