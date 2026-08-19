import { render, screen, fireEvent } from '@testing-library/react';
import ProductSelector from '@/components/ProductSelector';
import { I18nProvider } from '@/lib/i18n';

describe('ProductSelector Component', () => {
  const defaultProps = {
    productType: 'jus_pomme',
    onProductChange: jest.fn(),
    microorganisme: '',
    onMicroChange: jest.fn(),
    procede: 'flash',
    onProcedeChange: jest.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <I18nProvider>
        <ProductSelector {...defaultProps} {...props} />
      </I18nProvider>
    );
  };

  test('renders fallback products and triggers product change handler', () => {
    renderComponent();

    const selects = screen.getAllByRole('combobox');
    const productSelect = selects[0];
    expect(productSelect).toHaveValue('jus_pomme');

    fireEvent.change(productSelect, { target: { value: 'cidre_doux' } });
    expect(defaultProps.onProductChange).toHaveBeenCalledWith('cidre_doux');
  });

  test('renders lot identifier input when handler provided', () => {
    const onLotIdentifierChange = jest.fn();
    renderComponent({ lotIdentifier: 'LOT-123', onLotIdentifierChange });

    const input = screen.getByDisplayValue('LOT-123');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'LOT-456' } });
    expect(onLotIdentifierChange).toHaveBeenCalledWith('LOT-456');
  });

  test('renders expert fields when expertMode is true', () => {
    renderComponent({ expertMode: true, tRef: '60.0', zValue: '7.0' });

    expect(screen.getByDisplayValue('60.0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7.0')).toBeInTheDocument();
  });
});
