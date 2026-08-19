# Provider acceptance pack

Trellune is provider-neutral: it renders a learning request, the learner copies
it into a provider, and Trellune validates only returned JSON locally. It does
not call provider APIs, automate provider websites, or retain provider credentials.

Use representative Days 1, 90, 180, and 365 to verify a provider. Confirm the
provider keeps to one question at a time, supports a usable conversation when
Voice is available, returns strict `SESSION_JSON` on request, does not invent
future progress, and respects acquisition limits.

| Provider | Status          | Evidence                                                         |
| -------- | --------------- | ---------------------------------------------------------------- |
| ChatGPT  | Manually tested | Existing product acceptance evidence; see [ChatGPT](chatgpt.md). |
| Claude   | Unverified      | Community manual verification welcome.                           |
| Gemini   | Unverified      | Community manual verification welcome.                           |
| Generic  | Unverified      | No provider capability is assumed.                               |

Playwright WebKit is a browser regression signal, not physical iPhone/PWA
acceptance. See the issue tracker for device testing.
