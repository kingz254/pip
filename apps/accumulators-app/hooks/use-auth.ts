'use client';
import { useSessionAuth } from '@deriv/core';
export const useAuth = useSessionAuth;
export type UseAuthReturn = ReturnType<typeof useSessionAuth>;
export function prefetchAuthReferral(): void {}
