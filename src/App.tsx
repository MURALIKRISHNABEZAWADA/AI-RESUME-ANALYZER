import { ChangeEvent, useMemo, useState } from 'react';
import { createApplicationPlan, type ApplicationPlan, type ApplicationStatus } from './jobApplicationAgent';
import { analyzeResume, sampleJobDescription, sampleResume } from './resumeAgent';

const sectionLabels = {
  summary: 'Summary',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  projects: 'Projects',
  certifications: 'Certifications',
};

const severityLabel = {
  major: 'High priority',
  moderate: 'Medium priority',
  minor: 'Low priority',
};

const statusLabels: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  submitted: 'Submitted',
  'follow-up': 'Follow-up',
};

interface QueuedApplication {
  id: number;
  companyName: string;
  roleTitle: string;
  portalType: string;
  readinessScore: number;
  status: ApplicationStatus;
  nextStep: string;
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function KeywordList({ title, keywords, tone }: { title: string; keywords: string[]; tone: 'good' | 'warning' }) {
  return (
    <div className="keyword-panel">
      <div className="panel-heading">
        <h3>{title}</h3>
        <span>{keywords.length}</span>
      </div>
      <div className="keyword-cloud">
        {keywords.length ? (
          keywords.map((keyword) => (
            <span className={`chip ${tone}`} key={keyword}>
              {keyword}
            </span>
          ))
        ) : (
          <p className="muted">No keywords to show yet.</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <div>
        <p className="eyebrow">Ready when you are</p>
        <h2>Paste a resume and job description to generate your match score.</h2>
        <p>
          The dashboard compares JD keywords, ATS formatting, resume structure, and measurable impact. The rewrite
          agent then creates an ATS-friendly draft you can refine before applying.
        </p>
      </div>
    </section>
  );
}

function Checklist({ tasks }: { tasks: ApplicationPlan['checklist'] }) {
  return (
    <div className="application-list">
      {tasks.map((task) => (
        <div className={`application-task ${task.priority}`} key={task.title}>
          <span>{task.priority}</span>
          <strong>{task.title}</strong>
          <p>{task.detail}</p>
        </div>
      ))}
    </div>
  );
}

function FieldMap({ fields }: { fields: ApplicationPlan['fieldMap'] }) {
  return (
    <div className="field-map">
      {fields.map((field) => (
        <div className={`field-row ${field.confidence}`} key={field.label}>
          <span>{field.label}</span>
          <strong>{field.value}</strong>
          <small>
            {field.confidence} - {field.source}
          </small>
        </div>
      ))}
    </div>
  );
}

function RiskList({ risks }: { risks: ApplicationPlan['risks'] }) {
  return (
    <div className="risk-list">
      {risks.map((risk) => (
        <div className={`risk-item ${risk.level}`} key={risk.title}>
          <span>{risk.level} risk</span>
          <strong>{risk.title}</strong>
          <p>{risk.detail}</p>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [copyPacketStatus, setCopyPacketStatus] = useState('Copy packet');
  const [applicationQueue, setApplicationQueue] = useState<QueuedApplication[]>([]);
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const applicationPlan = useMemo(
    () =>
      hasAnalysis
        ? createApplicationPlan({
            resume,
            jobDescription,
            companyName,
            roleTitle,
            jobUrl,
            recruiterName,
          })
        : null,
    [companyName, hasAnalysis, jobDescription, jobUrl, recruiterName, resume, roleTitle],
  );

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCompanyName('BrightApps');
    setRoleTitle('Frontend Engineer');
    setJobUrl('https://boards.greenhouse.io/brightapps/jobs/frontend-engineer');
    setRecruiterName('Taylor');
    setCopyStatus('Copy resume');
    setCopyPacketStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCompanyName('');
    setRoleTitle('');
    setJobUrl('');
    setRecruiterName('');
    setCopyStatus('Copy resume');
    setCopyPacketStatus('Copy packet');
    setApplicationQueue([]);
  };

  const handleResumeUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setResume(String(reader.result ?? ''));
      setCopyStatus('Copy resume');
      setCopyPacketStatus('Copy packet');
    };
    reader.readAsText(file);
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    await navigator.clipboard.writeText(analysis.rewrittenResume);
    setCopyStatus('Copied');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const downloadRewrite = () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    const blob = new Blob([analysis.rewrittenResume], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ats-friendly-resume.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyApplicationPacket = async () => {
    if (!applicationPlan) {
      return;
    }

    await navigator.clipboard.writeText(applicationPlan.applicationPacket);
    setCopyPacketStatus('Copied');
    window.setTimeout(() => setCopyPacketStatus('Copy packet'), 1800);
  };

  const downloadApplicationPacket = () => {
    if (!applicationPlan) {
      return;
    }

    const blob = new Blob([applicationPlan.applicationPacket], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filenameSlug = `${applicationPlan.companyName}-${applicationPlan.roleTitle}-application-packet`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `${filenameSlug}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const queueApplication = () => {
    if (!applicationPlan) {
      return;
    }

    setApplicationQueue((currentQueue) => [
      {
        id: Date.now(),
        companyName: applicationPlan.companyName,
        roleTitle: applicationPlan.roleTitle,
        portalType: applicationPlan.portalType,
        readinessScore: applicationPlan.readinessScore,
        status: applicationPlan.status,
        nextStep: applicationPlan.nextStep,
      },
      ...currentQueue,
    ]);
  };

  const updateQueuedStatus = (id: number, status: ApplicationStatus) => {
    setApplicationQueue((currentQueue) =>
      currentQueue.map((application) => (application.id === id ? { ...application, status } : application)),
    );
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Resume Analyzer</p>
          <h1>Score your resume against any job description.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, missing
            keywords, and a clean resume rewrite draft tailored to the role.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={loadSample} type="button">
              Try sample analysis
            </button>
            <button className="ghost-button" onClick={resetDashboard} type="button">
              Clear dashboard
            </button>
          </div>
        </div>
        <div className="score-hero-card" aria-label="Resume score preview">
          <div className="score-ring" style={{ '--score': `${analysis.score * 3.6}deg` } as React.CSSProperties}>
            <span>{hasAnalysis ? analysis.score : 0}</span>
          </div>
          <div>
            <span className="score-label">Resume match</span>
            <strong>{hasAnalysis ? analysis.grade : 'N/A'}</strong>
            <p>{analysis.summary}</p>
          </div>
        </div>
      </section>

      <section className="input-grid" aria-label="Resume and job description inputs">
        <article className="input-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>Your resume</h2>
            </div>
            <label className="upload-button">
              Upload .txt
              <input accept=".txt,.md,.text" onChange={handleResumeUpload} type="file" />
            </label>
          </div>
          <textarea
            aria-label="Resume text"
            onChange={(event) => setResume(event.target.value)}
            placeholder="Paste your resume text here..."
            value={resume}
          />
        </article>

        <article className="input-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Target job description</h2>
            </div>
          </div>
          <textarea
            aria-label="Job description text"
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the full job description here..."
            value={jobDescription}
          />
        </article>
      </section>

      <section className="application-builder" aria-label="Job application automation inputs">
        <article className="analysis-card wide-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Job application agent</h2>
            </div>
            <span className="status-pill">Human review required</span>
          </div>
          <p className="lead-text">
            Add the application details to generate a tailored application packet, cover letter, form-field map, and
            submission checklist. The agent prepares the work; you review and submit in the job portal.
          </p>
          <div className="application-input-grid">
            <label>
              Company
              <input
                aria-label="Company name"
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Acme Inc."
                value={companyName}
              />
            </label>
            <label>
              Role title
              <input
                aria-label="Role title"
                onChange={(event) => setRoleTitle(event.target.value)}
                placeholder="Frontend Engineer"
                value={roleTitle}
              />
            </label>
            <label>
              Job posting URL
              <input
                aria-label="Job posting URL"
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://..."
                value={jobUrl}
              />
            </label>
            <label>
              Recruiter or hiring contact
              <input
                aria-label="Recruiter or hiring contact"
                onChange={(event) => setRecruiterName(event.target.value)}
                placeholder="Optional"
                value={recruiterName}
              />
            </label>
          </div>
        </article>
      </section>

      {!hasAnalysis ? (
        <EmptyState />
      ) : (
        <>
          <section className="metrics-grid" aria-label="Resume analysis metrics">
            <MetricCard label="Overall score" value={`${analysis.score}/100`} helper="Weighted resume-to-JD match" />
            <MetricCard label="Keyword coverage" value={`${analysis.keywordCoverage}%`} helper="JD terms found in resume" />
            <MetricCard label="ATS readiness" value={`${analysis.atsReadiness}%`} helper="Formatting and parser safety" />
            <MetricCard label="Missing keywords" value={`${analysis.missingKeywords.length}`} helper="Terms to add truthfully" />
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card wide-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Dashboard</p>
                  <h2>Match insights</h2>
                </div>
                <span className="status-pill">Grade {analysis.grade}</span>
              </div>
              <p className="lead-text">{analysis.summary}</p>
              <div className="section-checklist">
                {Object.entries(analysis.sections).map(([section, exists]) => (
                  <span className={exists ? 'section-pill found' : 'section-pill missing'} key={section}>
                    {exists ? 'Found' : 'Add'} {sectionLabels[section as keyof typeof sectionLabels]}
                  </span>
                ))}
              </div>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Top strengths</h2>
              </div>
              <ul className="insight-list">
                {analysis.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </article>

            <article className="analysis-card">
              <div className="panel-heading">
                <h2>Action plan</h2>
              </div>
              <ul className="insight-list numbered">
                {analysis.improvements.map((improvement) => (
                  <li key={improvement}>{improvement}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="keyword-grid" aria-label="Keyword comparison">
            <KeywordList title="Matched JD keywords" keywords={analysis.matchedKeywords} tone="good" />
            <KeywordList title="Missing JD keywords" keywords={analysis.missingKeywords} tone="warning" />
          </section>

          <section className="dashboard-grid">
            <article className="analysis-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">ATS scan</p>
                  <h2>Parser safety checks</h2>
                </div>
                <span className="status-pill">{analysis.atsIssues.length} findings</span>
              </div>
              {analysis.atsIssues.length ? (
                <div className="issue-list">
                  {analysis.atsIssues.map((issue) => (
                    <div className={`issue ${issue.severity}`} key={issue.title}>
                      <span>{severityLabel[issue.severity]}</span>
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No major ATS issues detected. Keep the resume in a simple single-column format.</p>
              )}
            </article>

            <article className="analysis-card rewrite-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Resume rewrite agent</p>
                  <h2>ATS-friendly draft</h2>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" onClick={copyRewrite} type="button">
                    {copyStatus}
                  </button>
                  <button className="primary-button compact" onClick={downloadRewrite} type="button">
                    Download
                  </button>
                </div>
              </div>
              <textarea aria-label="ATS-friendly rewritten resume" readOnly value={analysis.rewrittenResume} />
            </article>
          </section>

          {applicationPlan ? (
            <>
              <section className="application-summary-grid" aria-label="Application automation summary">
                <article className="application-hero-card">
                  <div>
                    <p className="eyebrow">Application agent</p>
                    <h2>
                      {applicationPlan.roleTitle} at {applicationPlan.companyName}
                    </h2>
                    <p>{applicationPlan.nextStep}</p>
                    <div className="hero-actions">
                      <button className="primary-button compact" onClick={queueApplication} type="button">
                        Queue application
                      </button>
                      <button className="ghost-button compact" onClick={copyApplicationPacket} type="button">
                        {copyPacketStatus}
                      </button>
                      <button className="ghost-button compact" onClick={downloadApplicationPacket} type="button">
                        Download packet
                      </button>
                    </div>
                  </div>
                  <div className="readiness-card">
                    <span>Readiness</span>
                    <strong>{applicationPlan.readinessScore}/100</strong>
                    <p>{applicationPlan.readinessLevel}</p>
                    <small>{applicationPlan.portalType}</small>
                  </div>
                </article>

                <article className="analysis-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Review checklist</p>
                      <h2>Before you submit</h2>
                    </div>
                    <span className="status-pill">{statusLabels[applicationPlan.status]}</span>
                  </div>
                  <Checklist tasks={applicationPlan.checklist} />
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="analysis-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Autofill helper</p>
                      <h2>Application form field map</h2>
                    </div>
                  </div>
                  <FieldMap fields={applicationPlan.fieldMap} />
                </article>

                <article className="analysis-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Risk guardrails</p>
                      <h2>Safe automation notes</h2>
                    </div>
                  </div>
                  <RiskList risks={applicationPlan.risks} />
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="analysis-card draft-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Cover letter</p>
                      <h2>Tailored draft</h2>
                    </div>
                  </div>
                  <textarea aria-label="Generated cover letter" readOnly value={applicationPlan.coverLetter} />
                </article>

                <article className="analysis-card draft-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Networking</p>
                      <h2>Outreach and follow-up</h2>
                    </div>
                  </div>
                  <textarea
                    aria-label="Generated outreach and follow-up messages"
                    readOnly
                    value={`${applicationPlan.outreachMessage}\n\n${applicationPlan.followUpMessage}`}
                  />
                </article>
              </section>

              <section className="analysis-card wide-card application-queue" aria-label="Application queue">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Tracker</p>
                    <h2>Application queue</h2>
                  </div>
                  <span className="status-pill">{applicationQueue.length} saved</span>
                </div>
                {applicationQueue.length ? (
                  <div className="queue-list">
                    {applicationQueue.map((application) => (
                      <div className="queue-item" key={application.id}>
                        <div>
                          <strong>
                            {application.roleTitle} at {application.companyName}
                          </strong>
                          <p>
                            {application.portalType} - {application.readinessScore}/100 - {application.nextStep}
                          </p>
                        </div>
                        <label>
                          Status
                          <select
                            aria-label={`Status for ${application.roleTitle} at ${application.companyName}`}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                              updateQueuedStatus(application.id, event.target.value as ApplicationStatus)
                            }
                            value={application.status}
                          >
                            {Object.entries(statusLabels).map(([status, label]) => (
                              <option key={status} value={status}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Queue a generated application packet to track review, submission, and follow-up status.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
