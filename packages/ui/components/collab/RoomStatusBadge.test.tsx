import { describe, expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { RoomStatusBadge } from './RoomStatusBadge';

function label(el: HTMLElement): string {
  const badge = el.querySelector('[data-testid="room-status-badge"]');
  return badge?.getAttribute('data-status-label') ?? '';
}

describe('RoomStatusBadge', () => {
  test('renders "Live" when authenticated', () => {
    const { container } = render(
      <RoomStatusBadge connectionStatus="authenticated" />,
    );
    expect(label(container)).toBe('Live');
  });

  test('renders "Connecting" during connecting/authenticating', () => {
    const { container, rerender } = render(
      <RoomStatusBadge connectionStatus="connecting" />,
    );
    expect(label(container)).toBe('Connecting');
    rerender(<RoomStatusBadge connectionStatus="authenticating" />);
    expect(label(container)).toBe('Connecting');
  });

  test('renders "Reconnecting" during reconnect', () => {
    const { container } = render(
      <RoomStatusBadge connectionStatus="reconnecting" />,
    );
    expect(label(container)).toBe('Reconnecting');
  });

  test('renders "Offline" when disconnected or closed', () => {
    const { container, rerender } = render(
      <RoomStatusBadge connectionStatus="disconnected" />,
    );
    expect(label(container)).toBe('Offline');
    rerender(<RoomStatusBadge connectionStatus="closed" />);
    expect(label(container)).toBe('Offline');
  });
});
