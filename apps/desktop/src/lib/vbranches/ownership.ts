import type { VirtualBranch, AnyFile, Hunk, RemoteHunk, RemoteFile } from './types';

export function filesToOwnership(files: AnyFile[]) {
	return files
		.map((f) => `${f.path}:${f.hunks.map(({ id, hash }) => `${id}-${hash}`).join(',')}`)
		.join('\n');
}

export function filesToSimpleOwnership(files: RemoteFile[]) {
	return files
		.map(
			(f) =>
				`${f.path}:${f.hunks.map(({ new_start, new_lines }) => `${new_start}-${new_start + new_lines}`).join(',')}`
		)
		.join('\n');
}

// These types help keep track of what maps to what.
// TODO: refactor code for clarity, these types should not be needed
export type AnyHunk = Hunk | RemoteHunk;
export type HunkId = string;
export type FilePath = string;
export type HunkClaims = Map<HunkId, AnyHunk>;
export type FileClaims = Map<FilePath, HunkClaims>;

function branchFilesToClaims(files: AnyFile[]): FileClaims {
	const selection = new Map<FilePath, HunkClaims>();
	for (const file of files) {
		const existingFile = selection.get(file.id);
		if (existingFile) {
			file.hunks.forEach((hunk) => existingFile.set(hunk.id, hunk));
			continue;
		}

		selection.set(
			file.id,
			file.hunks.reduce((acc, hunk) => {
				return acc.set(hunk.id, hunk);
			}, new Map<string, AnyHunk>())
		);
	}

	return selection;
}

function selectAddedClaims(
	branch: VirtualBranch,
	previousState: SelectedOwnershipState,
	selection: Map<string, HunkClaims>
) {
	for (const file of branch.files) {
		const existingFile = previousState.claims.get(file.id);

		if (!existingFile) {
			// Select newly added files
			selection.set(
				file.id,
				file.hunks.reduce((acc, hunk) => {
					return acc.set(hunk.id, hunk);
				}, new Map<string, AnyHunk>())
			);
			continue;
		}

		for (const hunk of file.hunks) {
			const existingHunk = existingFile.get(hunk.id);
			if (!existingHunk) {
				// Select newly added hunks
				const existingFile = selection.get(file.id);
				if (existingFile) {
					existingFile.set(hunk.id, hunk);
				} else {
					selection.set(file.id, new Map([[hunk.id, hunk]]));
				}
			}
		}
	}
}

function ignoreRemovedClaims(
	previousState: SelectedOwnershipState,
	branch: VirtualBranch,
	selection: Map<string, HunkClaims>
) {
	for (const [fileId, hunkClaims] of previousState.selection.entries()) {
		const branchFile = branch.files.find((f) => f.id === fileId);
		if (branchFile) {
			for (const hunkId of hunkClaims.keys()) {
				const branchHunk = branchFile.hunks.find((h) => h.id === hunkId);
				if (branchHunk) {
					// Re-select hunks that are still present in the branch
					const existingFile = selection.get(fileId);
					if (existingFile) {
						existingFile.set(hunkId, branchHunk);
					} else {
						selection.set(fileId, new Map([[hunkId, branchHunk]]));
					}
				}
			}
		}
	}
}

interface SelectedOwnershipState {
	claims: FileClaims;
	selection: FileClaims;
}

function getState(
	branch: VirtualBranch,
	previousState?: SelectedOwnershipState
): SelectedOwnershipState {
	const claims = branchFilesToClaims(branch.files);

	if (previousState !== undefined) {
		const selection = new Map<FilePath, HunkClaims>();
		selectAddedClaims(branch, previousState, selection);
		ignoreRemovedClaims(previousState, branch, selection);

		return { selection, claims };
	}

	return { selection: claims, claims };
}

export class SelectedOwnership {
	private claims: FileClaims;
	private selection: FileClaims;

	constructor(state: SelectedOwnershipState) {
		this.claims = state.claims;
		this.selection = state.selection;
	}

	static fromBranch(branch: VirtualBranch) {
		const state = getState(branch);
		const ownership = new SelectedOwnership(state);
		return ownership;
	}

	update(branch: VirtualBranch) {
		const { selection, claims } = getState(branch, {
			claims: this.claims,
			selection: this.selection
		});

		this.claims = claims;
		this.selection = selection;

		return this;
	}

	ignore(fileId: string, ...hunkIds: string[]) {
		const selection = this.selection;
		if (!selection) return this;
		hunkIds.forEach((hunkId) => {
			selection.get(fileId)?.delete(hunkId);
			if (selection.get(fileId)?.size === 0) selection.delete(fileId);
		});
		return this;
	}

	select(fileId: string, ...items: AnyHunk[]) {
		const selectedFile = this.selection.get(fileId);
		if (selectedFile) {
			items.forEach((hunk) => selectedFile.set(hunk.id, hunk));
		} else {
			this.selection.set(
				fileId,
				items.reduce((acc, hunk) => {
					return acc.set(hunk.id, hunk);
				}, new Map<string, AnyHunk>())
			);
		}
		return this;
	}

	isSelected(fileId: string, ...hunkIds: string[]): boolean {
		return hunkIds.every((hunkId) => !!this.selection.get(fileId)?.has(hunkId));
	}

	clearSelection() {
		this.selection.clear();
		return this;
	}

	toString() {
		return Array.from(this.selection.entries())
			.map(
				([fileId, hunkMap]) =>
					fileId +
					':' +
					Array.from(hunkMap.values())
						.map((hunk) => {
							return `${hunk.id}-${hunk.hash}`;
						})
						.join(',')
			)
			.join('\n');
	}

	nothingSelected() {
		return this.selection.size === 0;
	}
}
