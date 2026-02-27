import Link from "next/link";
import { FlaskConical, BarChart3, Settings } from "lucide-react";

const modules = [
  {
    href: "/controle",
    icon: FlaskConical,
    title: "Contrôle de pasteurisation",
    description:
      "Importez vos données température/temps (Excel, CSV, saisie manuelle ou copier-coller), calculez la Valeur Pasteurisatrice et visualisez la cinétique thermique.",
    color: "brand-primary",
    bgColor: "bg-brand-primary/10",
    features: [
      "Upload Excel / CSV",
      "Copier-coller depuis tableur",
      "Graphique de cinétique",
      "Diagnostic de conformité",
      "Indicateur de risque",
    ],
  },
  {
    href: "/bareme",
    icon: BarChart3,
    title: "Aide au choix du barème",
    description:
      "Sélectionnez votre produit et microorganisme cible pour obtenir les barèmes température/durée recommandés.",
    color: "brand-accent",
    bgColor: "bg-brand-accent/10",
    features: [
      "Barèmes par produit",
      "VP cible recommandée",
      "Table température / durée",
      "Paramètres Tref et Z",
    ],
  },
  {
    href: "/expert",
    icon: Settings,
    title: "Mode expert",
    description:
      "Accédez aux paramètres microbiologiques avancés, personnalisez Tref et Z, et consultez la base de données des microorganismes.",
    color: "brand-sand",
    bgColor: "bg-brand-sand/10",
    features: [
      "Table des microorganismes",
      "Tref / Z personnalisables",
      "Saisie pH et alcool",
      "Évaluation risque détaillée",
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 via-white to-brand-sand/5">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 font-clash bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            Pasteurisation cidricole
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Outil d&apos;aide au contrôle et au pilotage de la pasteurisation
            pour la filière cidricole — développé par l&apos;IFPC.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-brand-highlight/30 text-sm text-gray-700 px-4 py-2 rounded-full">
            Tref par défaut : <strong>60 °C</strong> — Z : <strong>7 °C</strong>
          </div>
        </div>

        {/* Modules */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-200"
              >
                <div className={`inline-flex p-3 ${mod.bgColor} rounded-xl mb-4`}>
                  <Icon className={`w-7 h-7 text-${mod.color}`} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">
                  {mod.title}
                </h2>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  {mod.description}
                </p>
                <ul className="space-y-1.5">
                  {mod.features.map((f) => (
                    <li key={f} className="text-sm text-gray-500 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full bg-${mod.color}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="text-center mt-14 text-sm text-gray-400">
          Méthode de calcul : Bigelow — VP = Σ L(T) × Δt
        </div>
      </div>
    </div>
  );
}
