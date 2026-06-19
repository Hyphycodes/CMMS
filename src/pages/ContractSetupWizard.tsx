/**
 * M6 — Contract setup wizard (manual Appendices B/C). Walks the CMMS Contract
 * Set-Up checklist, optionally pre-filled from an import, and commits the new
 * contract through persist so it appears in the list immediately.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import type { Contract, ContractSummary } from "@/domain/types";

function blankSummary(): ContractSummary {
  return {
    jobDescription: "", section: "", route: "", county: "", district: 0, projectNumber: "",
    federalProjectNumber: "", contractStatus: "Active", primeContractor: "", primeContractorId: "",
    residentEngineer: "", supervisingFieldEngineer: "", districtConstructionEngineer: "", designerFirm: "",
    projectImplementationEngineer: "", progressScheduleReceived: null, ehsPlanReceived: null, dbeProgramReceived: null,
    lettingDate: null, awardDate: null, executedDate: null, noticeToProceedDate: null, workBeginDate: null,
    contractCompletionDate: null, finalInspectionDate: null, contractSuspendedDate: null, engineersEstimate: 0,
    awardedAmount: 0, currentContractAmount: 0, totalPaidToDate: 0, dbeGoalPct: 0, dbeCommittedPct: 0,
    adjustmentAmount: 0, primaryWorkType: "", terrain: "", funding: "", specificationYear: "", units: "English",
    timeType: "", originalContractTime: 0, currentContractTime: 0, timeChargedToDate: 0, liquidatedDamagesPerDay: 0,
  };
}

function blankContract(): Contract {
  return {
    id: "", number: "", name: "", county: "", district: 0, workType: "",
    inventoryCount: 0, readyForReviewCount: 0, summary: blankSummary(),
    insurance: { contractorNo: "", primeContractorName: "", itemNo: "", finalAcceptanceDate: null, pctComplete: 0, pctCompleteDate: null, policies: [], railroad: [] },
    subcontractors: [], projectDocuments: [],
    finalReview: {
      finalFromDistrict: { deadlineForFinalFrcBills: null, finalInspectionLetters: null, allPayItemsFinal: false, fqSent: null, fqAgree: null, fqCertified: null, fqReceived: null, challengedFq: false, intentToFileClaim: false, claimL1: null, claimL2: null, claimResolved: null, qtyAdjustmentLetter: null, opsSignoff: null, finalInspectionBc71: null, fpeBc111: null, localAgencyCertBc608: null, recordsPayrollRetention: null, recordsLocation: "", stateCompletionNotice: null, forCoToReview: false, projectControlManager: "" },
      documentationReview: { recordsTurnedIn: null, auditStart: null, numIssues: 0, auditGivenToResident: null, correctionsDue: null, correctionsSubmitted: null, auditFinalized: null, reviewer: "", progressReview: "", remarks: "" },
      materialsReview: { numIssues: 0, exceptions: 0, reviewStart: null, auditGiven: null, correctionsDue: null, pccSignoffSent: null, pccSignoffRcvd: null, hmaSignoffSent: null, hmaSignoffRcvd: null, soilsSignoffSent: null, soilsSignoffRcvd: null, materialsCertDate: null, exceptionLetterDate: null, reviewer: "", remarks: "" },
      performancePeriod: [],
      dbeCloseOut: { commitmentPct: 0, bc2115: false, allSbe2115: false, approved: false, goalMet: false, dbeFinalDocSbe2028: false, waiverRequested: false, waiverGranted: false, packet2028Approved: false, eeoRemarks: "", eeoRepresentative: "" },
    },
  };
}

const inp = "h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent";

export function ContractSetupWizard() {
  const navigate = useNavigate();
  const createContract = useStore((s) => s.createContract);
  const canCreate = useStore((s) => s.can("author_contract"));

  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [county, setCounty] = useState("");
  const [district, setDistrict] = useState("1");
  const [workType, setWorkType] = useState("");
  const [prime, setPrime] = useState("");
  const [re, setRe] = useState("");
  const [awarded, setAwarded] = useState("");
  const [letting, setLetting] = useState("");
  const [award, setAward] = useState("");
  const [completion, setCompletion] = useState("");

  if (!canCreate) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-soft">Contract setup is restricted to Resident Engineers / District Admins.</div>;
  }

  const prefill = () => {
    setNumber("90A12");
    setName("US 30 Resurfacing & Bridge Joint Repair");
    setCounty("Kane");
    setDistrict("1");
    setWorkType("Resurfacing");
    setPrime("Plote Construction, Inc.");
    setRe("Gerardo Sanchez II");
    setAwarded("8450000");
    setLetting("2026-03-15");
    setAward("2026-04-20");
    setCompletion("2027-10-30");
  };

  const submit = () => {
    if (!number.trim()) return;
    const c = blankContract();
    c.id = `ct_new_${number.trim()}`;
    c.number = number.trim();
    c.name = name.trim() || number.trim();
    c.county = county.trim();
    c.district = Number(district) || 0;
    c.workType = workType.trim();
    const awardedAmount = Number(awarded) || 0;
    c.summary = {
      ...c.summary,
      jobDescription: name.trim(),
      county: county.trim(),
      district: Number(district) || 0,
      primaryWorkType: workType.trim(),
      primeContractor: prime.trim(),
      residentEngineer: re.trim(),
      awardedAmount,
      currentContractAmount: awardedAmount,
      lettingDate: letting || null,
      awardDate: award || null,
      contractCompletionDate: completion || null,
    };
    createContract(c);
    navigate(`/contract/${c.id}`);
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">New Contract Setup</h1>
            <p className="text-sm text-ink-soft">CMMS Contract Set-Up checklist (Appendix B/C). Prefill from an import or enter manually.</p>
          </div>
          <button onClick={prefill} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-canvas">Prefill from import</button>
        </div>

        <Section title="Contract Information">
          <Field label="Contract Number *"><input value={number} onChange={(e) => setNumber(e.target.value)} className={inp} /></Field>
          <Field label="Contract Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Field>
          <Field label="County"><input value={county} onChange={(e) => setCounty(e.target.value)} className={inp} /></Field>
          <Field label="District"><input value={district} onChange={(e) => setDistrict(e.target.value)} className={inp} /></Field>
          <Field label="Work Type"><input value={workType} onChange={(e) => setWorkType(e.target.value)} className={inp} /></Field>
          <Field label="Prime Contractor"><input value={prime} onChange={(e) => setPrime(e.target.value)} className={inp} /></Field>
          <Field label="Resident Engineer"><input value={re} onChange={(e) => setRe(e.target.value)} className={inp} /></Field>
        </Section>

        <Section title="Values & Dates">
          <Field label="Awarded Amount"><input value={awarded} onChange={(e) => setAwarded(e.target.value)} type="number" className={inp} /></Field>
          <Field label="Letting Date"><input value={letting} onChange={(e) => setLetting(e.target.value)} type="date" className={inp} /></Field>
          <Field label="Award Date"><input value={award} onChange={(e) => setAward(e.target.value)} type="date" className={inp} /></Field>
          <Field label="Completion Date"><input value={completion} onChange={(e) => setCompletion(e.target.value)} type="date" className={inp} /></Field>
        </Section>

        <div className="flex justify-end gap-2">
          <button onClick={() => navigate("/")} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">Cancel</button>
          <button onClick={submit} disabled={!number.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50">Create contract</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
