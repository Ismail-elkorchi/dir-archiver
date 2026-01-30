export const mergeSignals = (...signals: (AbortSignal | undefined)[]) => {
	const valid = signals.filter((signal): signal is AbortSignal => signal !== undefined);
	if (valid.length === 0) {
		return undefined;
	}
	if (valid.length === 1) {
		const single = valid[0];
		if (single !== undefined) {
			return single;
		}
		return undefined;
	}
	return AbortSignal.any(valid);
};

export const throwIfAborted = (signal?: AbortSignal): void => {
	if (signal?.aborted !== true) return;
	const reason: unknown = signal.reason;
	if (reason instanceof Error) {
		throw reason;
	}
	const message = typeof reason === 'string' ? reason : 'The operation was aborted';
	const error = new Error(message);
	error.name = 'AbortError';
	throw error;
};
