import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroHome from './hero-home';

describe('HeroHome Component', () => {
  it('renders the hero section without crashing', () => {
    render(<HeroHome />);
    const section = screen.getByRole('region', { name: /hero home/i });
    expect(section).toBeInTheDocument();
  });

  it('displays the correct heading', () => {
    render(<HeroHome />);
    const heading = screen.getByRole('heading', { name: /Lamby — Code at Light Speed/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H1');
  });

  it('displays the subtext', () => {
    render(<HeroHome />);
    const subtext = screen.getByText(/Neon-powered autonomous AI development/i);
    expect(subtext).toBeInTheDocument();
    expect(subtext.tagName).toBe('P');
  });

  it('renders the Get Started button', () => {
    render(<HeroHome />);
    const button = screen.getByRole('link', { name: /Get Started/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-cyan-500');
    expect(button).toHaveAttribute('href', '#');
  });

  it('renders the Learn More button', () => {
    render(<HeroHome />);
    const button = screen.getByRole('link', { name: /Learn More/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('border-cyan-400');
    expect(button).toHaveAttribute('href', '#');
  });

  it('renders the hero image', () => {
    render(<HeroHome />);
    const image = screen.getByAltText('Hero');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/images/hero-image.png');
  });
});