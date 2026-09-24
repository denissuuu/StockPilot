import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { Button, Input } from "../components/ui";

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/app/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return <div className="login-loading"><div className="brand-mark brand-mark--large"><span /><span /><span /></div></div>;
  }
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Renseignez votre adresse e-mail et votre mot de passe.");
      return;
    }
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      const destination = (location.state as LocationState | null)?.from;
      navigate(destination?.startsWith("/app") ? destination : "/app/dashboard", { replace: true });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, "Identifiants incorrects. Vérifiez votre adresse et votre mot de passe."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual" aria-label="Présentation de StockPilot">
        <div className="login-visual-glow login-visual-glow--one" />
        <div className="login-visual-glow login-visual-glow--two" />
        <div className="login-visual-content">
          <div className="login-brand"><div className="brand-mark"><span /><span /><span /></div><strong>Stock<span>Pilot</span></strong></div>
          <div className="login-hero-copy">
            <span className="eyebrow eyebrow--light">Pilotage intelligent</span>
            <h1>Le contrôle total de vos stocks, <em>en un coup d'œil.</em></h1>
            <p>Anticipez les ruptures, optimisez vos approvisionnements et pilotez votre performance depuis un espace unique.</p>
          </div>
          <div className="login-preview-card">
            <div className="preview-card-top"><span>Vue d'ensemble</span><span className="preview-live"><i /> En direct</span></div>
            <div className="preview-value">184 260 € <small>+12,8%</small></div>
            <div className="preview-chart" aria-hidden="true">
              <svg viewBox="0 0 420 90" preserveAspectRatio="none"><defs><linearGradient id="login-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5ee7b7" stopOpacity=".3" /><stop offset="1" stopColor="#5ee7b7" stopOpacity="0" /></linearGradient></defs><path d="M0 74 C24 67 31 69 49 60 S78 68 96 50 S125 59 143 42 S170 48 188 36 S216 44 233 25 S260 38 278 28 S307 31 325 16 S360 25 380 11 S402 18 420 4 V90 H0Z" fill="url(#login-chart-fill)" /><path d="M0 74 C24 67 31 69 49 60 S78 68 96 50 S125 59 143 42 S170 48 188 36 S216 44 233 25 S260 38 278 28 S307 31 325 16 S360 25 380 11 S402 18 420 4" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" /></svg>
            </div>
            <div className="preview-stats"><span><i className="dot dot--green" /> 1 248 références</span><span><i className="dot dot--amber" /> 18 alertes</span></div>
          </div>
          <div className="login-trust-row"><span><ShieldCheck size={15} /> Données sécurisées</span><span><Sparkles size={15} /> Interface pensée pour l'action</span></div>
        </div>
      </section>
      <section className="login-form-section">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><div className="brand-mark"><span /><span /><span /></div><strong>Stock<span>Pilot</span></strong></div>
          <div className="login-heading"><span className="eyebrow">Bon retour parmi nous</span><h2>Connectez-vous à votre espace</h2><p>Accédez à vos données et pilotez votre activité depuis un espace unique.</p></div>
          {error ? <div className="login-error" role="alert"><span>!</span>{error}</div> : null}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <Input label="Adresse e-mail" type="email" autoComplete="email" placeholder="vous@entreprise.com" value={email} onChange={(event) => setEmail(event.target.value)} leftIcon={<Mail size={17} />} required />
            <div className="password-field-wrap">
              <Input label="Mot de passe" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <div className="login-options"><label className="checkbox-label"><input type="checkbox" /> <span>Se souvenir de moi</span></label><a href="#forgot-password" onClick={(event) => event.preventDefault()}>Mot de passe oublié ?</a></div>
            <Button type="submit" size="lg" isLoading={isSubmitting} className="login-submit" rightIcon={!isSubmitting ? <ArrowRight size={18} /> : undefined}>Se connecter</Button>
          </form>
          <div className="login-footer-note"><LockKeyhole size={14} /> Connexion sécurisée via cookie HttpOnly</div>
          <div className="login-benefits"><div><Check size={14} /><span> stocks à jour</span></div><div><TrendingUp size={14} /><span>indicateurs en temps réel</span></div></div>
        </div>
      </section>
    </div>
  );
}
