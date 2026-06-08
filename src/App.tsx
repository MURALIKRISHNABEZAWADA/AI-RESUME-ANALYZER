import { ChangeEvent, useMemo, useState } from 'react';
import { buildApplicationPacketText, buildApplicationPlan } from './applicationAgent';
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

const copyTextToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
};

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [packetCopyStatus, setPacketCopyStatus] = useState('Copy packet');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const applicationPlan = useMemo(
    () =>
      hasAnalysis
        ? buildApplicationPlan(resume, jobDescription, analysis, {
            companyName,
            jobUrl,
            profileNotes,
          })
        : null,
    [analysis, companyName, hasAnalysis, jobDescription, jobUrl, profileNotes, resume],
  );

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCompanyName('BrightApps Labs');
    setJobUrl('https://careers.example.com/frontend-engineer');
    setProfileNotes(
      'Authorized to work in the United States without sponsorship. Available for remote or hybrid roles. Open to discussing compensation based on scope and level.',
    );
    setCopyStatus('Copy resume');
    setPacketCopyStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setCompanyName('');
    setJobUrl('');
    setProfileNotes('');
    setCopyStatus('Copy resume');
    setPacketCopyStatus('Copy packet');
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
    };
    reader.readAsText(file);
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    setCopyStatus((await copyTextToClipboard(analysis.rewrittenResume)) ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setCopyStatus('Copy resume'), 1800);
  };

  const copyApplicationPacket = async () => {
    if (!applicationPlan) {
      return;
    }

    setPacketCopyStatus((await copyTextToClipboard(buildApplicationPacketText(applicationPlan))) ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setPacketCopyStatus('Copy packet'), 1800);
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

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Resume + Application Agent</p>
          <h1>Score your resume and launch a job application copilot.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, tailored
            resume draft, cover letter, answer bank, and human-reviewed application workflow.
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

        <article className="input-card application-details-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">Step 3</p>
              <h2>Application details</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Company
              <input
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Target company"
                type="text"
                value={companyName}
              />
            </label>
            <label className="field-label">
              Job URL
              <input
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://company.com/careers/job-id"
                type="url"
                value={jobUrl}
              />
            </label>
          </div>
          <label className="field-label stacked">
            Profile notes for portal answers
            <textarea
              className="profile-notes"
              onChange={(event) => setProfileNotes(event.target.value)}
              placeholder="Work authorization, sponsorship, location, availability, compensation expectations, and any reusable application notes..."
              value={profileNotes}
            />
          </label>
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

          {applicationPlan ? (
            <section className="application-agent-panel" aria-label="Job application automation agent">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Application automation agent</p>
                  <h2>Human-reviewed application packet</h2>
                </div>
                <button className="primary-button compact" onClick={copyApplicationPacket} type="button">
                  {packetCopyStatus}
                </button>
              </div>

              <div className="agent-summary-grid">
                <article>
                  <span>Readiness</span>
                  <strong>{applicationPlan.readinessScore}/100</strong>
                  <p>{applicationPlan.status}</p>
                </article>
                <article>
                  <span>Target</span>
                  <strong>{applicationPlan.companyName}</strong>
                  <p>{applicationPlan.roleTitle}</p>
                </article>
                <article>
                  <span>Application ID</span>
                  <strong>{applicationPlan.applicationId}</strong>
                  <p>Use this label in your tracker.</p>
                </article>
              </div>

              <p className="lead-text">{applicationPlan.fitSummary}</p>

              <div className="agent-workflow-grid">
                <article className="agent-card">
                  <h3>Prep checklist</h3>
                  <ul className="checklist-list">
                    {applicationPlan.checklist.map((item) => (
                      <li className={item.done ? 'check-item done' : 'check-item'} key={item.title}>
                        <span>{item.done ? 'Ready' : 'Review'}</span>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="agent-card">
                  <h3>Portal steps</h3>
                  <ol className="portal-steps">
                    {applicationPlan.portalSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="muted">
                    This agent prepares materials and workflow steps; submit only after you verify every portal field.
                  </p>
                </article>
              </div>

              <div className="agent-assets-grid">
                <article className="agent-card">
                  <h3>Cover letter draft</h3>
                  <textarea className="asset-textarea" readOnly value={applicationPlan.coverLetter} />
                </article>
                <article className="agent-card">
                  <h3>Recruiter message</h3>
                  <textarea className="asset-textarea recruiter-textarea" readOnly value={applicationPlan.recruiterMessage} />
                </article>
              </div>

              <article className="agent-card">
                <h3>Common application answer bank</h3>
                <dl className="answer-bank">
                  {applicationPlan.answerBank.map((item) => (
                    <div className="answer-item" key={item.question}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </article>

              <article className="agent-card risk-card">
                <h3>Review flags</h3>
                <ul className="risk-list">
                  {applicationPlan.riskFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

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
        </>
      )}
    </main>
  );
}

export default App;
