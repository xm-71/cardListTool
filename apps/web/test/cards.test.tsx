import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { CardInstance, SlotView as SlotViewData } from '@ptcg/engine';
import { CardView } from '../src/ui/CardView.tsx';
import { SlotView } from '../src/ui/SlotView.tsx';

const gastly: CardInstance = { uid: 'p0-c1', defId: 'me02-054', owner: 0 };
const dark: CardInstance = { uid: 'p0-c50', defId: 'mee-007', owner: 0 };
const slot = (over: Partial<SlotViewData> = {}): SlotViewData => ({
  stack: [gastly],
  energy: [],
  tool: null,
  damage: 0,
  conditions: { rotation: 'none', poisoned: false, burned: false },
  enteredTurn: 0,
  evolvedTurn: null,
  abilityUsedTurn: {},
  cantAttackOnTurn: null,
  attackLocks: {},
  markers: [],
  becameActiveTurn: null,
  ...over,
});

describe('CardView', () => {
  test('loads the TCGdex image for the card', () => {
    render(<CardView card={gastly} />);
    expect(screen.getByRole('img', { name: 'Gastly' })).toHaveAttribute(
      'src',
      'https://assets.tcgdex.net/en/me/me02/054/low.webp',
    );
  });

  test('falls back to a readable text card when the image fails to load', () => {
    render(<CardView card={gastly} />);
    fireEvent.error(screen.getByRole('img', { name: 'Gastly' }));
    expect(screen.queryByRole('img', { name: 'Gastly' })).toBeNull();
    expect(screen.getByText('Gastly')).toBeInTheDocument();
    expect(screen.getByText('70 HP')).toBeInTheDocument();
    expect(screen.getByText(/Petty Grudge/)).toBeInTheDocument();
  });
});

describe('SlotView', () => {
  test('shows remaining HP out of the maximum', () => {
    render(<SlotView slot={slot({ damage: 50 })} />);
    expect(screen.getByText('20/70')).toBeInTheDocument();
  });

  test('shows special condition badges and attached Energy', () => {
    render(
      <SlotView
        slot={slot({ energy: [dark], conditions: { rotation: 'asleep', poisoned: true, burned: false } })}
      />,
    );
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
    expect(screen.getByText('Asleep')).toBeInTheDocument();
    expect(screen.getByTitle('Darkness Energy')).toBeInTheDocument();
  });
});
