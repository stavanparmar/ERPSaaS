import { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type JournalEntry = {
  id: string;
  entryDate: string;
  description: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  status: "draft" | "posted" | "reversed";
};

type LedgerSummary = {
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type TrialBalance = {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
};

type FinancialReport = {
  profitAndLoss: {
    revenue: number;
    operatingCost: number;
    netProfit: number;
  };
  cashAndReceivables: {
    receivablesCollected: number;
    outstandingReceivables: number;
  };
  journalControl: {
    postedDebit: number;
    postedCredit: number;
  };
};

const Accounting = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);

  const [journalForm, setJournalForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
    totalDebit: "0",
    totalCredit: "0",
    status: "draft",
  });

  const [dateFilter, setDateFilter] = useState({ fromDate: "", toDate: "" });

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (dateFilter.fromDate) {
      params.append("fromDate", new Date(dateFilter.fromDate).toISOString());
    }
    if (dateFilter.toDate) {
      params.append("toDate", new Date(dateFilter.toDate).toISOString());
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const query = buildQuery();
      const [entriesRes, ledgerRes, trialRes, reportRes] = await Promise.all([
        apiClient.get(`/accounting/journal-entries${query}`),
        apiClient.get(`/accounting/ledger${query}`),
        apiClient.get(`/accounting/trial-balance${query}`),
        apiClient.get(`/accounting/financial-reports${query}`),
      ]);

      setJournalEntries(entriesRes.data?.data ?? []);
      setLedgerSummary(ledgerRes.data?.data?.summary ?? null);
      setTrialBalance(trialRes.data?.data ?? null);
      setFinancialReport(reportRes.data?.data ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load accounting data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createJournalEntry = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post("/accounting/journal-entries", {
        entryDate: new Date(journalForm.entryDate).toISOString(),
        description: journalForm.description,
        reference: journalForm.reference || undefined,
        totalDebit: Number(journalForm.totalDebit),
        totalCredit: Number(journalForm.totalCredit),
        status: journalForm.status,
      });

      setJournalForm({
        entryDate: new Date().toISOString().slice(0, 10),
        description: "",
        reference: "",
        totalDebit: "0",
        totalCredit: "0",
        status: "draft",
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create journal entry");
    }
  };

  const updateJournalStatus = async (entryId: string, status: "draft" | "posted" | "reversed") => {
    try {
      await apiClient.patch(`/accounting/journal-entries/${entryId}/status`, { status });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update journal status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Accounting / GL</h1>
          <p className="text-sm text-gray-600">Journal entries, ledger, trial balance, and financial reports.</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Reporting Period Filter</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={dateFilter.fromDate}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={dateFilter.toDate}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, toDate: e.target.value }))}
          />
          <button
            onClick={() => void loadData()}
            className="rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
          >
            Apply Filter
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Ledger Debit</p>
          <p className="text-xl font-semibold text-gray-900">{ledgerSummary?.totalDebit.toFixed(2) ?? "0.00"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Ledger Credit</p>
          <p className="text-xl font-semibold text-gray-900">{ledgerSummary?.totalCredit.toFixed(2) ?? "0.00"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Trial Difference</p>
          <p className={`text-xl font-semibold ${Math.abs(trialBalance?.difference ?? 0) <= 0.001 ? "text-emerald-600" : "text-red-600"}`}>
            {trialBalance?.difference.toFixed(2) ?? "0.00"}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-500">Net Profit</p>
          <p className={`text-xl font-semibold ${(financialReport?.profitAndLoss.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {financialReport?.profitAndLoss.netProfit.toFixed(2) ?? "0.00"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Financial Summary</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>Revenue: <span className="font-medium">{financialReport?.profitAndLoss.revenue.toFixed(2) ?? "0.00"}</span></p>
            <p>Operating Cost: <span className="font-medium">{financialReport?.profitAndLoss.operatingCost.toFixed(2) ?? "0.00"}</span></p>
            <p>Receivables Collected: <span className="font-medium">{financialReport?.cashAndReceivables.receivablesCollected.toFixed(2) ?? "0.00"}</span></p>
            <p>Outstanding Receivables: <span className="font-medium">{financialReport?.cashAndReceivables.outstandingReceivables.toFixed(2) ?? "0.00"}</span></p>
            <p>Posted Debit: <span className="font-medium">{financialReport?.journalControl.postedDebit.toFixed(2) ?? "0.00"}</span></p>
            <p>Posted Credit: <span className="font-medium">{financialReport?.journalControl.postedCredit.toFixed(2) ?? "0.00"}</span></p>
          </div>
        </div>

        {isAdmin && (
          <form onSubmit={createJournalEntry} className="rounded-lg border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Create Journal Entry</h2>
            <input
              className="w-full rounded border px-3 py-2"
              type="date"
              value={journalForm.entryDate}
              onChange={(e) => setJournalForm((prev) => ({ ...prev, entryDate: e.target.value }))}
              required
            />
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Description"
              value={journalForm.description}
              onChange={(e) => setJournalForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Reference"
              value={journalForm.reference}
              onChange={(e) => setJournalForm((prev) => ({ ...prev, reference: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                className="rounded border px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                placeholder="Debit"
                value={journalForm.totalDebit}
                onChange={(e) => setJournalForm((prev) => ({ ...prev, totalDebit: e.target.value }))}
                required
              />
              <input
                className="rounded border px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                placeholder="Credit"
                value={journalForm.totalCredit}
                onChange={(e) => setJournalForm((prev) => ({ ...prev, totalCredit: e.target.value }))}
                required
              />
              <select
                className="rounded border px-3 py-2"
                value={journalForm.status}
                onChange={(e) => setJournalForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="posted">Posted</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>
            <button className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" type="submit">
              Create Entry
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Journal Entries</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading entries...</p>
        ) : (
          <div className="space-y-2">
            {journalEntries.length === 0 && <p className="text-sm text-gray-500">No journal entries found.</p>}
            {journalEntries.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{entry.description}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(entry.entryDate).toLocaleDateString()} | Ref: {entry.reference || "-"}
                  </p>
                  <p className="text-sm text-gray-700">
                    Dr {entry.totalDebit.toFixed(2)} | Cr {entry.totalCredit.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{entry.status}</span>
                  {isAdmin && (
                    <>
                      <button
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                        onClick={() => void updateJournalStatus(entry.id, "posted")}
                        disabled={entry.status === "posted"}
                      >
                        Post
                      </button>
                      <button
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                        onClick={() => void updateJournalStatus(entry.id, "draft")}
                        disabled={entry.status === "draft"}
                      >
                        Draft
                      </button>
                      <button
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        onClick={() => void updateJournalStatus(entry.id, "reversed")}
                        disabled={entry.status === "reversed"}
                      >
                        Reverse
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounting;
