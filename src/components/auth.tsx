"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Layers3,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFeedback("");
    const form = new FormData(e.currentTarget),
      email = String(form.get("email")),
      password = String(form.get("password"));
    try {
      const db = getSupabase()!;
      if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setFeedback(
          "Se houver uma conta, você receberá um link para redefinir sua senha.",
        );
      } else if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session)
          setFeedback("Confira seu e-mail e confirme sua conta para entrar.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      const msg =
        e && typeof e === "object" && "message" in e ? String(e.message) : "";
      setError(
        msg.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : msg.includes("Email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : msg.includes("rate limit")
              ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
              : "Não foi possível continuar. Verifique sua conexão e as configurações do Supabase.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-mark">n</span>nexo
          <span className="brand-dot">.</span>
        </Link>
        <div className="story-content">
          <span className="eyebrow">
            <span className="tiny-dot" /> UM ESPAÇO PARA SUAS IDEIAS
          </span>
          <h1>
            Todo conhecimento
            <br />
            começa com uma
            <br />
            <em>conexão.</em>
          </h1>
          <p>
            Organize o que você aprende.
            <br />
            Descubra como tudo se conecta.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-center">
              <GitBranch size={34} />
              <span>Suas ideias</span>
            </div>
            <div className="art-pill art-a">
              <Layers3 size={17} /> Organizar
            </div>
            <div className="art-pill art-b">
              <Sparkles size={17} /> Conectar
            </div>
            <div className="art-pill art-c">Aprender, no seu ritmo.</div>
          </div>
        </div>
        <span className="story-footer">
          MENOS CONTEÚDO PERDIDO. MAIS DESCOBERTAS.
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">SEU UNIVERSO DE ESTUDOS</span>
          <h2>
            {mode === "signup"
              ? "Comece a conectar."
              : mode === "reset"
                ? "Vamos recuperar seu acesso."
                : "Bom ter você por aqui."}
          </h2>
          <p>
            {mode === "signup"
              ? "Crie sua conta e dê um lugar para cada ideia."
              : "Entre no seu espaço e continue de onde parou."}
          </p>
          <form onSubmit={submit}>
            <label>
              E-mail
              <div className="input-icon">
                <Mail size={17} />
                <input
                  name="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>
            {mode !== "reset" && (
              <label>
                Senha
                <div className="input-icon">
                  <LockKeyhole size={17} />
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    placeholder="Pelo menos 8 caracteres"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                  />
                </div>
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="text-button forgot"
                onClick={() => {
                  setMode("reset");
                  setFeedback("");
                  setError("");
                }}
              >
                Esqueci minha senha
              </button>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {feedback && (
              <p role="status" className="form-success">
                {feedback}
              </p>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "signup"
                  ? "Criar minha conta"
                  : mode === "reset"
                    ? "Enviar link"
                    : "Entrar no meu espaço"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login"
              ? "Ainda não tem uma conta?"
              : "Já tem uma conta?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setFeedback("");
                setError("");
              }}
            >
              {mode === "login" ? "Comece por aqui" : "Entrar"}
            </button>
          </p>
          <div className="privacy-note">
            <LockKeyhole size={14} /> Um espaço privado. Seus estudos são só
            seus.
          </div>
        </div>
      </section>
    </main>
  );
}
