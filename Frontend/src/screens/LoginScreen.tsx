import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import ThreeDButton from "../components/ui/ThreeDButton";
import InputField from "../components/ui/InputField";

export default function LoginScreen() {
  const { login, loginError } = useAppContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim() !== "" && password.trim() !== "" && !isSubmitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      // error is shown via loginError from context
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow"
      >
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-800">
          CareSync
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Caregiver-First Operating System
        </p>

        {/* Error message */}
        {loginError && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {loginError}
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {/* Submit */}
        <ThreeDButton
          type="submit"
          label={isSubmitting ? "Logging in…" : "Log In"}
          disabled={!canSubmit}
          loading={isSubmitting}
        />

        {/* Link to signup */}
        <p className="mt-4 text-center text-sm text-gray-500">
          New here?{" "}
          <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-500">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
