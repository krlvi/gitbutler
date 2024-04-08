<script lang="ts">
	import HunkViewer from './HunkViewer.svelte';
	import Icon from './Icon.svelte';
	import LargeDiffMessage from './LargeDiffMessage.svelte';
	import { computeAddedRemovedByHunk } from '$lib/utils/metrics';
	import { tooltip } from '$lib/utils/tooltip';
	import { getLocalCommits } from '$lib/vbranches/contexts';
	import { getLockText } from '$lib/vbranches/tooltip';
	import type { HunkSection, ContentSection } from '$lib/utils/fileSections';

	export let filePath: string;
	export let isBinary: boolean;
	export let isLarge: boolean;
	export let sections: (HunkSection | ContentSection)[];
	export let isUnapplied: boolean;
	export let selectable = false;
	export let isFileLocked = false;
	export let readonly: boolean = false;

	$: maxLineNumber = sections[sections.length - 1]?.maxLineNumber;
	$: minWidth = getGutterMinWidth(maxLineNumber);

	const localCommits = isFileLocked ? getLocalCommits() : undefined;
	let alwaysShow = false;

	function getGutterMinWidth(max: number) {
		if (max >= 10000) return 2.5;
		if (max >= 1000) return 2;
		if (max >= 100) return 1.5;
		if (max >= 10) return 1.25;
		return 1;
	}
</script>

<div class="hunks">
	{#if isBinary}
		Binary content not shown
	{:else if isLarge}
		Diff too large to be shown
	{:else if sections.length > 50 && !alwaysShow}
		<LargeDiffMessage
			showFrame
			on:show={() => {
				alwaysShow = true;
			}}
		/>
	{:else}
		{#each sections as section}
			{@const { added, removed } = computeAddedRemovedByHunk(section)}
			{#if 'hunk' in section}
				<div class="hunk-wrapper">
					<div class="indicators text-base-11">
						<span class="added">+{added}</span>
						<span class="removed">-{removed}</span>
						{#if section.hunk.lockedTo && $localCommits}
							<div
								use:tooltip={{
									text: getLockText(section.hunk.lockedTo, $localCommits),
									delay: 500
								}}
							>
								<Icon name="locked-small" color="warn" />
							</div>
						{/if}
					</div>
					<HunkViewer
						{filePath}
						{section}
						{selectable}
						{isUnapplied}
						{isFileLocked}
						{minWidth}
						{readonly}
						linesModified={added + removed}
					/>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<style lang="postcss">
	.hunks {
		display: flex;
		flex-direction: column;
		position: relative;
		max-height: 100%;
		flex-shrink: 0;
		padding: var(--size-16);
		gap: var(--size-16);
	}
	.hunk-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--size-10);
	}
	.indicators {
		display: flex;
		align-items: center;
		gap: var(--size-2);
	}
	.added {
		color: #45b156;
	}
	.removed {
		color: #ff3e00;
	}
</style>