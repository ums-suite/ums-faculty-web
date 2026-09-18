// ums-conventions.md "Repo hygiene": "Commit messages follow Conventional Commits, enforced by
// commitlint" -- wired here as a commit-msg hook (.husky/commit-msg), not pre-push, so an
// invalid message is rejected at the moment it's authored rather than batched at push time.
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
