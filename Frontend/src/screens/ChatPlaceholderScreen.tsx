import { useParams, useNavigate } from "react-router-dom";

export default function ChatPlaceholderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <button
        onClick={() => navigate(`/staff/${id}`)}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        ← Back
      </button>

      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-10 shadow">
        <p className="mb-2 text-4xl">💬</p>
        <h1 className="mb-2 text-xl font-bold text-gray-800">
          Chat — Coming soon
        </h1>
        <p className="text-sm text-gray-500">
          Messaging will be available in a future update.
        </p>
      </div>
    </div>
  );
}
