import { render, screen, fireEvent } from '@testing-library/react';
import LabColorPicker from '@/components/LabColorPicker';

describe('LabColorPicker Component', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation(() => ({
      clearRect: jest.fn(),
      createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(240 * 240 * 4) })),
      putImageData: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      lineTo: jest.fn(),
      moveTo: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      strokeRect: jest.fn(),
      setLineDash: jest.fn(),
    }));
  });

  const defaultProps = {
    L: 60.0,
    a: 10.0,
    b: 20.0,
    onChangeL: jest.fn(),
    onChangeA: jest.fn(),
    onChangeB: jest.fn(),
  };

  test('renders color preview, lightness slider and mode switcher', () => {
    render(<LabColorPicker {...defaultProps} />);

    expect(screen.getByText('Espace cidre')).toBeInTheDocument();
    expect(screen.getByText('Espace complet')).toBeInTheDocument();
    expect(screen.getByText('L*=60.0 a*=10.0 b*=20.0')).toBeInTheDocument();
  });

  test('switches color mode between cidre and full space', () => {
    render(<LabColorPicker {...defaultProps} />);

    const fullBtn = screen.getByText('Espace complet');
    fireEvent.click(fullBtn);

    expect(fullBtn).toHaveClass('bg-white');
  });

  test('cider space canvas is a rectangle (taller than the a*/b* half-disc was)', () => {
    const { container } = render(<LabColorPicker {...defaultProps} />);

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toHaveAttribute('width', '240');
    expect(canvas).toHaveAttribute('height', '240');
    // Rectangle : plus de découpe circulaire sur l'espace cidre
    expect(canvas.className).toContain('rounded-xl');
    expect(canvas.className).not.toContain('rounded-full');
  });

  test('flags a target that falls outside the cider rectangle', () => {
    render(<LabColorPicker {...defaultProps} a={100} b={20} />);

    expect(screen.getByText(/hors de l'espace cidre/i)).toBeInTheDocument();
  });

  test('triggers onChangeL when lightness slider is moved', () => {
    render(<LabColorPicker {...defaultProps} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75.5' } });

    expect(defaultProps.onChangeL).toHaveBeenCalledWith(75.5);
  });
});
