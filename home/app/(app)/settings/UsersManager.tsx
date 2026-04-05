"use client";

import { useEffect, useState } from "react";
import { Trash2, UserPlus, Loader2 } from "lucide-react";

interface SBUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export default function UsersManager() {
  const [users, setUsers] = useState<SBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    setAdding(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to add user");
      return;
    }
    setEmail("");
    setName("");
    fetchUsers();
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="mt-10">
      <div className="border-t border-slate-700 pt-8">
        <h2 className="text-lg font-semibold text-white mb-1">Admin — User Management</h2>
        <p className="text-slate-400 text-sm mb-6">
          Users added here can log in. Removing a user immediately revokes their access.
        </p>

        {/* Add user form */}
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-6">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-48 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-36 bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Add User
          </button>
        </form>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Users table */}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-slate-500 text-sm">No users yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`${i < users.length - 1 ? "border-b border-slate-700/50" : ""}`}
                  >
                    <td className="px-4 py-3 text-white">{u.email}</td>
                    <td className="px-4 py-3 text-slate-300">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove user"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
