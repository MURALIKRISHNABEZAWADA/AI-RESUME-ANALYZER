import { ChangeEvent, useMemo, useState } from 'react';
import { buildApplicationAutomationPlan } from './applicationAgent';
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

function GeneratedDocument({ title, value }: { title: string; value: string }) {
  return (
    <article className="generated-doc">
      <h3>{title}</h3>
      <textarea aria-label={title} readOnly value={value} />
    </article>
  );
}

const writeTextToClipboard = async (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (copied) {
      return true;
    }
  } finally {
    document.body.removeChild(textarea);
  }

  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('Clipboard timed out')), 300)),
    ]);
    return true;
  } catch {
    return false;
  }
};

function EmptyState() {
  return (
    <section className="empty-state">
      <div>
        <p className="eyebrow">Ready when you are</p>
        <h2>Paste a resume and job description to generate your match score.</h2>
        <p>
          The dashboard compares JD keywords, ATS formatting, resume structure, and measurable impact. The rewrite
          agent then creates an ATS-friendly draft and application packet you can refine before applying.
        </p>
      </div>
    </section>
  );
}

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [packetCopyStatus, setPacketCopyStatus] = useState('Copy packet');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const applicationPlan = useMemo(
    () => buildApplicationAutomationPlan(resume, jobDescription, analysis),
    [analysis, jobDescription, resume],
  );
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setCopyStatus('Copy resume');
    setPacketCopyStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
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
      setPacketCopyStatus('Copy packet');
    };
    reader.readAsText(file);
  };

  const copyRewrite = async () => {
    if (!analysis.rewrittenResume) {
      return;
    }

    const copied = await writeTextToClipboard(analysis.rewrittenResume);
    setCopyStatus(copied ? 'Copied' : 'Copy failed');
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
    if (!applicationPlan.applicationPacket) {
      return;
    }

    const copied = await writeTextToClipboard(applicationPlan.applicationPacket);
    setPacketCopyStatus(copied ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setPacketCopyStatus('Copy packet'), 1800);
  };

  const downloadApplicationPacket = () => {
    if (!applicationPlan.applicationPacket) {
      return;
    }

    const blob = new Blob([applicationPlan.applicationPacket], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'job-application-packet.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">AI Resume Analyzer</p>
          <h1>Score your resume and build a job application packet.</h1>
          <p>
            Upload or paste your resume, add the JD, and get an instant match score, ATS readiness report, missing
            keywords, a clean resume rewrite draft, and a guided application automation plan tailored to the role.
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
            onChange={(event) => {
              setResume(event.target.value);
              setCopyStatus('Copy resume');
              setPacketCopyStatus('Copy packet');
            }}
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
            onChange={(event) => {
              setJobDescription(event.target.value);
              setCopyStatus('Copy resume');
              setPacketCopyStatus('Copy packet');
            }}
            placeholder="Paste the full job description here..."
            value={jobDescription}
          />
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

          <section className="application-agent-card" aria-label="Job application automation agent">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Job application automation agent</p>
                <h2>Application packet</h2>
              </div>
              <div className="button-row">
                <span className="status-pill">{applicationPlan.readiness}</span>
                <button aria-live="polite" className="ghost-button compact" onClick={copyApplicationPacket} type="button">
                  {packetCopyStatus}
                </button>
                <button className="primary-button compact" onClick={downloadApplicationPacket} type="button">
                  Download packet
                </button>
              </div>
            </div>
            <p className="lead-text">{applicationPlan.summary}</p>

            <div className="application-overview-grid">
              <article className="prep-card score-prep-card">
                <span>Apply readiness</span>
                <strong>{applicationPlan.applyReadinessScore}/100</strong>
                <p>
                  {applicationPlan.roleTitle} at {applicationPlan.companyName}
                </p>
              </article>

              <article className="prep-card">
                <h3>Tracker row</h3>
                <dl className="tracker-grid">
                  {applicationPlan.trackerFields.map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>

            <div className="application-agent-grid">
              <article className="prep-card">
                <h3>Priority queue</h3>
                <ol className="task-list">
                  {applicationPlan.priorityTasks.map((task) => (
                    <li key={`${task.stage}-${task.title}`}>
                      <span>{task.stage}</span>
                      <strong>{task.title}</strong>
                      <p>{task.detail}</p>
                      <em>Done when: {task.doneWhen}</em>
                    </li>
                  ))}
                </ol>
              </article>

              <article className="prep-card">
                <h3>Follow-up sequence</h3>
                <div className="timeline-list">
                  {applicationPlan.followUpSchedule.map((step) => (
                    <div key={step.timing}>
                      <span>{step.timing}</span>
                      <p>{step.action}</p>
                    </div>
                  ))}
                </div>
                <h3>Submission checklist</h3>
                <div className="checklist-grid">
                  {applicationPlan.checklist.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            </div>

            <div className="document-grid">
              <GeneratedDocument title="Cover letter draft" value={applicationPlan.coverLetter} />
              <GeneratedDocument title="Recruiter outreach message" value={applicationPlan.recruiterMessage} />
            </div>

            <div className="application-action-row" aria-label="Application packet actions">
              <p className="muted">Ready to apply? Copy or download the full packet after reviewing these drafts.</p>
              <div className="button-row">
                <button aria-live="polite" className="ghost-button compact" onClick={copyApplicationPacket} type="button">
                  {packetCopyStatus}
                </button>
                <button className="primary-button compact" onClick={downloadApplicationPacket} type="button">
                  Download packet
                </button>
              </div>
            </div>
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
