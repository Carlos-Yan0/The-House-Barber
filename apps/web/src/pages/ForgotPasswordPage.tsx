// src/pages/ForgotPasswordPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";
import toast from "react-hot-toast";

export function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch {
      // Mesmo em erro de rede mostramos a tela de sucesso para não vazar info
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8">
          <Logo className="mb-8" />

          {!submitted ? (
            <>
              <h1 className="font-display text-3xl font-semibold text-white mb-2">
                Esqueceu a senha?
              </h1>
              <p className="text-[var(--text-secondary)] text-sm">
                Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-5">
                <CheckCircle size={24} className="text-emerald-400" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-white mb-2">
                E-mail enviado!
              </h1>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                Se <strong className="text-white">{email}</strong> estiver cadastrado, você receberá as instruções em breve.
              </p>
              <p className="text-[var(--text-muted)] text-xs mt-3">
                Não recebeu? Verifique a pasta de spam ou{" "}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-gold-400 hover:text-gold-300 underline transition-colors"
                >
                  tente novamente
                </button>
                .
              </p>
            </>
          )}
        </div>

        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              leftIcon={<Mail size={15} />}
              required
            />

            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={!email.trim()}
              className="w-full mt-2"
            >
              Enviar link de redefinição
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft size={12} />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}