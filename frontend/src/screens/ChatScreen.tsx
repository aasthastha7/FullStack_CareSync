import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  apiGetStaffMember,
  apiGetChatMessages,
  apiSendChatMessage,
  type StaffMember,
  type ChatMessage,
} from "../lib/api";
import { formatTime } from "../lib/utils";
import ThreeDButton from "../components/ui/ThreeDButton";

const QUICK_REPLIES = ["Will re-check in 15m", "Request RN Call"];

export default function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [colleague, setColleague] = useState<StaffMember | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load colleague + chat history
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([apiGetStaffMember(id), apiGetChatMessages(id)])
      .then(([staff, msgs]) => {
        setColleague(staff);
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) return <div className="mx-auto max-w-md px-4 py-8"><p className="text-gray-500">Loading…</p></div>;

  if (!colleague) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-gray-500">Colleague not found.</p>
        <button onClick={() => navigate("/search")} className="mt-4 text-sm text-blue-600 hover:underline">← Back</button>
      </div>
    );
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !id) return;
    setError(null);
    try {
      const saved = await apiSendChatMessage(id, trimmed);
      setMessages((prev) => [...prev, saved]);
      setInput("");
    } catch {
      setError("Failed to send. Try again.");
      // Keep input text so nothing is lost
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-md flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={() => navigate(`/staff/${id}`)} className="text-gray-500 hover:text-gray-700" aria-label="Back">←</button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-800">{colleague.name}</h1>
          <p className="text-xs text-gray-500">{colleague.role}</p>
        </div>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">🔒 HIPAA Secure Connection</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
        {messages.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300" />
            <span className="text-xs font-medium text-gray-400">Today</span>
            <div className="h-px flex-1 bg-gray-300" />
          </div>
        )}

        {messages.map((msg) => (
          <Bubble key={msg.id} sender={msg.sender} text={msg.text} time={formatTime(msg.created_at)} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div className="flex gap-2 border-t border-gray-200 bg-white px-4 py-2">
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr}
            onClick={() => handleSend(qr)}
            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(input); }}
            placeholder="Type a message…"
            className="flex-1 rounded-full border px-4 py-2 text-sm"
          />
          <ThreeDButton
            label="Send"
            onClick={() => handleSend(input)}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function Bubble({ sender, text, time }: { sender: "caregiver" | "colleague"; text: string; time: string }) {
  const isCaregiver = sender === "caregiver";
  return (
    <div className={`mb-3 flex ${isCaregiver ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isCaregiver ? "bg-blue-600 text-white" : "bg-white text-gray-800 shadow"}`}>
        <p className="text-sm">{text}</p>
        <p className={`mt-1 text-right text-xs ${isCaregiver ? "text-blue-200" : "text-gray-400"}`}>{time}</p>
      </div>
    </div>
  );
}