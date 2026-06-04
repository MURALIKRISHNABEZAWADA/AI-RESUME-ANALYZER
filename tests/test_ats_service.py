from __future__ import annotations

import base64
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from service.app import ATSRequestHandler
from service.ats_service import optimize_resume


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


class AtsServiceTests(unittest.TestCase):
    def test_optimizer_returns_keywords_score_rewrites_and_pdf(self) -> None:
        result = optimize_resume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION)
        pdf_bytes = base64.b64decode(result["pdf_base64"])

        self.assertGreater(result["ats_match_score"], 50)
        self.assertIn("react", result["matched_keywords"])
        self.assertIn("typescript", result["missing_keywords"])
        self.assertTrue(result["rewritten_bullets"])
        self.assertIn("PROFESSIONAL SUMMARY", result["optimized_resume_text"])
        self.assertEqual(result["pdf_mime_type"], "application/pdf")
        self.assertTrue(pdf_bytes.startswith(b"%PDF-1.4"))
        self.assertTrue(pdf_bytes.rstrip().endswith(b"%%EOF"))

    def test_optimizer_can_skip_pdf_payload(self) -> None:
        result = optimize_resume(SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION, include_pdf=False)
        self.assertEqual(result["pdf_base64"], "")

    def test_http_service_accepts_optimize_request(self) -> None:
        with ThreadingHTTPServer(("127.0.0.1", 0), ATSRequestHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                response = self._post_json(
                    f"http://127.0.0.1:{server.server_port}/optimize",
                    {"master_resume": SAMPLE_RESUME, "job_description": SAMPLE_JOB_DESCRIPTION},
                )
            finally:
                server.shutdown()
                thread.join(timeout=5)

        self.assertEqual(response["pdf_filename"], "ats-optimized-resume.pdf")
        self.assertGreaterEqual(response["keyword_coverage"], 40)
        self.assertTrue(any(keyword["term"] == "react" and keyword["matched"] for keyword in response["ats_keywords"]))

    def test_http_service_rejects_missing_inputs(self) -> None:
        with ThreadingHTTPServer(("127.0.0.1", 0), ATSRequestHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with self.assertRaises(HTTPError) as error:
                    self._post_json(f"http://127.0.0.1:{server.server_port}/optimize", {"master_resume": ""})
            finally:
                server.shutdown()
                thread.join(timeout=5)

        self.assertEqual(error.exception.code, 400)

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

