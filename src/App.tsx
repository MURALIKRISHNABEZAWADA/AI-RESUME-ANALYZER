import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ApplicationPacket, ApplicationStatus, buildApplicationPacket } from './applicationAgent';
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

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: 'Needs review',
  ready: 'Ready to apply',
  applied: 'Applied',
  follow_up: 'Follow up',
};

const applicationStatusDescriptions: Record<ApplicationStatus, string> = {
  draft: 'Improve the packet before submitting.',
  ready: 'Review once more, then submit manually.',
  applied: 'Application submitted and ready to track.',
  follow_up: 'Follow up with recruiter or hiring team.',
};

const APPLICATION_STORAGE_KEY = 'ai-resume-analyzer-application-packets';

const loadStoredApplications = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(APPLICATION_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as ApplicationPacket[]) : [];
  } catch {
    return [];
  }
};

const getPacketDownloadText = (packet: ApplicationPacket) =>
  [
    `${packet.jobTitle} at ${packet.company}`,
    packet.fitSummary,
    '',
    'APPLICATION CHECKLIST',
    ...packet.checklist.map((item) => `- ${item}`),
    '',
    'AUTOMATION PLAN',
    ...packet.automationPlan.map((item) => `- ${item}`),
    '',
    'CONTACT PROFILE',
    `Name: ${packet.contactProfile.name}`,
    `Email: ${packet.contactProfile.email}`,
    `Phone: ${packet.contactProfile.phone}`,
    `LinkedIn: ${packet.contactProfile.linkedin}`,
    `Portfolio: ${packet.contactProfile.portfolio}`,
    '',
    'COVER LETTER',
    packet.coverLetter,
    '',
    'TAILORED RESUME',
    packet.tailoredResume,
  ].join('\n');

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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ApplicationQueueCard({
  packet,
  isActive,
  onSelect,
}: {
  packet: ApplicationPacket;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button className={`queue-card ${isActive ? 'active' : ''}`} onClick={() => onSelect(packet.id)} type="button">
      <span className={`status-pill application-status ${packet.status}`}>{applicationStatusLabels[packet.status]}</span>
      <strong>{packet.jobTitle}</strong>
      <span>{packet.company}</span>
      <small>{packet.analysis.score}/100 match</small>
    </button>
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

function App() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [applicationPackets, setApplicationPackets] = useState<ApplicationPacket[]>(loadStoredApplications);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('Copy resume');
  const [packetCopyStatus, setPacketCopyStatus] = useState('Copy packet');
  const analysis = useMemo(() => analyzeResume(resume, jobDescription), [resume, jobDescription]);
  const hasAnalysis = Boolean(resume.trim() && jobDescription.trim());
  const selectedPacket = useMemo(
    () => applicationPackets.find((packet) => packet.id === selectedPacketId) ?? applicationPackets[0],
    [applicationPackets, selectedPacketId],
  );

  useEffect(() => {
    window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(applicationPackets));
  }, [applicationPackets]);

  const loadSample = () => {
    setResume(sampleResume);
    setJobDescription(sampleJobDescription);
    setJobTitle('Frontend Engineer');
    setCompany('Nimbus Labs');
    setApplicationUrl('https://careers.example.com/frontend-engineer');
    setCopyStatus('Copy resume');
    setPacketCopyStatus('Copy packet');
  };

  const resetDashboard = () => {
    setResume('');
    setJobDescription('');
    setJobTitle('');
    setCompany('');
    setApplicationUrl('');
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

  const prepareApplication = () => {
    if (!hasAnalysis) {
      return;
    }

    const packet = buildApplicationPacket({
      resume,
      jobDescription,
      jobTitle,
      company,
      applicationUrl,
    });
    setApplicationPackets((currentPackets) => [packet, ...currentPackets]);
    setSelectedPacketId(packet.id);
    setPacketCopyStatus('Copy packet');
  };

  const updatePacketStatus = (id: string, status: ApplicationStatus) => {
    setApplicationPackets((currentPackets) =>
      currentPackets.map((packet) => (packet.id === id ? { ...packet, status } : packet)),
    );
  };

  const clearApplicationQueue = () => {
    setApplicationPackets([]);
    setSelectedPacketId(null);
    setPacketCopyStatus('Copy packet');
  };

  const copyPacket = async () => {
    if (!selectedPacket) {
      return;
    }

    await navigator.clipboard.writeText(getPacketDownloadText(selectedPacket));
    setPacketCopyStatus('Copied');
    window.setTimeout(() => setPacketCopyStatus('Copy packet'), 1800);
  };

  const downloadPacket = () => {
    if (!selectedPacket) {
      return;
    }

    const blob = new Blob([getPacketDownloadText(selectedPacket)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `${selectedPacket.company}-${selectedPacket.jobTitle}-application-packet`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `${filename}.txt`;
    link.click();
    URL.revokeObjectURL(url);
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

      <section className="application-agent-section" aria-label="Job application automation agent">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Job application automation agent</p>
            <h2>Prepare, track, and review every application packet.</h2>
          </div>
          <span className="status-pill">{applicationPackets.length} saved</span>
        </div>
        <p className="lead-text">
          The agent turns your resume and target JD into a tailored resume draft, cover letter, form-fill profile,
          recruiter outreach note, and human-reviewed submission checklist. It never submits applications for you.
        </p>

        <div className="agent-control-grid">
          <label>
            Company
            <input
              className="text-input"
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Target company"
              type="text"
              value={company}
            />
          </label>
          <label>
            Job title
            <input
              className="text-input"
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Role title"
              type="text"
              value={jobTitle}
            />
          </label>
          <label>
            Application URL
            <input
              className="text-input"
              onChange={(event) => setApplicationUrl(event.target.value)}
              placeholder="https://..."
              type="url"
              value={applicationUrl}
            />
          </label>
          <div className="agent-actions">
            <button className="primary-button" disabled={!hasAnalysis} onClick={prepareApplication} type="button">
              Prepare application
            </button>
            <button className="ghost-button" disabled={!applicationPackets.length} onClick={clearApplicationQueue} type="button">
              Clear queue
            </button>
          </div>
        </div>

        {!applicationPackets.length ? (
          <div className="agent-empty">
            <strong>No application packets yet.</strong>
            <p>Paste your resume and a job description, then prepare an application to start the queue.</p>
          </div>
        ) : (
          <div className="application-agent-grid">
            <aside className="queue-column" aria-label="Saved application packets">
              <h3>Application queue</h3>
              <div className="queue-list">
                {applicationPackets.map((packet) => (
                  <ApplicationQueueCard
                    isActive={packet.id === selectedPacket?.id}
                    key={packet.id}
                    onSelect={setSelectedPacketId}
                    packet={packet}
                  />
                ))}
              </div>
            </aside>

            {selectedPacket ? (
              <article className="packet-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Prepared packet</p>
                    <h2>
                      {selectedPacket.jobTitle} at {selectedPacket.company}
                    </h2>
                  </div>
                  <div className="button-row">
                    <button className="ghost-button compact" onClick={copyPacket} type="button">
                      {packetCopyStatus}
                    </button>
                    <button className="primary-button compact" onClick={downloadPacket} type="button">
                      Download packet
                    </button>
                  </div>
                </div>

                <p className="fit-summary">{selectedPacket.fitSummary}</p>
                <div className="packet-metrics">
                  <MetricCard
                    helper="Resume/JD alignment"
                    label="Fit score"
                    value={`${selectedPacket.analysis.score}/100`}
                  />
                  <MetricCard
                    helper="JD terms found"
                    label="Keywords"
                    value={`${selectedPacket.analysis.keywordCoverage}%`}
                  />
                  <MetricCard
                    helper={applicationStatusDescriptions[selectedPacket.status]}
                    label="Status"
                    value={applicationStatusLabels[selectedPacket.status]}
                  />
                </div>

                <div className="button-row status-actions" aria-label="Update application status">
                  {(['draft', 'ready', 'applied', 'follow_up'] as ApplicationStatus[]).map((status) => (
                    <button
                      className={selectedPacket.status === status ? 'primary-button compact' : 'ghost-button compact'}
                      key={status}
                      onClick={() => updatePacketStatus(selectedPacket.id, status)}
                      type="button"
                    >
                      {applicationStatusLabels[status]}
                    </button>
                  ))}
                </div>

                <div className="packet-detail-grid">
                  <section className="packet-card">
                    <h3>Form-fill profile</h3>
                    <div className="profile-grid">
                      <ProfileField label="Name" value={selectedPacket.contactProfile.name} />
                      <ProfileField label="Email" value={selectedPacket.contactProfile.email} />
                      <ProfileField label="Phone" value={selectedPacket.contactProfile.phone} />
                      <ProfileField label="LinkedIn" value={selectedPacket.contactProfile.linkedin} />
                      <ProfileField label="Portfolio" value={selectedPacket.contactProfile.portfolio} />
                    </div>
                  </section>

                  <section className="packet-card">
                    <h3>Submission checklist</h3>
                    <ul className="insight-list">
                      {selectedPacket.checklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="packet-card">
                  <h3>Automation plan</h3>
                  <ol className="insight-list numbered">
                    {selectedPacket.automationPlan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </section>

                <section className="packet-card">
                  <h3>Cover letter draft</h3>
                  <textarea aria-label="Generated cover letter" readOnly value={selectedPacket.coverLetter} />
                </section>

                <section className="packet-card">
                  <h3>Recruiter outreach note</h3>
                  <textarea aria-label="Generated recruiter outreach note" readOnly value={selectedPacket.outreachMessage} />
                </section>

                <section className="packet-card">
                  <h3>Tailored resume draft</h3>
                  <textarea aria-label="Generated application resume" readOnly value={selectedPacket.tailoredResume} />
                </section>
              </article>
            ) : null}
          </div>
        )}
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
        </>
      )}
    </main>
  );
}

export default App;
