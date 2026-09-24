import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";

export function ForbiddenPage() {
  const navigate = useNavigate();
  return <div className="status-page"><div className="status-icon status-icon--amber"><ShieldAlert size={28} /></div><span className="eyebrow">Accès restreint</span><h1>Cette page n'est pas dans votre périmètre</h1><p>Votre rôle ne vous permet pas d'accéder à cette section. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.</p><div className="status-actions"><Button onClick={() => navigate(-1)} leftIcon={<ArrowLeft size={16} />}>Retour</Button><Link className="button button--secondary button--md" to="/app/dashboard">Aller au tableau de bord</Link></div><div className="status-footnote"><LockKeyhole size={14} /> Vos droits sont gérés par l'équipe d'administration.</div></div>;
}
