import { useState, FormEvent, ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { ApiError } from "../lib/api";
import ThreeDButton from "../components/ui/ThreeDButton";
import InputField from "../components/ui/InputField";

const ROLE_OPTIONS = [
  "Home Care Assistant",
  "Registered Nurse",
  "Senior Care Assistant",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  fullName?: string;
  email?: string;
  role?: string;
  password?: string;
  confirmPassword?: string;
  consent?: string;
  form?: string;
}

export default function SignupScreen() {
  const { signup } = useAppContext();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ROLE_OPTIONS[0]);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- live validation helpers ------------------------------------------------
  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (password !== confirmPassword)
      next.confirmPassword = "Passwords do not match.";
    if (!consent) next.consent = "You must accept the data policy to continue.";
    return next;
  }

  function touchField(field: keyof FieldErrors) {
    setErrors((prev) => {
      const all = validate();
      return { ...prev, [field]: all[field] };
    });
  }

  // ---- submit -----------------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await signup(
        email.trim(), password, fullName.trim(), role,
        employeeId.trim() || undefined,
      );
      navigate("/dashboard");
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : 0;
      const detail = err instanceof ApiError ? err.detail
        : err instanceof Error ? err.message : "";

      if (status === 409) {
        setErrors({ form: "An account with this email already exists. Please log in." });
      } else if (status === 400) {
        setErrors({ form: detail || "Please check your details and try again." });
      } else if (status === 429) {
        setErrors({ form: "Too many attempts. Please wait a few minutes and try again." });
      } else if (err instanceof TypeError) {
        setErrors({ form: "Cannot reach the server. Please check your connection." });
      } else {
        setErrors({ form: detail || "Something went wrong. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- render -----------------------------------------------------------------
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow"
        noValidate
      >
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-800">
          Create an account
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Join CareSync — Caregiver-First Operating System
        </p>

        {/* Server-level error banner */}
        {errors.form && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errors.form}
          </div>
        )}

        {/* Full name */}
        <div className="mb-4">
          <InputField
            label="Full name"
            value={fullName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            onBlur={() => touchField("fullName")}
            placeholder="Jane Doe"
            error={errors.fullName}
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <InputField
            label="Email"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            onBlur={() => touchField("email")}
            placeholder="you@example.com"
            error={errors.email}
          />
        </div>

        {/* Role dropdown */}
        <div className="mb-4">
          <label htmlFor="signup-role" className="mb-1 block text-sm font-medium text-gray-600">
            Role
          </label>
          <select
            id="signup-role"
            value={role}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
            onBlur={() => touchField("role")}
            className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.role && <p className="mt-1 text-sm text-red-600" role="alert">{errors.role}</p>}
        </div>

        {/* Employee ID (optional) */}
        <div className="mb-4">
          <InputField
            label="Employee ID (optional)"
            value={employeeId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value)}
            placeholder="EMP-001"
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            onBlur={() => touchField("password")}
            placeholder="At least 8 characters"
            error={errors.password}
          />
        </div>

        {/* Confirm password */}
        <div className="mb-4">
          <InputField
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            onBlur={() => touchField("confirmPassword")}
            placeholder="Re-enter your password"
            error={errors.confirmPassword}
          />
        </div>

        {/* Consent */}
        <label className="mb-6 flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setConsent(e.target.checked);
              if (e.target.checked) setErrors((prev) => ({ ...prev, consent: undefined }));
            }}
            className="mt-1"
          />
          <span className="text-sm text-gray-600">
            I consent to the CareSync{" "}
            <span className="font-medium">data policy</span> and agree to the
            processing of my personal data.
          </span>
        </label>
        {errors.consent && (
          <p className="-mt-4 mb-4 text-sm text-red-600" role="alert">{errors.consent}</p>
        )}

        {/* Submit */}
        <ThreeDButton
          type="submit"
          label={isSubmitting ? "Creating account…" : "Create account"}
          disabled={isSubmitting}
          loading={isSubmitting}
        />

        {/* Link back to login */}
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}