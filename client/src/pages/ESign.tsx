import { useEffect, useMemo, useState } from 'react';
import { clmRepository } from '../services/clmRepository';
import type { Contract } from '../types/clm';
import type { ExecutionPackage } from '../types/execution';

const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const statusTone: Record<ExecutionPackage['status'], string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  sent: 'border-brand-100 bg-brand-50 text-brand-700',
  partially_signed: 'border-amber-100 bg-amber-50 text-amber-700',
  executed: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  archived: 'border-violet-100 bg-violet-50 text-violet-700'
};

const pretty = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function ESign() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [packages, setPackages] = useState<ExecutionPackage[]>([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [message, setMessage] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerRole, setSignerRole] = useState('Counterparty Signer');

  const refresh = async () => {
    const loadedContracts = await clmRepository.getContracts();
    setContracts(loadedContracts);
    setPackages(clmRepository.getExecutionPackages());
    if (!selectedContractId && loadedContracts.length > 0) {
      setSelectedContractId(loadedContracts[0].id);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const packagesPending = useMemo(
    () => packages.filter((pkg) => pkg.status === 'draft').length,
    [packages]
  );
  const packagesSent = useMemo(
    () => packages.filter((pkg) => pkg.status === 'sent').length,
    [packages]
  );
  const awaitingSignature = useMemo(
    () => packages.filter((pkg) => pkg.status === 'partially_signed' || pkg.status === 'sent').length,
    [packages]
  );
  const executedThisMonth = useMemo(() => {
    const now = new Date();
    return packages.filter((pkg) => {
      if (!pkg.executedAt) return false;
      const executed = new Date(pkg.executedAt);
      return executed.getUTCFullYear() === now.getUTCFullYear() && executed.getUTCMonth() === now.getUTCMonth();
    }).length;
  }, [packages]);
  const archivedFinalContracts = useMemo(
    () => packages.filter((pkg) => pkg.status === 'archived' || !!pkg.archiveId).length,
    [packages]
  );

  const createPackage = () => {
    if (!selectedContractId) return;
    const created = clmRepository.createExecutionPackage(selectedContractId);
    if (!created) {
      setMessage('Unable to create execution package for selected contract.');
      return;
    }
    setMessage(`Execution package created: ${created.id}`);
    void refresh();
  };

  const addSignerToPackage = (packageId: string) => {
    if (!signerName.trim() || !signerEmail.trim()) {
      setMessage('Signer name and email are required.');
      return;
    }
    const pkg = packages.find((item) => item.id === packageId);
    const order = (pkg?.signers.length ?? 0) + 1;
    const updated = clmRepository.addExecutionSigner(packageId, {
      name: signerName.trim(),
      email: signerEmail.trim(),
      role: signerRole.trim() || 'Signer',
      order
    });
    if (!updated) {
      setMessage('Unable to add signer.');
      return;
    }
    setSignerName('');
    setSignerEmail('');
    setMessage(`Signer added to package ${packageId}.`);
    void refresh();
  };

  const contractById = useMemo(() => new Map(contracts.map((contract) => [contract.id, contract])), [contracts]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Execution Control Center</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">E-Sign and final contract execution operations</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Packages Pending" value={String(packagesPending)} />
        <SummaryCard label="Packages Sent" value={String(packagesSent)} />
        <SummaryCard label="Awaiting Signature" value={String(awaitingSignature)} />
        <SummaryCard label="Executed This Month" value={String(executedThisMonth)} />
        <SummaryCard label="Archived Final Contracts" value={String(archivedFinalContracts)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="text-xl font-black tracking-tight text-slate-950">Create Package</h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={selectedContractId}
            onChange={(event) => setSelectedContractId(event.target.value)}
            className="min-w-[320px] rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-500"
          >
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.request.title} · {contract.counterparty.name}
              </option>
            ))}
          </select>
          <button onClick={createPackage} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
            Create Package
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {packages.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-soft">
            No execution packages yet. Create a package to begin signature workflow.
          </div>
        ) : (
          packages.map((pkg) => {
            const contract = contractById.get(pkg.contractId);
            const completedSigners = pkg.signers.filter((signer) => signer.status === 'completed').length;
            const signerProgress = `${completedSigners}/${pkg.signers.length || 0}`;
            const finalArchiveStatus = pkg.archiveId ? 'Archived' : pkg.status === 'executed' ? 'Ready to Archive' : 'Not Archived';

            return (
              <div key={pkg.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">{contract?.request.title ?? pkg.contractId}</p>
                    <p className="mt-1 text-xs text-slate-500">{contract?.counterparty.name ?? 'Unknown Counterparty'} · Provider: {pkg.provider}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2.5 py-1 font-bold ${statusTone[pkg.status]}`}>{pretty(pkg.status)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">Signer Progress: {signerProgress}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">Sent: {formatDate(pkg.sentAt)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">Executed: {formatDate(pkg.executedAt)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700">Final Archive: {finalArchiveStatus}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => addSignerToPackage(pkg.id)}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Add Signer
                  </button>
                  <button
                    onClick={() => {
                      clmRepository.markExecutionPackageSent(pkg.id);
                      setMessage(`Package ${pkg.id} sent for signature.`);
                      void refresh();
                    }}
                    className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Send for Signature
                  </button>
                  <button
                    onClick={() => {
                      const nextSigner = pkg.signers.find((signer) => signer.status !== 'completed');
                      if (!nextSigner) {
                        setMessage('All signers already completed.');
                        return;
                      }
                      clmRepository.markExecutionSignerCompleted(pkg.id, nextSigner.id);
                      setMessage(`Signer ${nextSigner.name} marked completed.`);
                      void refresh();
                    }}
                    className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white"
                  >
                    Mark Signer Completed
                  </button>
                  <button
                    onClick={() => {
                      clmRepository.markExecutionPackageExecuted(pkg.id);
                      setMessage(`Package ${pkg.id} marked fully executed.`);
                      void refresh();
                    }}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Mark Fully Executed
                  </button>
                  <button
                    onClick={() => {
                      clmRepository.archiveExecutionFinalContract(pkg.id);
                      setMessage(`Package ${pkg.id} archived.`);
                      void refresh();
                    }}
                    className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Archive Final Contract
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                    placeholder="Signer name"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    value={signerEmail}
                    onChange={(event) => setSignerEmail(event.target.value)}
                    placeholder="Signer email"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    value={signerRole}
                    onChange={(event) => setSignerRole(event.target.value)}
                    placeholder="Signer role"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>

                <div className="mt-5 overflow-x-auto">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Signer Timeline</p>
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Signer</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Completed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pkg.signers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-slate-500">
                            No signers added yet.
                          </td>
                        </tr>
                      ) : (
                        pkg.signers
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((signer) => (
                            <tr key={signer.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 font-semibold text-slate-900">{signer.name}</td>
                              <td className="px-4 py-3">{signer.role}</td>
                              <td className="px-4 py-3">{signer.email}</td>
                              <td className="px-4 py-3">{signer.order}</td>
                              <td className="px-4 py-3">{pretty(signer.status)}</td>
                              <td className="px-4 py-3">{formatDate(signer.completedAt)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
