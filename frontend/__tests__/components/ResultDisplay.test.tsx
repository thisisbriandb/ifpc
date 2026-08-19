import { render, screen, fireEvent } from '@testing-library/react';
import ResultDisplay from '@/components/ResultDisplay';

describe('ResultDisplay Component', () => {
  const mockResult = {
    vp: 15.5,
    vp_cible: 10.0,
    k_calc: 15.5,
    statut: 'conforme',
    message: 'Traitement thermique conforme pour jus de pomme.',
    risque: {
      niveau: 'Faible',
      score: 1,
      couleur: 'green',
      conseil: 'Aucune action requise.',
    },
    parametres: {
      t_ref: 60.0,
      z: 7.0,
      d_ref: 1.0,
      microorganisme: 'Lactobacillus plantarum',
      produit: 'Jus de pomme',
      clarification: 'brut',
      procede: 'flash',
    },
    evaluations_multimicro: [
      {
        key: 'lacto',
        nom: 'Lactobacillus plantarum',
        t_ref: 60.0,
        z: 7.0,
        d_ref: 1.0,
        vp: 15.5,
        k_calc: 15.5,
        statut: 'conforme',
        message: 'Conforme avec k = 15.5.',
      },
    ],
  };

  test('renders micro-evaluation cards and compliance badges', () => {
    render(<ResultDisplay result={mockResult} />);

    expect(screen.getByText('Lactobacillus plantarum')).toBeInTheDocument();
    expect(screen.getByText('CONFORME')).toBeInTheDocument();
    expect(screen.getByText('15.5')).toBeInTheDocument();
  });

  test('opens and closes help modal when info button is clicked', () => {
    render(<ResultDisplay result={mockResult} />);

    const helpBtn = screen.getByText("Qu'est-ce que le facteur de réduction ?");
    fireEvent.click(helpBtn);

    expect(screen.getByText('Facteur de réduction (k)')).toBeInTheDocument();

    const closeBtn = screen.getByText('Fermer');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Facteur de réduction (k)')).not.toBeInTheDocument();
  });
});
