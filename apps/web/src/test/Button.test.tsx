import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '../shared/ui/Button';
import { IconButton } from '../shared/ui/IconButton';

describe('Button accessibility', () => {
  it('renders a native button with type=button by default and handles clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>콘텐츠 둘러보기</Button>);
    const btn = screen.getByRole('button', { name: '콘텐츠 둘러보기' });
    expect(btn).toHaveAttribute('type', 'button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('exposes aria-busy and disables interaction while loading', () => {
    render(<Button loading>로그인</Button>);
    const btn = screen.getByRole('button', { name: '로그인' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
  });

  it('renders router links and external anchors with safe rel/target', () => {
    render(<MemoryRouter><Button to="/catalog">전체 보기</Button><Button href="https://axis.example.com">AXIS 자격검정 바로가기</Button></MemoryRouter>);
    expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/catalog');
    const ext = screen.getByRole('link', { name: /AXIS 자격검정 바로가기/ });
    expect(ext).toHaveAttribute('target', '_blank');
    expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
    expect(ext).toHaveTextContent('↗');
    expect(ext).toHaveTextContent('(새 창)');
  });

  it('IconButton requires and exposes an accessible name', () => {
    render(<IconButton icon="search" label="콘텐츠 검색" />);
    const btn = screen.getByRole('button', { name: '콘텐츠 검색' });
    expect(btn).toHaveAttribute('aria-label', '콘텐츠 검색');
    expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
