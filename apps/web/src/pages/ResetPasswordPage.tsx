// src/pages/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";
import { Input, Button } from "@/components/ui";
import toast from "react-hot-toast";

export function ResetPasswordPage() {
  const [searchParams]            = useSearchParams();
  const navigate                  = useNavigate();
  const token                     = searchParams.get("token") ?? "";

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Se não tem token na URL, redireciona para esqueci a senha
  useEffect(() => {
    if (!token) navigate("/esqueci-senha", { replace: true });
  }, [token, navigate]);

  const passwordsMatch = password === confirm;
  const isValid        = password.length >= 8 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setError("");
    setLoading(true);

    try {
      await authApi.resetPassword(token, password);
      toast.success("Senha redefinida! Faça login.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error ?? "Erro ao redefinir senha. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8">
          <Logo className="mb-8" />

          <div className="w-14 h-14 rounded-2xl bg-gold-600/15 border border-gold-600/25 flex items-center justify-center mb-5">
            <KeyRound size={24} className="text-gold-500" />
          </div>

          <h1 className="font-display text-3xl font-semibold text-white mb-2">
            Nova senha
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Escolha uma senha forte com pelo menos 8 caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nova senha */}
          <div className="relative">
            <Input
              label="Nova senha"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              hint={password.length > 0 && password.length < 8 ? "Mínimo 8 caracteres" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-[38px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Confirmar senha */}
          <div className="relative">
            <Input
              label="Confirmar nova senha"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              error={confirm.length > 0 && !passwordsMatch ? "As senhas não coincidem" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-[38px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Erro do servidor */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={!isValid}
            className="w-full mt-2"
          >
            Redefinir senha
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            ← Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}