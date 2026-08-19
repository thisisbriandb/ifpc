import { render, screen } from '@testing-library/react';
import CuveSVG from '@/components/CuveSVG';

describe('CuveSVG Component', () => {
  test('renders cuve name and empty state when volume is 0 and PROPRE', () => {
    render(<CuveSVG nom="Cuve A" volumeMax={1000} volumeOccupe={0} statutPhysique="PROPRE" />);

    expect(screen.getByText('Cuve A')).toBeInTheDocument();
    expect(screen.getByText('Vide')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  test('renders volume percentage and lot identifiant when occupied', () => {
    render(
      <CuveSVG
        nom="Cuve B"
        volumeMax={1000}
        volumeOccupe={500}
        statutPhysique="PROPRE"
        lotIdentifiant="LOT-999"
        colorHex="#FFAA00"
      />
    );

    expect(screen.getByText('Cuve B')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('500 hl')).toBeInTheDocument();
    expect(screen.getByText('LOT-999')).toBeInTheDocument();
  });

  test('renders sale status badge when empty and SALE', () => {
    render(<CuveSVG nom="Cuve C" volumeMax={1000} volumeOccupe={0} statutPhysique="SALE" />);

    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByTitle('Cuve sale — nettoyage requis')).toBeInTheDocument();
  });

  test('applies drag target rings when dragState is valid-target', () => {
    const { container } = render(
      <CuveSVG nom="Cuve D" volumeMax={1000} volumeOccupe={0} statutPhysique="PROPRE" dragState="valid-target" />
    );

    expect(container.firstChild).toHaveClass('ring-green-400');
  });
});
