This package is a source copy of https://github.com/grgrzybek/activemq-artemis-console/commits/patternfly6 branch
which is not yet merged to upstream https://github.com/apache/artemis-console/commits/main.

The PR is pending at https://github.com/apache/artemis-console/pull/230

The commits are:

$ git lg -n 10
* (2026-11-16 13:17:49 +0100) 3f51602 ARTEMIS-6000 Remove monaco editor dependency <gchuf> (HEAD -> patternfly6, fork/patternfly6)
* (2026-11-16 13:17:49 +0100) 5d9cdc2 ARTEMIS-6139 Avoid fetching messages twice <gchuf>
* (2026-11-16 13:17:48 +0100) 20e193d NO-JIRA Disable hawtio's local address probing in dev builds <gchuf>
* (2026-11-16 13:17:41 +0100) ea0d06b ARTEMIS-6307 speed up address view permission checks <gchuf>
* (2026-11-16 12:55:06 +0100) 6bc71d9 ARTEMIS-6307 Upgrade to @hawtio/react 2.4.1 <Grzegorz Grzybek>
...

The content comes from a tsup-built artemis-console-extension/artemis-extension/packages/artemis-console-plugin
directory of this repository.

Changes:
 - test files removed
 - product info of the package set to: "Artemis Console Plugin = 1.8.0"
 - adjusted package.json dependencies to the same versions as other hawtio-online packages
