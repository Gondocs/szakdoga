import { describe, expect, it } from 'vitest';
import { specialNeedDetailLabel } from './specialNeeds';

describe('specialNeedDetailLabel', () => {
  it('a katalógusból ismert típust részesíti előnyben a szöveges leírással szemben', () => {
    const label = specialNeedDetailLabel({
      category: 'diet',
      type: 'vegan',
      description: 'ez nem jelenhet meg',
    });

    expect(label).toBe('Diétás igény (Vegán)');
  });

  it('a szabad szöveges leírást használja, ha a típus nincs a katalógusban', () => {
    const label = specialNeedDetailLabel({
      category: 'mobility',
      type: 'ismeretlen_kod',
      description: 'Ágyhoz kötött hozzátartozó',
    });

    expect(label).toBe('Mozgás-/érzékszervi korlátozottság (Ágyhoz kötött hozzátartozó)');
  });

  it('csak a kategória nevét adja vissza, ha sem típus, sem leírás nincs', () => {
    const label = specialNeedDetailLabel({ category: 'other' });

    expect(label).toBe('Egyéb');
  });

  it('a leírást használja, ha nincs típus megadva', () => {
    const label = specialNeedDetailLabel({
      category: 'medical',
      description: 'Napi inzulinbeadás szükséges',
    });

    expect(label).toBe('Egészségügyi (Napi inzulinbeadás szükséges)');
  });
});
