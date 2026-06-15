from __future__ import annotations

import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen

from service.app import ATSRequestHandler
from service.job_agent import build_application_plan


SAMPLE_RESUME = """Alex Morgan
alex.morgan@email.com | 555-0184 | linkedin.com/in/alexmorgan | github.com/alexmorgan

Professional Summary
Frontend developer with 4 years of experience building web applications, collaborating with product teams, and improving user workflows.

Skills
JavaScript, React, CSS, HTML, Git, REST APIs, Testing

Professional Experience
Frontend Developer | BrightApps | 2021 - Present
- Built reusable React components for customer-facing dashboards used by 20,000+ monthly users.
- Improved page load performance by 32% by optimizing rendering patterns and asset delivery.
- Collaborated with designers, backend engineers, and product managers to ship accessible features.

Education
B.S. Computer Science | State University | 2020"""


SAMPLE_JOB_DESCRIPTION = """Role: Frontend Engineer
We are looking for a Frontend Engineer with 3+ years of experience building accessible, high-quality web applications.
The ideal candidate has strong React, TypeScript, JavaScript, CSS, HTML, REST API, testing, and Git experience.
Responsibilities include collaborating with product and design, improving user experience, building reusable components,
writing automated tests, and optimizing frontend performance. Experience with Vite, accessibility standards, agile teams,
and data visualization is a plus."""


class JobAgentTests(unittest.TestCase):
    def test_build_application_plan_returns_supervised_packet(self) -> None:
        result = build_application_plan(
            SAMPLE_RESUME,
            SAMPLE_JOB_DESCRIPTION,
            job_url="https://careers.example.com/frontend-engineer",
            company_name="Example Apps",
            applicant_notes="Available for hybrid frontend roles.",
        )

        self.assertEqual(result["mode"], "supervised")
        self.assertEqual(result["company_name"], "Example Apps")
        self.assertEqual(result["role_title"], "Frontend Engineer")
        self.assertGreater(result["readiness_score"], 0)
        self.assertIn("does not submit applications automatically", result["summary"])
        self.assertIn("Example Apps hiring team", result["cover_letter"])
        self.assertIn("Example Apps' needs", result["cover_letter"])
        self.assertTrue(any(field["label"] == "Email" and field["status"] == "ready" for field in result["field_checklist"]))
        self.assertTrue(any(step["title"] == "Submit manually" for step in result["steps"]))

    def test_build_application_plan_flags_missing_url_and_placeholders(self) -> None:
        result = build_application_plan(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION)
        blocker_titles = {blocker["title"] for blocker in result["blockers"]}

        self.assertEqual(result["status"], "Needs review")
        self.assertIn("Job posting URL is missing", blocker_titles)
        self.assertIn("Tailored resume contains placeholders", blocker_titles)

    def test_http_service_accepts_application_plan_request(self) -> None:
        with ThreadingHTTPServer(("127.0.0.1", 0), ATSRequestHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                response = self._post_json(
                    f"http://127.0.0.1:{server.server_port}/apply/plan",
                    {
                        "master_resume": SAMPLE_RESUME,
                        "job_description": SAMPLE_JOB_DESCRIPTION,
                        "job_url": "https://jobs.example.com/frontend-engineer",
                        "company_name": "Example Apps",
                    },
                )
            finally:
                server.shutdown()
                thread.join(timeout=5)

        self.assertEqual(response["mode"], "supervised")
        self.assertEqual(response["company_name"], "Example Apps")
        self.assertIn("cover_letter", response)
        self.assertTrue(response["optimized_resume_text"])

    def _post_json(self, url: str, payload: dict[str, str]) -> dict[str, object]:
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
