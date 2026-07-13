/**
 * Render a workspace folder the way editors show recent-project paths: home is
 * collapsed to `~`, paths under home become `~/sub/dir`, everything else is the
 * absolute path. Missing folder (legacy sessions) is treated as home.
 */
export function displayPath(folder: string | undefined, homeDir: string | undefined): string {
	if (!folder) return "~";
	if (!homeDir) return folder;
	const home = homeDir.replace(/[/\\]+$/, "");
	if (folder === home) return "~";
	if (folder.startsWith(`${home}/`) || folder.startsWith(`${home}\\`)) {
		return `~/${folder.slice(home.length + 1).replace(/\\/g, "/")}`;
	}
	return folder;
}
