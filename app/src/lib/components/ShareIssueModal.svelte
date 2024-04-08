<script lang="ts">
	import TextArea from './TextArea.svelte';
	import TextBox from './TextBox.svelte';
	import { CloudClient, User } from '$lib/backend/cloud';
	import { invoke } from '$lib/backend/ipc';
	import * as zip from '$lib/backend/zip';
	import Button from '$lib/components/Button.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { getContext, getContextStore } from '$lib/utils/context';
	import * as toasts from '$lib/utils/toasts';
	import { getVersion } from '@tauri-apps/api/app';
	import { page } from '$app/stores';

	const cloud = getContext(CloudClient);
	const user = getContextStore(User);

	export function show() {
		modal.show();
	}

	function gitIndexLength() {
		return invoke<void>('git_index_size', {
			projectId: projectId
		});
	}

	let modal: Modal;

	let messageInputValue = '';
	let emailInputValue = '';
	let sendLogs = false;
	let sendProjectData = false;
	let sendProjectRepository = false;

	$: projectId = $page.params.projectId;

	function reset() {
		messageInputValue = '';
		sendLogs = false;
		sendProjectData = false;
		sendProjectRepository = false;
	}

	async function readZipFile(path: string, filename?: string): Promise<File | Blob> {
		const { readBinaryFile } = await import('@tauri-apps/api/fs');
		const file = await readBinaryFile(path);
		const fileName = filename ?? path.split('/').pop();
		return fileName
			? new File([file], fileName, { type: 'application/zip' })
			: new Blob([file], { type: 'application/zip' });
	}

	async function submit() {
		const message = messageInputValue;
		const email = $user?.email ?? emailInputValue;

		// put together context information to send with the feedback
		let context = '';
		const appVersion = await getVersion();
		const indexLength = await gitIndexLength();
		context += 'GitButler Version: ' + appVersion + '\n';
		context += 'Browser: ' + navigator.userAgent + '\n';
		context += 'URL: ' + window.location.href + '\n';
		context += 'Length of index: ' + indexLength + '\n';

		toasts.promise(
			Promise.all([
				sendLogs ? zip.logs().then((path) => readZipFile(path, 'logs.zip')) : undefined,
				sendProjectData
					? zip.gitbutlerData({ projectId }).then((path) => readZipFile(path, 'data.zip'))
					: undefined,
				sendProjectRepository
					? zip.projectData({ projectId }).then((path) => readZipFile(path, 'project.zip'))
					: undefined
			]).then(async ([logs, data, repo]) =>
				cloud.createFeedback($user?.access_token, {
					email,
					message,
					context,
					logs,
					data,
					repo
				})
			),
			{
				loading:
					!sendLogs && !sendProjectData && !sendProjectRepository
						? 'Sending feedback...'
						: 'Uploading data...',
				success: 'Feedback sent successfully',
				error: 'Failed to send feedback'
			}
		);
		close();
	}

	function close() {
		reset();
		modal.close();
	}
</script>

<Modal
	bind:this={modal}
	on:close={() => close()}
	on:submit={() => submit()}
	title="Share debug data with GitButler team for review"
>
	<div class="content-wrapper">
		<p class="content-wrapper__help-text text-base-body-13">
			If you are having trouble, please share your project and logs with the GitButler team. We will
			review it for you and help identify how we can help resolve the issue.
		</p>

		{#if !$user}
			<TextBox
				label="Email"
				placeholder="Provide an email so that we can get back to you"
				type="email"
				bind:value={emailInputValue}
				required
				autocomplete={false}
				autocorrect={false}
				spellcheck
			/>
		{/if}

		<TextArea
			label="Comments"
			placeholder="Provide any steps necessary to reproduce the problem."
			autocomplete="off"
			autocorrect="off"
			spellcheck
			id="comments"
			rows={6}
			bind:value={messageInputValue}
		/>

		<div class="content-wrapper__section">
			<span class="text-base-16 text-semibold"> Share logs </span>
			<span class="content-wrapper__help-text text-base-body-13">
				We personally ensure all information you share with us will be reviewed internally only and
				discarded post-resolution
			</span>
		</div>

		<div class="content-wrapper__checkbox-group">
			<div class="content-wrapper__checkbox">
				<Checkbox name="logs" bind:checked={sendLogs} />
				<label class="text-base-13" for="logs">Share logs</label>
			</div>

			{#if projectId}
				<div class="content-wrapper__checkbox">
					<Checkbox name="project-data" bind:checked={sendProjectData} />
					<label class="text-base-13" for="project-data">Share project data</label>
				</div>

				<div class="content-wrapper__checkbox">
					<Checkbox name="project-repository" bind:checked={sendProjectRepository} />
					<label class="text-base-13" for="project-repository">Share project repository</label>
				</div>
			{/if}
		</div>
	</div>

	<svelte:fragment slot="controls">
		<Button style="ghost" kind="solid" type="reset" on:click={close}>Close</Button>
		<Button style="pop" kind="solid" type="submit">Share with GitButler</Button>
	</svelte:fragment>
</Modal>

<style>
	.content-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.content-wrapper__section {
		display: flex;
		flex-direction: column;
		gap: var(--size-8);
	}

	.content-wrapper__help-text {
		opacity: 0.6;
	}

	.content-wrapper__checkbox-group {
		display: flex;
		flex-direction: column;
		gap: var(--size-10);
	}

	.content-wrapper__checkbox {
		display: flex;
		align-items: center;
		gap: var(--size-10);
	}
</style>