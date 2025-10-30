"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const FALLBACK_DESTINATION = '/auth/verify';

export default function VerifyClientPage() {
	const router = useRouter();
	const [destination, setDestination] = useState(FALLBACK_DESTINATION);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const candidate = params.get('next');

		if (candidate && candidate.startsWith('/')) {
			setDestination(candidate);
		}
	}, []);

	const redirect = useCallback(() => {
		router.replace(destination);
	}, [router, destination]);

	useEffect(() => {
		const redirectTimer = window.setTimeout(redirect, 0);

		return () => window.clearTimeout(redirectTimer);
	}, [redirect]);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
			<div className="max-w-md space-y-3">
				<h1 className="text-2xl font-semibold">Almost there…</h1>
				<p className="text-muted-foreground">
					We&apos;re finalizing your login and redirecting you to the app. If this page
					does not refresh automatically, <button
						type="button"
						className="text-primary underline"
									onClick={redirect}
					>continue here</button>.
				</p>
			</div>
		</main>
	);
}
