import { ArrowLeft, Compass, Home, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function NotFoundPage() {
  return <div className="status-page"><div className="status-icon status-icon--blue"><Compass size={30} /></div><span className="eyebrow">Erreur 404</span><h1>Cette page a pris un autre chemin</h1><p>La ressource demandée n'existe pas ou a été déplacée. Utilisez la navigation pour retrouver votre espace.</p><div className="status-actions"><Link className="button button--primary button--md" to="/app/dashboard"><Home size={16} /> Tableau de bord</Link><Button variant="ghost" onClick={() => window.history.back()} leftIcon={<ArrowLeft size={16} />}>Page précédente</Button></div><div className="status-footnote"><SearchX size={14} /> StockPilot · Navigation sécurisée</div></div>;
}
