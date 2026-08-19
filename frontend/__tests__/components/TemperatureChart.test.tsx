import { render, screen, fireEvent } from '@testing-library/react';
import TemperatureChart from '@/components/TemperatureChart';
import { I18nProvider } from '@/lib/i18n';

describe('TemperatureChart Component', () => {
  const mockCourbe = {
    temps: [0, 5, 10, 15, 20],
    temperatures: [20, 60, 72, 72, 20],
    taux_letaux: [0, 0.1, 1.0, 1.0, 0],
    vp_cumulee: [0, 0.5, 5.5, 10.5, 10.5],
  };

  const renderComponent = (props = {}) => {
    return render(
      <I18nProvider>
        <div style={{ width: 800, height: 400 }}>
          <TemperatureChart
            courbe={mockCourbe}
            tRef={60.0}
            vpCible={10.0}
            {...props}
          />
        </div>
      </I18nProvider>
    );
  };

  test('renders chart view buttons and legend', () => {
    renderComponent();

    expect(screen.getAllByText('Température (°C)')[0]).toBeInTheDocument();
    expect(screen.getByText('VP (UP)')).toBeInTheDocument();
  });

  test('switches view mode when toggle button is clicked', () => {
    renderComponent();

    const vpBtn = screen.getByText('VP (UP)');
    fireEvent.click(vpBtn);

    expect(vpBtn).toHaveClass('bg-white');
  });
});
