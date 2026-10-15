# Privacy policy

*Board Tweaks for Jira* does not collect, store or share any personal data.

**What it reads.** The extension runs only on Jira Cloud pages
(`https://*.atlassian.net/*`). To show a board's quick filters as buttons it
reads the page and requests the board's quick filter list from Jira's own API
(`/rest/agile/1.0/board/<id>/quickfilter`) on the same site, using your
existing Jira session. That information is used in the page and is not stored
or sent anywhere else.

**What it stores.** Only your settings from the extension's popup (which
tweaks are on, and the button text size). They're kept in Chrome's extension
storage (`chrome.storage.sync`), which Chrome may sync between your own
browsers if you're signed in to Chrome.

**What it sends.** Nothing. The extension makes no requests to any server
other than the Jira site you're on, and it has no analytics or tracking.

**Contact.** Questions about this policy:
[open an issue](https://github.com/metalurgus/jira-ui-tweaks/issues).

*Last updated: October 15, 2026.*
